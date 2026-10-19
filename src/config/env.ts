import 'dotenv/config';
import { z } from 'zod';

/**
 * כל ההגדרות של השרת מגיעות ממשתני סביבה (קובץ .env במחשב, או Environment ב-Render).
 * אם משתנה חובה חסר – השרת לא יעלה ויציג הודעה ברורה.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL חסר – הגדירי את כתובת מסד הנתונים'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET חייב להכיל לפחות 32 תווים'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  /** כתובות מותרות לצד הלקוח, מופרדות בפסיק. * = כולם */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ שגיאה בהגדרות הסביבה (Environment Variables):');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins: string[] | '*' =
  env.CORS_ORIGIN.trim() === '*'
    ? '*'
    : env.CORS_ORIGIN.split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean);
