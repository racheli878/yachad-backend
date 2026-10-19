import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { idParam, parse } from '../../utils/validate';
import { requireMember, requireOrganizer } from '../events/eventAccess';
import { taskBodySchema } from './tasks.schemas';
import * as service from './tasks.service';

const ids = (req: Request) => ({
  eventId: parse(idParam, req.params.eventId),
  taskId: req.params.taskId === undefined ? undefined : parse(idParam, req.params.taskId),
});

export const list = async (req: Request, res: Response) => {
  const { eventId } = ids(req);
  const user = currentUser(req);
  await requireMember(eventId, user.id);
  res.json(await service.listTasks(eventId, user.id));
};

export const create = async (req: Request, res: Response) => {
  const { eventId } = ids(req);
  const user = currentUser(req);
  await requireOrganizer(eventId, user.id);
  const { description } = parse(taskBodySchema, req.body);
  res.status(201).json(await service.createTask(eventId, user.id, description));
};

export const update = async (req: Request, res: Response) => {
  const { eventId, taskId } = ids(req);
  const user = currentUser(req);
  await requireOrganizer(eventId, user.id);
  const { description } = parse(taskBodySchema, req.body);
  res.json(await service.updateTask(eventId, taskId!, user.id, description));
};

export const remove = async (req: Request, res: Response) => {
  const { eventId, taskId } = ids(req);
  await requireOrganizer(eventId, currentUser(req).id);
  res.json(await service.deleteTask(eventId, taskId!));
};

export const claim = async (req: Request, res: Response) => {
  const { eventId, taskId } = ids(req);
  const user = currentUser(req);
  await requireMember(eventId, user.id);
  res.json(await service.claimTask(eventId, taskId!, user.id));
};

export const release = async (req: Request, res: Response) => {
  const { eventId, taskId } = ids(req);
  const user = currentUser(req);
  await requireMember(eventId, user.id);
  res.json(await service.releaseTask(eventId, taskId!, user.id));
};
