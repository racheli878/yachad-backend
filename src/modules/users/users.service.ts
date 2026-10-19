import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma';
import { badRequest } from '../../utils/AppError';
import { assertContactAvailable, hashPassword } from '../auth/auth.service';
import type { ChangePasswordInput, UpdateProfileInput } from './users.schemas';
import { toPublicUser } from './user.serializer';

export const updateProfile = async (userId: number, input: UpdateProfileInput) => {
  await assertContactAvailable({ email: input.email, phone: input.phone }, userId);
  const user = await prisma.user.update({ where: { id: userId }, data: input });
  return { user: toPublicUser(user) };
};

export const changePassword = async (userId: number, input: ChangePasswordInput) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!ok) {
    throw badRequest('WRONG_PASSWORD', 'הסיסמה הנוכחית שגויה', [
      { field: 'currentPassword', message: 'הסיסמה הנוכחית שגויה' },
    ]);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
  return { message: 'הסיסמה עודכנה בהצלחה' };
};
