import { z } from 'zod';
import { emailSchema, fullNameSchema, passwordSchema, phoneSchema } from '../auth/auth.schemas';

export const updateProfileSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'יש לשלוח לפחות שדה אחד לעדכון' });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'שדה חובה'),
    newPassword: passwordSchema,
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
