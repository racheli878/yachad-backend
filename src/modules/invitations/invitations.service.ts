import { EventRole, InvitationStatus, Prisma, type Invitation } from '@prisma/client';
import { prisma } from '../../db/prisma';
import type { AuthUser } from '../../middleware/auth';
import { conflict, notFound } from '../../utils/AppError';
import { decimalToNumber } from '../../utils/money';
import type { Invitee } from './invitations.schemas';

type Tx = Prisma.TransactionClient;

export type SkipReason = 'ALREADY_PARTICIPANT' | 'ALREADY_INVITED' | 'DUPLICATE_IN_LIST';

const SKIP_MESSAGES: Record<SkipReason, string> = {
  ALREADY_PARTICIPANT: 'האדם כבר משתתף במפגש',
  ALREADY_INVITED: 'כבר נשלחה לאדם הזמנה שממתינה לתשובה',
  DUPLICATE_IN_LIST: 'המוזמן מופיע ברשימה יותר מפעם אחת',
};

/** תנאי שמוצא הזמנות שמתאימות למייל או לטלפון של משתמש */
const matchesUser = (user: { email: string; phone: string }): Prisma.InvitationWhereInput => ({
  OR: [{ email: user.email }, { phone: user.phone }],
});

/** המבנה של הזמנה כפי שהמארגן רואה אותה */
const toOrganizerInvitation = (
  inv: Invitation,
  registeredUser: { id: number; fullName: string } | null,
) => ({
  id: inv.id,
  email: inv.email,
  phone: inv.phone,
  status: inv.status,
  createdAt: inv.createdAt,
  respondedAt: inv.respondedAt,
  registeredUser,
});

/** מוצא משתמשים רשומים לפי רשימת מיילים/טלפונים (לסימון "רשום במערכת") */
const findRegisteredUsers = async (tx: Tx, items: { email: string | null; phone: string | null }[]) => {
  const emails = items.map((i) => i.email).filter((e): e is string => !!e);
  const phones = items.map((i) => i.phone).filter((p): p is string => !!p);
  if (emails.length === 0 && phones.length === 0) return [];
  return tx.user.findMany({
    where: { OR: [{ email: { in: emails } }, { phone: { in: phones } }] },
    select: { id: true, fullName: true, email: true, phone: true },
  });
};

const matchUser = <U extends { email: string; phone: string }>(
  users: U[],
  item: { email: string | null; phone: string | null },
): U[] => users.filter((u) => (item.email && u.email === item.email) || (item.phone && u.phone === item.phone));

/**
 * יוצר הזמנות למפגש. משמש גם ביצירת מפגש וגם בהוספת מוזמנים בהמשך.
 * מוזמן שכבר משתתף / כבר הוזמן – לא מקבל הזמנה כפולה, ומופיע ב-skipped.
 */
export const createInvitations = async (tx: Tx, eventId: number, invitedById: number, invitees: Invitee[]) => {
  const participants = await tx.eventParticipant.findMany({
    where: { eventId },
    select: { userId: true },
  });
  const participantIds = new Set(participants.map((p) => p.userId));
  const pending = await tx.invitation.findMany({ where: { eventId, status: InvitationStatus.PENDING } });
  const users = await findRegisteredUsers(tx, [...invitees, ...pending]);

  const created: ReturnType<typeof toOrganizerInvitation>[] = [];
  const skipped: { email: string | null; phone: string | null; reason: SkipReason; message: string }[] = [];
  const seenKeys = new Set<string>();

  for (const invitee of invitees) {
    const skip = (reason: SkipReason) =>
      skipped.push({ email: invitee.email, phone: invitee.phone, reason, message: SKIP_MESSAGES[reason] });

    const keys = [invitee.email && `e:${invitee.email}`, invitee.phone && `p:${invitee.phone}`].filter(
      (k): k is string => !!k,
    );
    if (keys.some((k) => seenKeys.has(k))) {
      skip('DUPLICATE_IN_LIST');
      continue;
    }

    const matchedUsers = matchUser(users, invitee);
    if (matchedUsers.some((u) => participantIds.has(u.id))) {
      skip('ALREADY_PARTICIPANT');
      continue;
    }

    // האם כבר יש הזמנה ממתינה לאותו אדם (לפי מייל/טלפון, או לפי משתמש רשום תואם)
    const identities = [
      { email: invitee.email, phone: invitee.phone },
      ...matchedUsers.map((u) => ({ email: u.email, phone: u.phone })),
    ];
    const alreadyInvited = pending.some((p) =>
      identities.some((id) => (id.email && p.email === id.email) || (id.phone && p.phone === id.phone)),
    );
    if (alreadyInvited) {
      skip('ALREADY_INVITED');
      continue;
    }

    keys.forEach((k) => seenKeys.add(k));
    const invitation = await tx.invitation.create({
      data: { eventId, invitedById, email: invitee.email, phone: invitee.phone },
    });
    pending.push(invitation);
    const registered = matchedUsers[0];
    created.push(toOrganizerInvitation(invitation, registered ? { id: registered.id, fullName: registered.fullName } : null));
  }

  return { created, skipped };
};

