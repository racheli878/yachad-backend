import { Router } from 'express';
import * as controller from './expenses.controller';

/** /api/events/:eventId/expenses */
export const expensesRouter = Router({ mergeParams: true });

expensesRouter.get('/', controller.list);
expensesRouter.post('/', controller.create);
expensesRouter.put('/:expenseId', controller.update);
expensesRouter.delete('/:expenseId', controller.remove);
