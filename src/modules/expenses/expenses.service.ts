import type { Event, Expense } from '@prisma/client';
import type { CreateExpenseInput, UpdateExpenseInput } from './expenses.schemas';
import { prisma } from '../../db/prisma';
import { forbidden, notFound } from '../../utils/AppError';
import { decimalToNumber, fromCents, round2, toCents } from '../../utils/money';

type ExpenseWithPayer = Expense & { paidBy: { id: number; fullName: string } };

const toExpense = (e: ExpenseWithPayer, userId: number) => ({
  id: e.id,
  amount: Number(e.amount),
  reason: e.reason,
  paidBy: e.paidBy,
  isMine: e.paidById === userId,
  createdAt: e.createdAt,
  updatedAt: e.updatedAt,
});

const payerInclude = { paidBy: { select: { id: true, fullName: true } } } as const;

/** כל שינוי בהוצאות הופך את ההתחשבנות הקודמת ל"לא מעודכנת" */
const markSettlementOutdated = (eventId: number) =>
  prisma.event.updateMany({
    where: { id: eventId, settlementCalculatedAt: { not: null } },
    data: { settlementOutdated: true },
  });

export const listExpenses = async (event: Event, userId: number) => {
  const [expenses, participants] = await Promise.all([
    prisma.expense.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'desc' },
      include: payerInclude,
    }),
    prisma.eventParticipant.findMany({
      where: { eventId: event.id },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      include: { user: { select: { id: true, fullName: true } } },
    }),
  ]);

  const totalCents = expenses.reduce((sum, e) => sum + toCents(e.amount), 0);
  const budget = decimalToNumber(event.budget);
  const budgetCents = budget === null ? null : toCents(budget);

  const byUser = new Map<number, number>();
  for (const e of expenses) byUser.set(e.paidById, (byUser.get(e.paidById) ?? 0) + toCents(e.amount));

  return {
    budget,
    total: fromCents(totalCents),
    remaining: budgetCents === null ? null : fromCents(budgetCents - totalCents),
    percentUsed: budgetCents === null || budgetCents === 0 ? null : round2((totalCents / budgetCents) * 100),
    isOverBudget: budgetCents === null ? false : totalCents > budgetCents,
    expensesCount: expenses.length,
    myTotal: fromCents(byUser.get(userId) ?? 0),
    byParticipant: participants.map((p) => ({
      userId: p.userId,
      fullName: p.user.fullName,
      total: fromCents(byUser.get(p.userId) ?? 0),
    })),
    expenses: expenses.map((e) => toExpense(e, userId)),
  };
};

export const createExpense = async (eventId: number, userId: number, input: CreateExpenseInput) => {
  const expense = await prisma.expense.create({
    data: { eventId, paidById: userId, amount: input.amount, reason: input.reason },
    include: payerInclude,
  });
  await markSettlementOutdated(eventId);
  return { expense: toExpense(expense, userId) };
};

/** ⭐ כלל: כל אחד עורך ומוחק רק הוצאות שהוא עצמו רשם (גם המארגן) */
const findOwnExpense = async (eventId: number, expenseId: number, userId: number) => {
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, eventId } });
  if (!expense) throw notFound('ההוצאה לא נמצאה', 'EXPENSE_NOT_FOUND');
  if (expense.paidById !== userId) {
    throw forbidden('אפשר לערוך או למחוק רק הוצאה שרשמת בעצמך', 'NOT_YOUR_EXPENSE');
  }
  return expense;
};

export const updateExpense = async (
  eventId: number,
  expenseId: number,
  userId: number,
  input: UpdateExpenseInput,
) => {
  await findOwnExpense(eventId, expenseId, userId);
  const expense = await prisma.expense.update({ where: { id: expenseId }, data: input, include: payerInclude });
  await markSettlementOutdated(eventId);
  return { expense: toExpense(expense, userId) };
};

export const deleteExpense = async (eventId: number, expenseId: number, userId: number) => {
  await findOwnExpense(eventId, expenseId, userId);
  await prisma.expense.delete({ where: { id: expenseId } });
  await markSettlementOutdated(eventId);
  return { message: 'ההוצאה נמחקה' };
};
