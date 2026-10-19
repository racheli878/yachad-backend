import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { idParam, parse } from '../../utils/validate';
import { requireMember, requireOrganizer } from '../events/eventAccess';
import { questionSchema, saveAnswersSchema } from './survey.schemas';
import * as service from './survey.service';

export const get = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  const user = currentUser(req);
  const { event } = await requireMember(eventId, user.id);
  res.json(await service.getSurvey(event, user.id));
};

export const addQuestion = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  const { event } = await requireOrganizer(eventId, currentUser(req).id);
  const input = parse(questionSchema, req.body);
  res.status(201).json(await service.addQuestion(event, input));
};

export const saveAnswers = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  const user = currentUser(req);
  const { event } = await requireMember(eventId, user.id);
  const input = parse(saveAnswersSchema, req.body);
  res.json(await service.saveAnswers(event, user.id, input));
};

export const results = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  const { event } = await requireOrganizer(eventId, currentUser(req).id);
  res.json(await service.getResults(event));
};

export const defaultQuestions = (_req: Request, res: Response) => {
  res.json(service.getDefaultQuestions());
};
