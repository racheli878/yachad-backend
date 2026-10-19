import { EventStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import type { AuthUser } from '../../middleware/auth';
import { fromCents, toCents } from '../../utils/money';
import { upcomingWhere } from '../events/events.service';
import { countMyPendingInvitations } from '../invitations/invitations.service';

const UPCOMING_LIMIT = 5;

/** GET /home – כל מה שדף הבית צריך בקריאה אחת */
export const getHome = async (user: AuthUser) => {
  const now = new Date();
  const activeEvent = { status: { in: [EventStatus.PLANNING, EventStatus.SCHEDULED] } };

  const [upcoming, pendingInvitationsCount, myTasks, transfers] = await Promise.all([
    prisma.event.findMany({
      where: { AND: [{ participants: { some: { userId: user.id } } }, upcomingWhere(now)] },
      orderBy: [{ eventDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: UPCOMING_LIMIT,
      include: { participants: { where: { userId: user.id }, select: { role: true } } },
    }),
    countMyPendingInvitations(user),
    prisma.task.findMany({
      where: { assigneeId: user.id, event: activeEvent },
      orderBy: { createdAt: 'asc' },
      include: { event: { select: { id: true, title: true, eventDate: true } } },
    }),
    prisma.settlementTransfer.findMany({
      where: {
        OR: [{ fromUserId: user.id }, { toUserId: user.id }],
        event: { status: { not: EventStatus.CANCELLED } },
      },
      include: {
        event: { select: { id: true, title: true } },
        fromUser: { select: { id: true, fullName: true, phone: true } },
        toUser: { select: { id: true, fullName: true, phone: true } },
      },
    }),
  ]);

  const toPay = transfers.filter((t) => t.fromUserId === user.id);
  const toReceive = transfers.filter((t) => t.toUserId === user.id);
  const sum = (list: typeof transfers) => fromCents(list.reduce((s, t) => s + toCents(t.amount), 0));

  return {
    user: { id: user.id, fullName: user.fullName },
    upcomingEvents: upcoming.map((e) => ({
      id: e.id,
      title: e.title,
      eventDate: e.eventDate,
      location: e.location,
      status: e.status,
      category: e.category,
      activityType: e.activityType,
      myRole: e.participants[0]?.role ?? 'PARTICIPANT',
    })),
    pendingInvitationsCount,
    myOpenTasks: myTasks.map((t) => ({ id: t.id, description: t.description, event: t.event })),
    money: {
      totalToPay: sum(toPay),
      totalToReceive: sum(toReceive),
      toPay: toPay.map((t) => ({ event: t.event, toUser: t.toUser, amount: Number(t.amount) })),
      toReceive: toReceive.map((t) => ({ event: t.event, fromUser: t.fromUser, amount: Number(t.amount) })),
    },
  };
};
