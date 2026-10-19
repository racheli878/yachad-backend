import { z } from 'zod';

/**
 * בודק נתונים מול סכמת Zod.
 * אם לא תקין – נזרקת ZodError, ו-errorHandler הופך אותה לתשובת 400 מסודרת.
 */
export const parse = <S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> => schema.parse(data);

/** מזהה מספרי בכתובת (למשל :eventId) */
export const idParam = z.coerce
  .number({ invalid_type_error: 'מזהה לא תקין' })
  .int('מזהה לא תקין')
  .positive('מזהה לא תקין');

/** טקסט רשות: מחרוזת ריקה הופכת ל-null */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v === null || v === '' ? null : v));
