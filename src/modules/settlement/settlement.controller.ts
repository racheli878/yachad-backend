import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { idParam, parse } from '../../utils/validate';
import { requireMember, requireOrganizer } from '../events/eventAccess';
import * as service from './settlement.service';

export const calculate = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  const user = currentUser(req);
  await requireOrganizer(eventId, user.id);
  res.json(await service.calculate(eventId, user.id));
};

export const get = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  const user = currentUser(req);
  const { event } = await requireMember(eventId, user.id);
  res.json(await service.getSettlement(event, user.id));
};
