import './utils/zodHebrew';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins } from './config/env';
import { prisma } from './db/prisma';
import { openApiDocument } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { eventsRouter } from './modules/events/events.routes';
import { homeRouter } from './modules/home/home.routes';
import { invitationsRouter } from './modules/invitations/invitations.routes';
import { surveyRouter } from './modules/survey/survey.routes';
import { usersRouter } from './modules/users/users.routes';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1); // Render / שירותי ענן יושבים מאחורי Proxy
  app.disable('x-powered-by');

  // Swagger UI צריך סקריפטים משלו, לכן מבטלים את CSP (זה API, אין כאן דפי HTML אחרים)
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: corsOrigins === '*' ? true : corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '200kb' }));

  // ---------- תיעוד ----------
  app.get('/api-docs.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'יחד – תיעוד API',
      // תיאורים בעברית מוצגים מימין לשמאל
      customCss:
        '.swagger-ui .markdown p, .swagger-ui .markdown li, .swagger-ui .opblock-summary-description, .swagger-ui .opblock-description-wrapper p, .swagger-ui .response-col_description p { direction: rtl; text-align: right; }',
      swaggerOptions: { persistAuthorization: true, docExpansion: 'none', tagsSorter: 'alpha' },
    }),
  );

  app.get('/', (_req, res) => {
    res.json({ name: 'Yachad API', docs: '/api-docs', health: '/api/health' });
  });

  // ---------- API ----------
  const api = express.Router();

  api.get('/health', async (_req: Request, res: Response) => {
    let database: 'up' | 'down' = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    res.status(database === 'up' ? 200 : 503).json({
      status: database === 'up' ? 'ok' : 'error',
      database,
      time: new Date().toISOString(),
    });
  });

  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/home', homeRouter);
  api.use('/events', eventsRouter);
  api.use('/invitations', invitationsRouter);
  api.use('/survey', surveyRouter);

  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
