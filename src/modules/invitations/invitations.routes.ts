import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as controller from './invitations.controller';

/** /api/invitations – ההזמנות של המשתמש המחובר */
export const invitationsRouter = Router();
invitationsRouter.use(requireAuth);
invitationsRouter.get('/me', controller.mine);
invitationsRouter.post('/:invitationId/accept', controller.accept);
invitationsRouter.post('/:invitationId/decline', controller.decline);

/** /api/events/:eventId/invitations – ניהול הזמנות ע"י המארגן */
export const eventInvitationsRouter = Router({ mergeParams: true });
eventInvitationsRouter.post('/', controller.add);
eventInvitationsRouter.get('/', controller.listForEvent);
