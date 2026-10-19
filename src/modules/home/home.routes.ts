import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as controller from './home.controller';

/** /api/home */
export const homeRouter = Router();
homeRouter.get('/', requireAuth, controller.home);
