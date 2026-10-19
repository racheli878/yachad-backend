# יחד – שרת לתיאום מפגשים קבוצתיים

שרת (Backend) מלא לפרויקט React: התחברות, מפגשים, הזמנות, סקר, תפקידים, הוצאות והתחשבנות.

> 🟢 **פעם ראשונה? התחילי ב־[START-HERE.md](START-HERE.md)** – הוראות צעד אחר צעד להעלאה לאינטרנט.
> 📘 **כותבת את צד ה־React?** ראי [docs/FRONTEND-API-GUIDE.md](docs/FRONTEND-API-GUIDE.md).

---

## טכנולוגיות

| תחום | כלי |
|---|---|
| שרת | Node.js 22 (LTS) + Express 5 + TypeScript (strict) |
| מסד נתונים | PostgreSQL + Prisma ORM 6 |
| ולידציה | Zod (הודעות שגיאה בעברית) |
| אבטחה | JWT (jsonwebtoken), bcryptjs, helmet, CORS |
| תיעוד | Swagger UI (OpenAPI 3) בכתובת `/api-docs` |
| בדיקות | Vitest + Supertest מול PostgreSQL אמיתי |

---

## הרצה במחשב

**צריך:** Node.js 20.19 ומעלה (מומלץ 22), ו־PostgreSQL (מותקן במחשב, או מסד חינמי בענן כמו Neon).

```bash
# 1. התקנת חבילות
npm install

# 2. הגדרות: העתיקי את .env.example ל-.env ומלאי DATABASE_URL ו-JWT_SECRET
cp .env.example .env        # ב-Windows: copy .env.example .env

# 3. יצירת הטבלאות במסד הנתונים
npm run db:deploy

# 4. נתוני הדגמה (רשות – מוחק נתונים קיימים!)
npm run db:seed

# 5. הפעלה במצב פיתוח (מתעדכן אוטומטית בכל שמירה)
npm run dev
```

ואז לפתוח:
- http://localhost:3000/api/health – בדיקה שהשרת עובד
- http://localhost:3000/api-docs – Swagger

משתמשי ההדגמה (סיסמה `Demo1234!`): `rachel@example.com` (מארגנת), `sara@example.com` (משתתפת), `dana@example.com`, `yossi@example.com`.

## כל הפקודות

| פקודה | מה עושה |
|---|---|
| `npm run dev` | הפעלה בפיתוח |
| `npm run build` | בנייה ל-`dist/` (כולל `prisma generate`) |
| `npm start` | הפעלת הגרסה הבנויה |
| `npm run start:prod` | מריץ migrations ואז מפעיל (זה מה ש-Render מריץ) |
| `npm run typecheck` | בדיקת TypeScript |
| `npm test` | בדיקות אוטומטיות (צריך `TEST_DATABASE_URL` – **מסד נפרד**, הבדיקות מוחקות בו נתונים) |
| `npm run db:migrate` | יצירת migration חדש אחרי שינוי ב-`schema.prisma` (פיתוח בלבד) |
| `npm run db:deploy` | החלת migrations קיימים על המסד |
| `npm run db:seed` | נתוני הדגמה (חסום ב-production) |
| `npm run docs:generate` | עדכון `docs/openapi.json` מהתיעוד שבקוד |

---

## מבנה התיקיות

```
src/
  server.ts              הפעלת השרת
  app.ts                 הגדרת Express: CORS, Swagger, נתיבים, טיפול בשגיאות
  config/env.ts          קריאה ובדיקה של משתני הסביבה
  db/prisma.ts           חיבור למסד הנתונים
  middleware/
    auth.ts              בדיקת JWT (requireAuth) ויצירת Token
    errorHandler.ts      פורמט אחיד לכל השגיאות
  utils/                 כלים: שגיאות, נרמול מייל/טלפון, כסף, ולידציה, הודעות בעברית
  docs/openapi.ts        תיעוד Swagger
  modules/               כל תחום בתיקייה משלו:
    <תחום>.routes.ts       הכתובות (URL)
    <תחום>.controller.ts   קבלת הבקשה, ולידציה, בדיקת הרשאה
    <תחום>.service.ts      הלוגיקה והעבודה מול מסד הנתונים
    <תחום>.schemas.ts      סכמות Zod לוולידציה
    auth, users, home, events, invitations, tasks, survey, expenses, settlement
prisma/
  schema.prisma          מבנה הטבלאות
  migrations/            היסטוריית השינויים במסד
  seed.ts                נתוני הדגמה
tests/                   בדיקות אוטומטיות
docs/
  FRONTEND-API-GUIDE.md  מדריך מלא לצד הלקוח
  openapi.json           קובץ OpenAPI (אפשר לייבא ל-Postman)
render.yaml              הגדרות פריסה ל-Render
```

