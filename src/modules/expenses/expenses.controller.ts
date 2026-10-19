import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { idParam, parse } from '../../utils/validate';
import { requireMember } from '../events/eventAccess';
import { createExpenseSchema, updateExpenseSchema } from './expenses.schemas';
import * as service from './expenses.service';

export const list = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  const user = currentUser(req);
  const { event } = await requireMember(eventId, user.id);
  res.json(await service.listExpenses(event, user.id));
};

export const create = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  const user = currentUser(req);
  await requireMember(eventId, user.id);
  const input = parse(createExpenseSchema, req.body);
  res.status(201).json(await service.createExpense(eventId, user.id, input));
};

export const update = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  const expenseId = parse(idParam, req.params.expenseId);
  const user = currentUser(req);
  await requireMember(eventId, user.id);
  const input = parse(updateExpenseSchema, req.body);
  res.json(await service.updateExpense(eventId, expenseId, user.id, input));
};

export const remove = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  const expenseId = parse(idParam, req.params.expenseId);
  const user = currentUser(req);
  await requireMember(eventId, user.id);
  res.json(await service.deleteExpense(eventId, expenseId, user.id));
};
