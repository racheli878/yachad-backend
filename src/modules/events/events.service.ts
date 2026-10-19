import { EventRole, EventStatus, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { badRequest, conflict, forbidden, notFound } from '../../utils/AppError';
import { createInvitations } from '../invitations/invitations.service';
import { createQuestions } from '../survey/survey.helpers';
import { requireMember } from './eventAccess';
import type { CreateEventInput, ListEventsQuery, UpdateEventInput } from './events.schemas';
import { toEventDetails, toParticipant, toTask } from './events.serializer';

const organizerSelect = { select: { id: true, fullName: true, phone: true } } as const;

/** מפגש "קרוב" = בתכנון או נקבע, והתאריך עוד לא עבר (או שעוד לא נקבע תאריך) */
export const upcomingWhere = (now: Date): Prisma.EventWhereInput => ({
  status: { in: [EventStatus.PLANNING, EventStatus.SCHEDULED] },
  OR: [{ eventDate: null }, { eventDate: { gte: now } }],
});

// ---------- רשימה ----------

export const listMyEvents = async (userId: number, q: ListEventsQuery) => {
  const now = new Date();
  const and: Prisma.EventWhereInput[] = [
    { participants: { some: { userId, ...(q.myRole ? { role: q.myRole } : {}) } } },
  ];
  if (q.search) and.push({ title: { contains: q.search, mode: 'insensitive' } });
  if (q.category) and.push({ category: q.category });
  if (q.activityType) and.push({ activityType: q.activityType });
  if (q.status) and.push({ status: q.status });
  if (q.timeframe === 'upcoming') and.push(upcomingWhere(now));
  if (q.timeframe === 'past') and.push({ NOT: upcomingWhere(now) });

  const orderBy: Prisma.EventOrderByWithRelationInput[] =
    q.sortBy === 'eventDate'
      ? [{ eventDate: { sort: q.sortOrder, nulls: 'last' } }, { createdAt: 'desc' }]
      : [{ createdAt: q.sortOrder }];

  const events = await prisma.event.findMany({
    where: { AND: and },
    orderBy,
    include: {
      organizer: { select: { id: true, fullName: true } },
      participants: { where: { userId }, select: { role: true } },
      _count: { select: { participants: true } },
    },
  });

  return {
    count: events.length,
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      category: e.category,
      activityType: e.activityType,
      status: e.status,
      eventDate: e.eventDate,
      location: e.location,
      myRole: e.participants[0]?.role ?? EventRole.PARTICIPANT,
      participantsCount: e._count.participants,
      organizer: e.organizer,
      createdAt: e.createdAt,
    })),
  };
};

// ---------- דף מפגש ----------

export const getEventPage = async (eventId: number, userId: number) => {
  const { role } = await requireMember(eventId, userId);
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: {
      organizer: organizerSelect,
      participants: {
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        include: { user: { select: { fullName: true, phone: true } } },
      },
      tasks: {
        orderBy: { createdAt: 'asc' },
        include: { assignee: { select: { id: true, fullName: true } } },
      },
    },
  });

  return {
    event: toEventDetails(event, role),
    participants: event.participants.map(toParticipant),
    tasks: event.tasks.map((t) => toTask(t, userId)),
  };
};

// ---------- יצירה ----------

export const createEvent = async (userId: number, input: CreateEventInput) => {
  const { invitees, questions, ...fields } = input;

  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        ...fields,
        organizerId: userId,
        participants: { create: { userId, role: EventRole.ORGANIZER } },
      },
    });
    const invitations = await createInvitations(tx, event.id, userId, invitees);
    const createdQuestions = await createQuestions(tx, event.id, questions);
    return { eventId: event.id, invitations, questionsCount: createdQuestions.length };
  });

  const page = await getEventPage(result.eventId, userId);
  return {
    ...page,
    invitationsSummary: {
      createdCount: result.invitations.created.length,
      skippedCount: result.invitations.skipped.length,
      skipped: result.invitations.skipped,
    },
    questionsCount: result.questionsCount,
  };
};

// ---------- עריכה ומחיקה ----------

export const updateEvent = async (eventId: number, input: UpdateEventInput) => {
  const event = await prisma.event.update({
    where: { id: eventId },
    data: input,
    include: { organizer: organizerSelect },
  });
  return { event: toEventDetails(event, EventRole.ORGANIZER) };
};

export const deleteEvent = async (eventId: number) => {
  await prisma.event.delete({ where: { id: eventId } });
  return { message: 'המפגש נמחק' };
};

// ---------- יציאה / הסרה של משתתף ----------

/**
 * ⭐ כלל: מוציא משתתף מהמפגש: התפקידים שלו מתפנים ותשובות הסקר שלו נמחקות.
 * מי שרשם הוצאות לא יכול לצאת – אחרת ההתחשבנות תשתבש.
 */
export const removeMember = async (eventId: number, userId: number) => {
  const expensesCount = await prisma.expense.count({ where: { eventId, paidById: userId } });
  if (expensesCount > 0) {
    throw conflict(
      'HAS_EXPENSES',
      'למשתתף יש הוצאות רשומות במפגש. יש למחוק אותן קודם (כל משתתף מוחק את ההוצאות שלו)',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({ where: { eventId, assigneeId: userId }, data: { assigneeId: null } });
    await tx.surveyAnswer.deleteMany({ where: { userId, option: { question: { eventId } } } });
    await tx.surveyResponse.deleteMany({ where: { eventId, userId } });
    await tx.eventParticipant.delete({ where: { eventId_userId: { eventId, userId } } });
    await tx.event.updateMany({
      where: { id: eventId, settlementCalculatedAt: { not: null } },
      data: { settlementOutdated: true },
    });
  });
};

export const leaveEvent = async (eventId: number, userId: number) => {
  const { isOrganizer } = await requireMember(eventId, userId);
  if (isOrganizer) {
    throw forbidden('המארגן לא יכול לעזוב את המפגש. אפשר למחוק את המפגש במקום זאת', 'ORGANIZER_CANNOT_LEAVE');
  }
  await removeMember(eventId, userId);
  return { message: 'עזבת את המפגש' };
};

export const removeParticipant = async (eventId: number, organizerId: number, targetUserId: number) => {
  if (targetUserId === organizerId) {
    throw badRequest('CANNOT_REMOVE_ORGANIZER', 'המארגן לא יכול להסיר את עצמו מהמפגש');
  }
  const target = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId, userId: targetUserId } },
  });
  if (!target) {
    throw notFound('המשתמש אינו משתתף במפגש', 'PARTICIPANT_NOT_FOUND');
  }
  await removeMember(eventId, targetUserId);
  return { message: 'המשתתף הוסר מהמפגש' };
};

export const listParticipants = async (eventId: number) => {
  const participants = await prisma.eventParticipant.findMany({
    where: { eventId },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    include: { user: { select: { fullName: true, phone: true } } },
  });
  return { count: participants.length, participants: participants.map(toParticipant) };
};