---

## מסד הנתונים

| טבלה | מה שומרת | קשרים עיקריים |
|---|---|---|
| `User` | משתמשים. מייל וטלפון ייחודיים | – |
| `Event` | **מפגש** – האובייקט המרכזי: שם, תיאור, תאריך, מקום, אוכל, קטגוריה, סוג פעילות, סטטוס, תקציב + נתוני ההתחשבנות האחרונה | `organizerId → User` |
| `EventParticipant` | מי חבר במפגש ובאיזה תפקיד (ORGANIZER / PARTICIPANT). זוג eventId+userId ייחודי | `→ Event` (נמחק עם המפגש), `→ User` |
| `Invitation` | הזמנות לפי מייל ו/או טלפון (גם למי שלא רשום). סטטוס PENDING / ACCEPTED / DECLINED | `→ Event`, `invitedById → User` |
| `Task` | תפקידים. `assigneeId` ריק = פנוי | `→ Event`, `assigneeId → User` |
| `SurveyQuestion` | שאלות סקר | `→ Event` |
| `SurveyOption` | אפשרויות תשובה | `→ SurveyQuestion` |
| `SurveyAnswer` | סימון של משתמש על אפשרות (אפשר כמה בשאלה). optionId+userId ייחודי | `→ SurveyOption`, `→ User` |
| `SurveyResponse` | "הגשה" של משתמש + הערה חופשית למארגן. eventId+userId ייחודי | `→ Event`, `→ User` |
| `Expense` | הוצאות (סכום > 0) | `→ Event`, `paidById → User` |
| `SettlementTransfer` | תוצאת ההתחשבנות: מי מעביר כמה ולמי | `→ Event`, `fromUserId / toUserId → User` |

אילוצים נוספים במסד (CHECK): הזמנה חייבת מייל או טלפון; סכום הוצאה חיובי; תקציב לא שלילי; העברה – סכום חיובי ובין שני אנשים שונים.

---

## הרשאות – איפה זה בקוד

ההרשאות נקבעות **לכל מפגש בנפרד**: מי שיצר מפגש הוא המארגן שלו, ומי שאישר הזמנה הוא משתתף.

| כלל | איפה |
|---|---|
| בדיקת Token בכל בקשה מוגנת | `src/middleware/auth.ts` → `requireAuth` |
| "חבר במפגש" (אחרת 404) / "מארגן בלבד" (אחרת 403) | `src/modules/events/eventAccess.ts` |
| עריכה / מחיקה של תפקיד רק כשהוא פנוי | `src/modules/tasks/tasks.service.ts` → `assertTaskIsFree` |
| שחרור תפקיד רק ע"י מי שלקח אותו | `tasks.service.ts` → `releaseTask` |
| עריכה / מחיקה של הוצאה רק ע"י מי שרשם | `src/modules/expenses/expenses.service.ts` → `findOwnExpense` |
| הסקר פתוח רק בסטטוס PLANNING | `src/modules/survey/survey.service.ts` → `isSurveyOpen` |
| אי אפשר לעזוב / להסיר משתתף עם הוצאות | `src/modules/events/events.service.ts` → `removeMember` |

כל כלל נמצא במקום אחד ומסומן בקוד ב־⭐, כך שקל לשנות אותו אם תחליטי אחרת.

---

## אבטחה

- סיסמאות נשמרות רק כ־Hash של bcrypt. ה־Hash לא מוחזר אף פעם ב־API.
- זהות המשתמש נקבעת רק לפי ה־JWT – לא לפי מזהה שנשלח מהלקוח.
- תוקף Token מוגבל (`JWT_EXPIRES_IN`, ברירת מחדל 7 ימים). `JWT_SECRET` חייב 32 תווים לפחות, אחרת השרת לא עולה.
- מפגש שאינך חברה בו מחזיר 404 (לא חושפים שהוא קיים). מייל של משתתפים אחרים לא מוצג.
- CORS מוגבל לכתובות שב־`CORS_ORIGIN`.
- כל קלט נבדק עם Zod; שדות לא מוכרים נדחים.
- Seed חסום ב־production, כדי שלא ייווצרו חשבונות עם סיסמה ידועה.

---

## בדיקות

```bash
npm test
```

49 בדיקות מול PostgreSQL אמיתי: הרשמה והתחברות, Token חסר / מזויף / שפג תוקפו, הרשאות מארגן ומשתתף, CRUD, ולידציה, חיפוש / סינון / מיון, מניעת גישה למפגשים של אחרים, הזמנות (כולל למי שעוד לא רשום), תפיסת תפקיד במקביל, סקר וסטטיסטיקות, הוצאות ותקציב, אלגוריתם ההתחשבנות, ותקינות Swagger (כל 37 הפעולות מתועדות וקיימות).
