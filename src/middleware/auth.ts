import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { unauthorized } from '../utils/AppError';

export interface AuthUser {
  id: number;
  email: string;
  phone: string;
  fullName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload {
  sub: string;
}

export const signToken = (userId: number): string =>
  jwt.sign({}, env.JWT_SECRET, {
    subject: String(userId),
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

/**
 * מוודא שנשלח Header בפורמט: Authorization: Bearer <token>
 * ושהמשתמש עדיין קיים. זהות המשתמש נקבעת אך ורק לפי ה-Token.
 */
export const requireAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('יש להתחבר כדי לבצע פעולה זו (חסר Token)', 'TOKEN_MISSING');
  }
  const token = header.slice('Bearer '.length).trim();

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw unauthorized('פג תוקף ההתחברות, יש להתחבר מחדש', 'TOKEN_EXPIRED');
    }
    throw unauthorized('ה-Token אינו תקין, יש להתחבר מחדש', 'TOKEN_INVALID');
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) {
    throw unauthorized('ה-Token אינו תקין, יש להתחבר מחדש', 'TOKEN_INVALID');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phone: true, fullName: true },
  });
  if (!user) {
    throw unauthorized('המשתמש לא נמצא, יש להתחבר מחדש', 'TOKEN_INVALID');
  }

  req.user = user;
  next();
};

/** מחזיר את המשתמש המחובר (לשימוש בתוך Controllers שמוגנים ב-requireAuth) */
export const currentUser = (req: Request): AuthUser => {
  if (!req.user) throw unauthorized();
  return req.user;
};
