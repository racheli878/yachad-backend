import type { Event, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { fromCents, round2, toCents } from '../../utils/money';
import { calculateSettlement } from './settlement.algorithm';

/** מה שנשמר ב-Event.settlementSummary בזמן החישוב */
interface StoredSummary {
  totalCents: number;
  participantsCount: number;
  balances: { userId: number; fullName: string; paidCents: number; shareCents: number; balanceCents: number }[];
}

const person = { select: { id: true, fullName: true, phone: true } } as const;

/** POST /settlement/calculate – מחשב ושומר (מחליף את החישוב הקודם) */
export const calculate = async (eventId: number, userId: number) => {
  await prisma.$transaction(async (tx) => {
    const participants = await tx.eventParticipant.findMany({
      where: { eventId },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      include: { user: { select: { id: true, fullName: true } } },
    });
    const expenses = await tx.expense.findMany({ where: { eventId } });

    const paid = new Map<number, number>();
    for (const e of expenses) paid.set(e.paidById, (paid.get(e.paidById) ?? 0) + toCents(e.amount));

    const result = calculateSettlement(participants.map((p) => ({ userId: p.userId, paidCents: paid.get(p.userId) ?? 0 })));
    const names = new Map(participants.map((p) => [p.userId, p.user.fullName]));

    const summary: StoredSummary = {
      totalCents: result.totalCents,
      participantsCount: participants.length,
      balances: result.balances.map((b) => ({ ...b, fullName: names.get(b.userId) ?? '' })),
    };

    await tx.settlementTransfer.deleteMany({ where: { eventId } });
    if (result.transfers.length > 0) {
      await tx.settlementTransfer.createMany({
        data: result.transfers.map((t) => ({
          eventId,
          fromUserId: t.fromUserId,
          toUserId: t.toUserId,
          amount: fromCents(t.amountCents),
        })),
      });
    }
    await tx.event.update({
      where: { id: eventId },
      data: {
        settlementCalculatedAt: new Date(),
        settlementOutdated: false,
        settlementSummary: summary as unknown as Prisma.InputJsonValue,
      },
    });
  });

  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  return getSettlement(event, userId);
};

/** GET /settlement – התוצאה האחרונה שנשמרה */
export const getSettlement = async (event: Event, userId: number) => {
  if (!event.settlementCalculatedAt || !event.settlementSummary) {
    return {
      calculated: false,
      calculatedAt: null,
      isOutdated: false,
      total: null,
      participantsCount: null,
      sharePerPerson: null,
      balances: [],
      transfers: [],
      myTransfers: { toPay: [], toReceive: [] },
      myBalance: null,
    };
  }

  const summary = event.settlementSummary as unknown as StoredSummary;
  const transfers = await prisma.settlementTransfer.findMany({
    where: { eventId: event.id },
    orderBy: { id: 'asc' },
    include: { fromUser: person, toUser: person },
  });

  const items = transfers.map((t) => ({ id: t.id, from: t.fromUser, to: t.toUser, amount: Number(t.amount) }));
  const mine = summary.balances.find((b) => b.userId === userId);

  return {
    calculated: true,
    calculatedAt: event.settlementCalculatedAt,
    isOutdated: event.settlementOutdated,
    total: fromCents(summary.totalCents),
    participantsCount: summary.participantsCount,
    sharePerPerson: summary.participantsCount === 0 ? 0 : round2(summary.totalCents / summary.participantsCount / 100),
    balances: summary.balances.map((b) => ({
      userId: b.userId,
      fullName: b.fullName,
      paid: fromCents(b.paidCents),
      share: fromCents(b.shareCents),
      balance: fromCents(b.balanceCents),
    })),
    transfers: items,
    myTransfers: {
      toPay: items.filter((t) => t.from.id === userId).map((t) => ({ id: t.id, toUser: t.to, amount: t.amount })),
      toReceive: items.filter((t) => t.to.id === userId).map((t) => ({ id: t.id, fromUser: t.from, amount: t.amount })),
    },
    myBalance: mine ? fromCents(mine.balanceCents) : null,
  };
};
