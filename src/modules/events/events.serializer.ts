import type { Event, EventRole } from '@prisma/client';
import { decimalToNumber } from '../../utils/money';

type EventWithOrganizer = Event & {
  organizer: { id: number; fullName: string; phone: string };
};

/** פרטי מפגש מלאים (לדף המפגש) */
export const toEventDetails = (event: EventWithOrganizer, myRole: EventRole) => ({
  id: event.id,
  title: event.title,
  description: event.description,
  eventDate: event.eventDate,
  location: event.location,
  food: event.food,
  category: event.category,
  activityType: event.activityType,
  status: event.status,
  budget: decimalToNumber(event.budget),
  organizer: {
    id: event.organizer.id,
    fullName: event.organizer.fullName,
    phone: event.organizer.phone,
  },
  myRole,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
});

/** משתתף כפי שכולם רואים אותו (שם + טלפון, בלי מייל) */
export const toParticipant = (p: {
  userId: number;
  role: EventRole;
  joinedAt: Date;
  user: { fullName: string; phone: string };
}) => ({
  userId: p.userId,
  fullName: p.user.fullName,
  phone: p.user.phone,
  role: p.role,
  joinedAt: p.joinedAt,
});

export const toTask = (
  t: { id: number; description: string; assigneeId: number | null; createdAt: Date; assignee: { id: number; fullName: string } | null },
  currentUserId: number,
) => ({
  id: t.id,
  description: t.description,
  isTaken: t.assigneeId !== null,
  assignee: t.assignee ? { id: t.assignee.id, fullName: t.assignee.fullName } : null,
  isMine: t.assigneeId === currentUserId,
  createdAt: t.createdAt,
});
