import { EventRole, type Event } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { forbidden, notFound } from '../../utils/AppError';

/**
 * ⭐ כאן נמצאים כללי ההרשאה של המפגשים ⭐
 *
 * - מי שלא חבר במפגש מקבל 404 (כדי לא לחשוף שהמפגש קיים).
 * - פעולה שמותרת רק למארגן מחזירה 403 למשתתף רגיל.
 */

export interface Membership {
  event: Event;
  role: EventRole;
  isOrganizer: boolean;
}

export const EVENT_NOT_FOUND_MESSAGE = 'המפגש לא נמצא או שאינך חברה בו';

/** מוודא שהמשתמש חבר במפגש (מארגן או משתתף) */
export const requireMember = async (eventId: number, userId: number): Promise<Membership> => {
  const membership = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId, userId } },
    include: { event: true },
  });
  if (!membership) {
    throw notFound(EVENT_NOT_FOUND_MESSAGE, 'EVENT_NOT_FOUND');
  }
  return {
    event: membership.event,
    role: membership.role,
    isOrganizer: membership.role === EventRole.ORGANIZER,
  };
};

/** מוודא שהמשתמש הוא המארגן של המפגש */
export const requireOrganizer = async (eventId: number, userId: number): Promise<Membership> => {
  const membership = await requireMember(eventId, userId);
  if (!membership.isOrganizer) {
    throw forbidden('רק מארגן המפגש יכול לבצע פעולה זו', 'ORGANIZER_ONLY');
  }
  return membership;
};
