import { Router } from 'express';
import * as controller from './settlement.controller';

/** /api/events/:eventId/settlement */
export const settlementRouter = Router({ mergeParams: true });

settlementRouter.get('/', controller.get);
settlementRouter.post('/calculate', controller.calculate);
