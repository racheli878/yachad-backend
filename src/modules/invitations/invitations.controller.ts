import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { idParam, parse } from '../../utils/validate';
import { requireOrganizer } from '../events/eventAccess';
import { addInvitationsSchema } from './invitations.schemas';
import * as service from './invitations.service';

// ----- מארגן: /events/:eventId/invitations -----

export const add = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  const user = currentUser(req);
  await requireOrganizer(eventId, user.id);
  const input = parse(addInvitationsSchema, req.body);
  res.status(201).json(await service.addInvitations(eventId, user.id, input.invitees));
};

export const listForEvent = async (req: Request, res: Response) => {
  const eventId = parse(idParam, req.params.eventId);
  await requireOrganizer(eventId, currentUser(req).id);
  res.json(await service.listEventInvitations(eventId));
};

// ----- מוזמן: /invitations -----

export const mine = async (req: Request, res: Response) => {
  res.json(await service.myPendingInvitations(currentUser(req)));
};

export const accept = async (req: Request, res: Response) => {
  const invitationId = parse(idParam, req.params.invitationId);
  res.json(await service.acceptInvitation(invitationId, currentUser(req)));
};

export const decline = async (req: Request, res: Response) => {
  const invitationId = parse(idParam, req.params.invitationId);
  res.json(await service.declineInvitation(invitationId, currentUser(req)));
};
