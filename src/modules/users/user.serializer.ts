import type { User } from '@prisma/client';

/** המידע על המשתמש שמותר להחזיר לו עצמו (בלי passwordHash!) */
export const toPublicUser = (user: User) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export type PublicUser = ReturnType<typeof toPublicUser>;
