import { z } from 'zod';

/** גוף בקשה ליצירה / עריכה של תפקיד */
export const taskBodySchema = z.object({ description: z.string().trim().min(2).max(200) }).strict();
