export interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * שגיאה "מתוכננת" שהשרת מחזיר ללקוח בפורמט אחיד:
 * { "error": { "code": "...", "message": "...", "details": [] } }
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details: ErrorDetail[] = []) =>
  new AppError(400, code, message, details);
export const unauthorized = (message = 'יש להתחבר כדי לבצע פעולה זו', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);
export const forbidden = (message = 'אין לך הרשאה לבצע פעולה זו', code = 'FORBIDDEN') =>
  new AppError(403, code, message);
export const notFound = (message = 'המשאב המבוקש לא נמצא', code = 'NOT_FOUND') =>
  new AppError(404, code, message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