// ---------- צד המארגן ----------

export const addInvitations = async (eventId: number, organizerId: number, invitees: Invitee[]) => {
  const result = await prisma.$transaction((tx) => createInvitations(tx, eventId, organizerId, invitees));
  return {
    createdCount: result.created.length,
    skippedCount: result.skipped.length,
    created: result.created,
    skipped: result.skipped,
  };
};

export const listEventInvitations = async (eventId: number) => {
  const invitations = await prisma.invitation.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
  });
  const users = await findRegisteredUsers(prisma, invitations);
  const items = invitations.map((inv) => {
    const u = matchUser(users, inv)[0];
    return toOrganizerInvitation(inv, u ? { id: u.id, fullName: u.fullName } : null);
  });
  const countBy = (s: InvitationStatus) => items.filter((i) => i.status === s).length;
  return {
    count: items.length,
    pendingCount: countBy(InvitationStatus.PENDING),
    acceptedCount: countBy(InvitationStatus.ACCEPTED),
    declinedCount: countBy(InvitationStatus.DECLINED),
    invitations: items,
  };
};

// ---------- צד המוזמן ----------

/** ההזמנות הממתינות של המשתמש – הזמנה אחת לכל מפגש, בלי מפגשים שהוא כבר חבר בהם */
export const myPendingInvitations = async (user: AuthUser) => {
  const invitations = await prisma.invitation.findMany({
    where: {
      status: InvitationStatus.PENDING,
      ...matchesUser(user),
      event: { participants: { none: { userId: user.id } } },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      event: {
        include: {
          organizer: { select: { id: true, fullName: true } },
          _count: { select: { participants: true } },
        },
      },
      invitedBy: { select: { id: true, fullName: true } },
    },
  });

  const seenEvents = new Set<number>();
  const unique = invitations.filter((inv) => {
    if (seenEvents.has(inv.eventId)) return false;
    seenEvents.add(inv.eventId);
    return true;
  });

  return {
    count: unique.length,
    invitations: unique
      .map((inv) => ({
        id: inv.id,
        createdAt: inv.createdAt,
        invitedBy: inv.invitedBy,
        event: {
          id: inv.event.id,
          title: inv.event.title,
          description: inv.event.description,
          eventDate: inv.event.eventDate,
          location: inv.event.location,
          category: inv.event.category,
          activityType: inv.event.activityType,
          status: inv.event.status,
          budget: decimalToNumber(inv.event.budget),
          participantsCount: inv.event._count.participants,
          organizer: inv.event.organizer,
        },
      }))
      .reverse(), // החדשות למעלה
  };
};

export const countMyPendingInvitations = async (user: AuthUser) =>
  (await myPendingInvitations(user)).count;

/** מוצא הזמנה ממתינה ששייכת למשתמש (לפי מייל/טלפון). אחרת 404 */
const findMyPendingInvitation = async (invitationId: number, user: AuthUser) => {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, status: InvitationStatus.PENDING, ...matchesUser(user) },
  });
  if (!invitation) {
    throw notFound('ההזמנה לא נמצאה או שכבר נענתה', 'INVITATION_NOT_FOUND');
  }
  return invitation;
};

export const acceptInvitation = async (invitationId: number, user: AuthUser) => {
  const invitation = await findMyPendingInvitation(invitationId, user);

  const already = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId: invitation.eventId, userId: user.id } },
  });
  if (already) {
    throw conflict('ALREADY_PARTICIPANT', 'את כבר משתתפת במפגש הזה');
  }

  await prisma.$transaction(async (tx) => {
    await tx.eventParticipant.create({
      data: { eventId: invitation.eventId, userId: user.id, role: EventRole.PARTICIPANT },
    });
    // כל ההזמנות הממתינות של אותו אדם לאותו מפגש (למשל גם במייל וגם בטלפון) נסגרות יחד
    await tx.invitation.updateMany({
      where: { eventId: invitation.eventId, status: InvitationStatus.PENDING, ...matchesUser(user) },
      data: { status: InvitationStatus.ACCEPTED, respondedAt: new Date() },
    });
    // משתתף חדש משנה את החלוקה – ההתחשבנות הקודמת כבר לא מעודכנת
    await tx.event.updateMany({
      where: { id: invitation.eventId, settlementCalculatedAt: { not: null } },
      data: { settlementOutdated: true },
    });
  });

  return { message: 'ההזמנה אושרה, הצטרפת למפגש', eventId: invitation.eventId };
};

export const declineInvitation = async (invitationId: number, user: AuthUser) => {
  const invitation = await findMyPendingInvitation(invitationId, user);
  await prisma.invitation.updateMany({
    where: { eventId: invitation.eventId, status: InvitationStatus.PENDING, ...matchesUser(user) },
    data: { status: InvitationStatus.DECLINED, respondedAt: new Date() },
  });
  return { message: 'ההזמנה נדחתה', eventId: invitation.eventId };
};
