import { z } from 'zod';

const amountSchema = z
  .number()
  .positive('הסכום חייב להיות גדול מ-0')
  .max(1_000_000)
  .multipleOf(0.01);
const reasonSchema = z.string().trim().min(2).max(200);

export const createExpenseSchema = z.object({ amount: amountSchema, reason: reasonSchema }).strict();
export const updateExpenseSchema = z
  .object({ amount: amountSchema.optional(), reason: reasonSchema.optional() })
  .strict()
  .refine((d) => d.amount !== undefined || d.reason !== undefined, { message: 'יש לשלוח סכום ו/או סיבה' });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
