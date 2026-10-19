import { z } from 'zod';
import { detectContact, isEmail, normalizeEmail, normalizePhone } from '../../utils/contact';

/**
 * מוזמן אחד. אפשר לשלוח:
 *   { "email": "dana@example.com" }
 *   { "phone": "0521112233" }
 *   { "email": "...", "phone": "..." }
 *   { "contact": "dana@example.com" }  ← השרת מזהה לבד אם זה מייל או טלפון
 */
export const inviteeSchema = z
  .object({
    email: z.string().trim().max(254).optional(),
    phone: z.string().trim().max(30).optional(),
    contact: z.string().trim().max(254).optional(),
  })
  .strict()
  .transform((value, ctx) => {
    let email: string | undefined;
    let phone: string | undefined;

    if (value.email) {
      if (!isEmail(value.email)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'כתובת מייל לא תקינה' });
        return z.NEVER;
      }
      email = normalizeEmail(value.email);
    }
    if (value.phone) {
      const p = normalizePhone(value.phone);
      if (!p) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phone'], message: 'מספר טלפון לא תקין' });
        return z.NEVER;
      }
      phone = p;
    }
    if (value.contact) {
      const detected = detectContact(value.contact);
      if (!detected) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['contact'],
          message: 'יש להזין כתובת מייל או מספר טלפון תקינים',
        });
        return z.NEVER;
      }
      if ('email' in detected) email = email ?? detected.email;
      else phone = phone ?? detected.phone;
    }
    if (!email && !phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'יש להזין מייל או טלפון' });
      return z.NEVER;
    }
    return { email: email ?? null, phone: phone ?? null };
  });

export const inviteesListSchema = z.array(inviteeSchema).max(100);

export const addInvitationsSchema = z
  .object({
    invitees: inviteesListSchema.min(1),
  })
  .strict();

export type Invitee = z.infer<typeof inviteeSchema>;
