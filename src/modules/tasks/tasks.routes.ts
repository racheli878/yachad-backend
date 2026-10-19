import { Router } from 'express';
import * as controller from './tasks.controller';

/** /api/events/:eventId/tasks */
export const tasksRouter = Router({ mergeParams: true });

tasksRouter.get('/', controller.list);
tasksRouter.post('/', controller.create);
tasksRouter.put('/:taskId', controller.update);
tasksRouter.delete('/:taskId', controller.remove);
tasksRouter.post('/:taskId/claim', controller.claim);
tasksRouter.post('/:taskId/release', controller.release);
