import { PrismaClient } from '@prisma/client';

/** חיבור יחיד למסד הנתונים, משותף לכל השרת */
export const prisma = new PrismaClient();
