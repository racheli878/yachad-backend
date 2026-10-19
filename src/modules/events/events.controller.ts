import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { idParam, parse } from '../../utils/validate';
import { requireMember, requireOrganizer } from './eventAccess';
import { createEventSchema, listEventsQuerySchema, updateEventSchema } from './events.schemas';
import * as service from './events.service';

export const list = async (req: Request, res: Response) => {
  const query = parse(listEventsQuerySchema, req.query);
  res.json(await service.listMyEvents(currentUser(req).id, query));
};

export const create = async (req: Request, res: Response) => {
  const input = parse(createEventSchema, req.body);
  res.status(201).json(await service.createEvent(currentUser(req).id, input));
};

export const getOne = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  res.json(await service.getEventPage(eventId, currentUser(req).id));
};

export const update = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  await requireOrganizer(eventId, currentUser(req).id);
  const input = parse(updateEventSchema, req.body);
  res.json(await service.updateEvent(eventId, input));
};

export const remove = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  await requireOrganizer(eventId, currentUser(req).id);
  res.json(await service.deleteEvent(eventId));
};

export const leave = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  res.json(await service.leaveEvent(eventId, currentUser(req).id));
};

export const participants = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  await requireMember(eventId, currentUser(req).id);
  res.json(await service.listParticipants(eventId));
};

export const removeParticipant = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  const targetUserId = parse(idParam, req.params.userId);
  const user = currentUser(req);
  await requireOrganizer(eventId, user.id);
  res.json(await service.removeParticipant(eventId, user.id, targetUserId));
};
