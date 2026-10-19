import { z } from 'zod';
import { normalizeEmail, normalizePhone } from '../../utils/contact';

export const fullNameSchema = z.string().trim().min(2).max(80);

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform(normalizeEmail);

export const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'מספר טלפון לא תקין (למשל 0501234567)' });
      return z.NEVER;
    }
    return phone;
  });

export const passwordSchema = z
  .string()
  .min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים')
  .max(72, 'הסיסמה ארוכה מדי (עד 72 תווים)')
  .regex(/[A-Za-z]/, 'הסיסמה חייבת להכיל לפחות אות אחת באנגלית')
  .regex(/\d/, 'הסיסמה חייבת להכיל לפחות ספרה אחת');

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().min(1, 'שדה חובה').transform(normalizeEmail),
    password: z.string().min(1, 'שדה חובה'),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
