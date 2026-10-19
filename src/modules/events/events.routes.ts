import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { expensesRouter } from '../expenses/expenses.routes';
import { eventInvitationsRouter } from '../invitations/invitations.routes';
import { settlementRouter } from '../settlement/settlement.routes';
import { eventSurveyRouter } from '../survey/survey.routes';
import { tasksRouter } from '../tasks/tasks.routes';
import * as controller from './events.controller';

/** /api/events – כל הכתובות דורשות התחברות */
export const eventsRouter = Router();
eventsRouter.use(requireAuth);

eventsRouter.get('/', controller.list);
eventsRouter.post('/', controller.create);
eventsRouter.get('/:eventId', controller.getOne);
eventsRouter.put('/:eventId', controller.update);
eventsRouter.delete('/:eventId', controller.remove);
eventsRouter.post('/:eventId/leave', controller.leave);

eventsRouter.get('/:eventId/participants', controller.participants);
eventsRouter.delete('/:eventId/participants/:userId', controller.removeParticipant);

eventsRouter.use('/:eventId/invitations', eventInvitationsRouter);
eventsRouter.use('/:eventId/tasks', tasksRouter);
eventsRouter.use('/:eventId/survey', eventSurveyRouter);
eventsRouter.use('/:eventId/expenses', expensesRouter);
eventsRouter.use('/:eventId/settlement', settlementRouter);
