import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';

const send = (res: Response, status: number, code: string, message: string, details: unknown[] = []) =>
  res.status(status).json({ error: { code, message, details } });

/** כתובת שלא קיימת בשרת */
export const notFoundHandler = (req: Request, res: Response) =>
  send(res, 404, 'ROUTE_NOT_FOUND', `הכתובת ${req.method} ${req.originalUrl} לא קיימת בשרת`);

/**
 * מטפל מרכזי בשגיאות – כל שגיאה בשרת מגיעה לכאן והופכת לתשובה בפורמט אחיד.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return send(res, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message }));
    return send(res, 400, 'VALIDATION_ERROR', 'הנתונים שנשלחו אינם תקינים', details);
  }

  // JSON שבור בגוף הבקשה / גוף גדול מדי
  const bodyErr = err as { type?: string; status?: number };
  if (bodyErr?.type === 'entity.parse.failed') {
    return send(res, 400, 'INVALID_JSON', 'גוף הבקשה אינו JSON תקין');
  }
  if (bodyErr?.type === 'entity.too.large') {
    return send(res, 413, 'PAYLOAD_TOO_LARGE', 'הבקשה גדולה מדי');
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return send(res, 409, 'DUPLICATE', 'הערך כבר קיים במערכת');
    }
    if (err.code === 'P2025') {
      return send(res, 404, 'NOT_FOUND', 'המשאב המבוקש לא נמצא');
    }
  }

  console.error('Unexpected error:', err);
  return send(res, 500, 'INTERNAL_ERROR', 'אירעה שגיאה בשרת, נסי שוב מאוחר יותר');
};
