import { z } from 'zod';

export const questionSchema = z
  .object({
    text: z.string().trim().min(2).max(300),
    options: z
      .array(z.string().trim().min(1, 'אפשרות תשובה לא יכולה להיות ריקה').max(200))
      .min(2, 'לכל שאלה נדרשות לפחות 2 אפשרויות תשובה')
      .max(10, 'מותר עד 10 אפשרויות תשובה לשאלה')
      .refine((opts) => new Set(opts.map((o) => o.toLowerCase())).size === opts.length, {
        message: 'אפשרויות התשובה חייבות להיות שונות זו מזו',
      }),
  })
  .strict();

export const questionsListSchema = z.array(questionSchema).max(30, 'מותר עד 30 שאלות בסקר');

export const saveAnswersSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            questionId: z.number().int().positive(),
            optionIds: z.array(z.number().int().positive()).max(10),
          })
          .strict(),
      )
      .max(30),
    note: z
      .string()
      .trim()
      .max(1000)
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .strict();

export type QuestionInput = z.infer<typeof questionSchema>;
export type SaveAnswersInput = z.infer<typeof saveAnswersSchema>;
