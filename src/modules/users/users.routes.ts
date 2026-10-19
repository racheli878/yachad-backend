import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as controller from './users.controller';

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.put('/me', controller.updateMe);
usersRouter.put('/me/password', controller.changePassword);
