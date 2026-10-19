import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { signToken } from '../../middleware/auth';
import { conflict, notFound, unauthorized } from '../../utils/AppError';
import { toPublicUser } from '../users/user.serializer';
import type { LoginInput, RegisterInput } from './auth.schemas';

export const hashPassword = (password: string) => bcrypt.hash(password, env.BCRYPT_ROUNDS);

/** בודק שהמייל / הטלפון לא תפוסים ע"י משתמש אחר */
export const assertContactAvailable = async (
  data: { email?: string; phone?: string },
  exceptUserId?: number,
) => {
  if (data.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing && existing.id !== exceptUserId) {
      throw conflict('EMAIL_TAKEN', 'כתובת המייל כבר רשומה במערכת');
    }
  }
  if (data.phone) {
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing && existing.id !== exceptUserId) {
      throw conflict('PHONE_TAKEN', 'מספר הטלפון כבר רשום במערכת');
    }
  }
};

export const register = async (input: RegisterInput) => {
  await assertContactAvailable({ email: input.email, phone: input.phone });
  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
    },
  });
  return { token: signToken(user.id), user: toPublicUser(user) };
};

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // אותה הודעה גם למייל שלא קיים וגם לסיסמה שגויה – כדי לא לחשוף אילו מיילים רשומים
  const ok = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !ok) {
    throw unauthorized('מייל או סיסמה שגויים', 'INVALID_CREDENTIALS');
  }
  return { token: signToken(user.id), user: toPublicUser(user) };
};

export const getMe = async (userId: number) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('המשתמש לא נמצא', 'USER_NOT_FOUND');
  return { user: toPublicUser(user) };
};
