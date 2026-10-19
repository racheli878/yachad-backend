import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as controller from './survey.controller';

/** /api/events/:eventId/survey */
export const eventSurveyRouter = Router({ mergeParams: true });
eventSurveyRouter.get('/', controller.get);
eventSurveyRouter.post('/questions', controller.addQuestion);
eventSurveyRouter.put('/answers', controller.saveAnswers);
eventSurveyRouter.get('/results', controller.results);

/** /api/survey – כללי (לא קשור למפגש מסוים) */
export const surveyRouter = Router();
surveyRouter.get('/default-questions', requireAuth, controller.defaultQuestions);
