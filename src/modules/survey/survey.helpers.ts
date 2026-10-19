import type { Prisma } from '@prisma/client';
import type { QuestionInput } from './survey.schemas';

/** יוצר שאלות סקר (עם אפשרויות) בסוף רשימת השאלות הקיימת של המפגש */
export const createQuestions = async (tx: Prisma.TransactionClient, eventId: number, questions: QuestionInput[]) => {
  if (questions.length === 0) return [];
  const last = await tx.surveyQuestion.findFirst({ where: { eventId }, orderBy: { order: 'desc' } });
  let order = last ? last.order + 1 : 1;

  const created = [];
  for (const q of questions) {
    created.push(
      await tx.surveyQuestion.create({
        data: {
          eventId,
          text: q.text,
          order: order++,
          options: { create: q.options.map((text, i) => ({ text, order: i + 1 })) },
        },
        include: { options: { orderBy: { order: 'asc' } } },
      }),
    );
  }
  return created;
};

/** שאלות פתיחה שהמארגן יכול לטעון לשלב הסקר באשף */
export const DEFAULT_QUESTIONS: QuestionInput[] = [
  { text: 'איפה נוח לכם להיפגש?', options: [] },
  { text: 'באיזה תאריך נוח לכם?', options: [] },
  { text: 'באיזו שעה נוח לכם?', options: ['בבוקר', 'בצהריים', 'בערב'] },
  { text: 'מה תעדיפו לאכול?', options: ['חלבי', 'בשרי', 'פרווה'] },
];
