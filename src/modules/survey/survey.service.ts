import { EventStatus, type Event } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { badRequest, conflict } from '../../utils/AppError';
import { createQuestions, DEFAULT_QUESTIONS } from './survey.helpers';
import type { QuestionInput, SaveAnswersInput } from './survey.schemas';

/** ⭐ כלל: הסקר פתוח למענה ולהוספת שאלות רק כשהמפגש בסטטוס "בתכנון" */
export const isSurveyOpen = (event: Pick<Event, 'status'>) => event.status === EventStatus.PLANNING;

const assertSurveyOpen = (event: Pick<Event, 'status'>) => {
  if (!isSurveyOpen(event)) {
    throw conflict('SURVEY_CLOSED', 'הסקר סגור, כי המפגש כבר אינו בסטטוס "בתכנון"');
  }
};

const loadQuestions = (eventId: number) =>
  prisma.surveyQuestion.findMany({
    where: { eventId },
    orderBy: { order: 'asc' },
    include: { options: { orderBy: { order: 'asc' } } },
  });

// ---------- צפייה ומענה ----------

export const getSurvey = async (event: Event, userId: number) => {
  const [questions, myAnswers, myResponse] = await Promise.all([
    loadQuestions(event.id),
    prisma.surveyAnswer.findMany({
      where: { userId, option: { question: { eventId: event.id } } },
      select: { optionId: true },
    }),
    prisma.surveyResponse.findUnique({ where: { eventId_userId: { eventId: event.id, userId } } }),
  ]);
  const selected = new Set(myAnswers.map((a) => a.optionId));

  return {
    isOpen: isSurveyOpen(event),
    hasResponded: !!myResponse,
    mySubmittedAt: myResponse?.updatedAt ?? null,
    myNote: myResponse?.note ?? null,
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      order: q.order,
      options: q.options.map((o) => ({ id: o.id, text: o.text, selectedByMe: selected.has(o.id) })),
    })),
  };
};

/**
 * שומר את התשובות של המשתמש – מחליף לגמרי את התשובות הקודמות שלו.
 * שאלה שלא נשלחה (או נשלחה עם רשימה ריקה) = לא סומנה אף אפשרות.
 */
export const saveAnswers = async (event: Event, userId: number, input: SaveAnswersInput) => {
  assertSurveyOpen(event);
  const questions = await loadQuestions(event.id);
  const byId = new Map(questions.map((q) => [q.id, q]));

  const optionIds = new Set<number>();
  const seenQuestions = new Set<number>();
  input.answers.forEach((a, i) => {
    const question = byId.get(a.questionId);
    if (!question) {
      throw badRequest('INVALID_QUESTION', 'השאלה לא שייכת לסקר של המפגש', [
        { field: `answers.${i}.questionId`, message: `שאלה ${a.questionId} לא קיימת בסקר` },
      ]);
    }
    if (seenQuestions.has(a.questionId)) {
      throw badRequest('DUPLICATE_QUESTION', 'כל שאלה יכולה להופיע פעם אחת בלבד', [
        { field: `answers.${i}.questionId`, message: 'השאלה מופיעה יותר מפעם אחת' },
      ]);
    }
    seenQuestions.add(a.questionId);
    const valid = new Set(question.options.map((o) => o.id));
    for (const optionId of a.optionIds) {
      if (!valid.has(optionId)) {
        throw badRequest('INVALID_OPTION', 'אפשרות התשובה לא שייכת לשאלה', [
          { field: `answers.${i}.optionIds`, message: `אפשרות ${optionId} לא שייכת לשאלה ${a.questionId}` },
        ]);
      }
      optionIds.add(optionId);
    }
  });

  await prisma.$transaction(async (tx) => {
    await tx.surveyAnswer.deleteMany({ where: { userId, option: { question: { eventId: event.id } } } });
    if (optionIds.size > 0) {
      await tx.surveyAnswer.createMany({ data: [...optionIds].map((optionId) => ({ optionId, userId })) });
    }
    await tx.surveyResponse.upsert({
      where: { eventId_userId: { eventId: event.id, userId } },
      create: { eventId: event.id, userId, note: input.note },
      update: { note: input.note },
    });
  });

  return getSurvey(event, userId);
};

// ---------- מארגן ----------

export const addQuestion = async (event: Event, input: QuestionInput) => {
  assertSurveyOpen(event);
  const [question] = await prisma.$transaction((tx) => createQuestions(tx, event.id, [input]));
  return {
    question: {
      id: question!.id,
      text: question!.text,
      order: question!.order,
      options: question!.options.map((o) => ({ id: o.id, text: o.text })),
    },
  };
};

const pct = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 1000) / 10);

/**
 * תוצאות הסקר למארגן:
 *  - questions: סטטיסטיקה לכל אפשרות (כמה בחרו, אחוז, האם מובילה, מי בחר)
 *  - responses: טבלה מפורטת – כל משתתף ומה בחר + ההערה שלו
 *  - notResponded: מי עוד לא ענה
 */
export const getResults = async (event: Event) => {
  const [questions, participants, responses] = await Promise.all([
    prisma.surveyQuestion.findMany({
      where: { eventId: event.id },
      orderBy: { order: 'asc' },
      include: {
        options: {
          orderBy: { order: 'asc' },
          include: { answers: { include: { user: { select: { id: true, fullName: true } } } } },
        },
      },
    }),
    prisma.eventParticipant.findMany({
      where: { eventId: event.id },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      include: { user: { select: { id: true, fullName: true } } },
    }),
    prisma.surveyResponse.findMany({
      where: { eventId: event.id },
      orderBy: { submittedAt: 'asc' },
      include: { user: { select: { id: true, fullName: true } } },
    }),
  ]);

  const respondedIds = new Set(responses.map((r) => r.userId));

  const questionStats = questions.map((q) => {
    const respondents = new Set(q.options.flatMap((o) => o.answers.map((a) => a.userId)));
    const maxVotes = Math.max(0, ...q.options.map((o) => o.answers.length));
    return {
      id: q.id,
      text: q.text,
      order: q.order,
      respondentsCount: respondents.size,
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        votes: o.answers.length,
        percentage: pct(o.answers.length, respondents.size),
        isTop: maxVotes > 0 && o.answers.length === maxVotes,
        voters: o.answers.map((a) => a.user),
      })),
    };
  });

  const rows = responses.map((r) => ({
    user: r.user,
    submittedAt: r.submittedAt,
    updatedAt: r.updatedAt,
    note: r.note,
    answers: questions.map((q) => {
      const chosen = q.options.filter((o) => o.answers.some((a) => a.userId === r.userId));
      return { questionId: q.id, optionIds: chosen.map((o) => o.id), optionTexts: chosen.map((o) => o.text) };
    }),
  }));

  return {
    isOpen: isSurveyOpen(event),
    participantsCount: participants.length,
    respondentsCount: responses.length,
    responseRate: pct(responses.length, participants.length),
    questions: questionStats,
    responses: rows,
    notResponded: participants.filter((p) => !respondedIds.has(p.userId)).map((p) => p.user),
  };
};

export const getDefaultQuestions = () => ({ questions: DEFAULT_QUESTIONS });
