import 'dotenv/config';
import { execSync } from 'node:child_process';

/** לפני כל הבדיקות: מעדכן את מבנה מסד הנתונים של הבדיקות לפי ה-migrations (לא מוחק כלום). הניקוי נעשה בכל בדיקה בנפרד */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('חסר TEST_DATABASE_URL בקובץ .env (ראי .env.example)');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
