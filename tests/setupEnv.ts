/**
 * הבדיקות רצות מול מסד נתונים PostgreSQL אמיתי ונפרד: TEST_DATABASE_URL.
 * (חשוב: לא את מסד הנתונים של הפיתוח – הבדיקות מוחקות את כל הנתונים!)
 */
import 'dotenv/config';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error('חסר TEST_DATABASE_URL בקובץ .env (ראי .env.example)');
}
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-test-secret-test-secret-123';
process.env.BCRYPT_ROUNDS = '4'; // מהיר יותר בבדיקות
