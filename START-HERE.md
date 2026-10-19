# 🚀 מתחילים כאן – להעלות את השרת לאינטרנט

המדריך הזה לוקח אותך מקובץ ה־ZIP ועד שרת שעובד באינטרנט, צעד אחר צעד. לא צריך ניסיון קודם.

**מה נעשה:**
1. **GitHub** – מקום לשמור בו את הקוד.
2. **Neon** – מסד נתונים PostgreSQL חינמי בענן.
3. **Render** – שירות שמריץ את השרת באינטרנט, ולוקח את הקוד מ־GitHub.

**כמה זמן:** בערך 30–45 דקות בפעם הראשונה.
**עלות:** 0 ₪. אין צורך בכרטיס אשראי (נכון לאוקטובר 2026).

> ⚠️ **הערה חשובה:** אתרים משנים מדי פעם את העיצוב ואת שמות הכפתורים. כתבתי את שמות הכפתורים כפי שהם בדרך כלל, אבל לא יכולתי לבדוק כל מסך בעצמי. אם כפתור נראה קצת אחרת – חפשי כפתור עם שם דומה. המשמעות נשארת אותו דבר.

---

## לפני שמתחילים: לחלץ את ה־ZIP

1. מצאי את הקובץ `yachad-backend.zip` בתיקיית ההורדות.
2. לחיצה ימנית עליו ← **Extract All...** (חילוץ הכל) ← **Extract**.
3. תיפתח תיקייה בשם `yachad-backend`. בתוכה תראי את `package.json`, `README.md`, התיקיות `src`, `prisma` וכו'.

> אם את רואה תיקייה `yachad-backend` **בתוך** תיקייה `yachad-backend` – היכנסי לפנימית. זו התיקייה שנעבוד איתה.

---

## חלק א – GitHub: לשמור את הקוד

### 1. פתיחת חשבון
1. היכנסי ל־https://github.com
2. לחצי **Sign up**.
3. מלאי מייל, סיסמה ושם משתמש, ואשרי את המייל שתקבלי.

### 2. יצירת Repository (מאגר קוד)
1. אחרי ההתחברות, לחצי על **+** למעלה מימין ← **New repository**.
2. **Repository name:** `yachad-backend`
3. בחרי **Public** או **Private** (שניהם עובדים. Private = רק את רואה את הקוד).
4. **אל תסמני** "Add a README file" (כבר יש לנו אחד).
5. לחצי **Create repository**.

### 3. העלאת הקבצים דרך הדפדפן
1. בדף ה־Repository החדש, לחצי על הקישור **uploading an existing file** (מופיע בטקסט "...or create a new file or **upload an existing file**").
2. פתחי את התיקייה `yachad-backend` במחשב.
3. סמני את **כל מה שבתוך התיקייה** (Ctrl+A) – כולל הקבצים שמתחילים בנקודה, כמו `.gitignore` ו־`.env.example`.
4. גררי את כל מה שסימנת לאזור ההעלאה בדפדפן.

   > ❗ חשוב: גוררים את **התוכן** של התיקייה, לא את התיקייה עצמה. `package.json` צריך להיות בשורש ה־Repository, לא בתוך תת־תיקייה.

5. חכי שכל הקבצים יעלו (יופיעו ברשימה).
6. למטה, בתיבה **Commit changes**, לחצי **Commit changes**.

### 4. בדיקה שהכל עלה
בדף הראשי של ה־Repository צריך לראות:
- את התיקיות: `src`, `prisma`, `tests`, `docs`, `scripts`
- את הקבצים: `package.json`, `package-lock.json`, `render.yaml`, `tsconfig.json`, `README.md`, `.gitignore`

**בדיקה חשובה:** היכנסי ל־`prisma` ← `migrations` ← וודאי שיש שם שתי תיקיות שמתחילות ב־`2026...`. בלעדיהן מסד הנתונים לא ייבנה.

> 🔒 לא אמור להיות קובץ `.env` (רק `.env.example`). אם במקרה העלית `.env` – מחקי אותו מ־GitHub, כי יש בו סודות.

---

## חלק ב – Neon: מסד נתונים חינמי

**למה Neon?** המסלול החינמי שלו לא נמחק אחרי זמן מוגבל. (מסד הנתונים החינמי של Render עצמו נמחק אחרי 30 יום, לכן לא נשתמש בו.)

**המגבלה:** במסלול החינמי המסד "נרדם" אחרי כמה דקות בלי שימוש, ומתעורר לבד בבקשה הבאה. זה תקין לפרויקט לימודי.

### 1. פתיחת חשבון
1. היכנסי ל־https://neon.com (או neon.tech).
2. לחצי **Sign up**. הכי פשוט: **Continue with GitHub** (עם החשבון שפתחת עכשיו).

### 2. יצירת מסד נתונים
1. ייפתח מסך יצירת פרויקט (או לחצי **New Project**).
2. **Project name:** `yachad`
3. **Postgres version:** השאירי את ברירת המחדל.
4. **Region:** בחרי אזור באירופה, למשל **AWS Europe Central (Frankfurt)** – קרוב לישראל ולשרת שנפתח ב־Render.
5. לחצי **Create project**.

### 3. קבלת כתובת החיבור (Connection String)
1. בדף הפרויקט, לחצי על **Connect** (או **Connection Details**).
2. ודאי שהבחירה היא:
   - **Branch:** `main` (או `production`)
   - **Database:** `neondb`
3. אם יש מתג **Connection pooling** – **כבי אותו**. (החיבור הישיר עובד הכי טוב עם הכלי שמנהל את הטבלאות.)
4. העתיקי את הכתובת. היא נראית בערך כך:
   ```
   postgresql://neondb_owner:AbC123xYz@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   אם בכתובת יש את המילה `-pooler` – חזרי לשלב 3 וכבי את ה־pooling.

### 4. לשמור בבטחה
- הכתובת הזו כוללת **סיסמה**. אל תשלחי אותה לאף אחד ואל תעלי אותה ל־GitHub.
- שמרי אותה זמנית בפנקס הרשימות במחשב. נדביק אותה ב־Render בשלב הבא.

---

## חלק ג – Render: להריץ את השרת

### 1. פתיחת חשבון
1. היכנסי ל־https://render.com
2. לחצי **Get Started** / **Sign Up** ← **GitHub** (עם אותו חשבון).
3. אשרי את ההרשאות ש־Render מבקש מ־GitHub.

### 2. יצירת Web Service
1. בלוח הבקרה, לחצי **+ New** (למעלה) ← **Web Service**.
2. תחת **Git Provider** בחרי **GitHub**. אם Render מבקש גישה ל־Repositories – אפשרי גישה (אפשר רק ל־`yachad-backend`).
3. בחרי ברשימה את `yachad-backend` ולחצי **Connect**.

### 3. ההגדרות – מלאי בדיוק כך

| שדה | ערך |
|---|---|
| **Name** | `yachad-backend` (זה יהיה חלק מהכתובת. אם תפוס – הוסיפי משהו, למשל `yachad-backend-rachel`) |
| **Language / Runtime** | `Node` |
| **Branch** | `main` |
| **Region** | `Frankfurt (EU Central)` |
| **Root Directory** | השאירי **ריק** |
| **Build Command** | `npm ci --include=dev && npm run build` |
| **Start Command** | `npm run start:prod` |
| **Instance Type** | **Free** |

> **מה זה עושה?** ה־Build מתקין את החבילות ובונה את הקוד. ה־Start Command מריץ קודם את **Prisma Migrations** (יוצר את הטבלאות במסד הנתונים) ורק אחר כך מפעיל את השרת. כך בכל עדכון קוד, מבנה המסד מתעדכן אוטומטית.

### 4. משתני סביבה (Environment Variables)
גללי למטה ל־**Environment Variables** ולחצי **+ Add Environment Variable** עבור כל שורה:

| NAME | VALUE |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `DATABASE_URL` | הכתובת שהעתקת מ־Neon |
| `JWT_SECRET` | מחרוזת אקראית ארוכה (הסבר מתחת) |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | `http://localhost:5173` (בהמשך תוסיפי את כתובת האתר של ה־React) |

**איך יוצרים `JWT_SECRET`:**
- אם ליד שדה הערך יש כפתור **Generate** – לחצי עליו.
- אחרת, פתחי טרמינל (Command Prompt) במחשב והריצי:
  ```
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
  העתיקי את התוצאה (96 תווים) והדביקי.
- ⚠️ חייב להיות לפחות 32 תווים, אחרת השרת לא יעלה.

### 5. בדיקת בריאות
פתחי **Advanced** והגדירי:
- **Health Check Path:** `/api/health`

### 6. Deploy
1. לחצי **Deploy Web Service** (או **Create Web Service**).
2. ייפתח מסך עם **Logs**. הבנייה לוקחת 3–6 דקות.
3. סימנים שהכל תקין, לפי הסדר:
   - `npm ci` מסיים בלי שגיאות
   - `✔ Generated Prisma Client`
   - `All migrations have been successfully applied` (או `No pending migrations to apply`)
   - `✅ השרת פועל על פורט ...`
   - למעלה יופיע **Live** בירוק 🟢

### 7. הכתובת של השרת
בראש הדף, מתחת לשם השירות, מופיעה כתובת כמו:
```
https://yachad-backend.onrender.com
```
זו ה־**Base URL** של השרת שלך. שמרי אותה – תצטרכי אותה ב־React.

> 💤 **שימי לב:** בשרת חינמי, אחרי 15 דקות בלי פניות השרת "נרדם". הבקשה הראשונה אחרי זה לוקחת עד כדקה. זה תקין.

### (אפשרות נוספת) Blueprint
יש בפרויקט קובץ `render.yaml` עם כל ההגדרות. במקום שלבים 2–5 אפשר: **+ New** ← **Blueprint** ← לבחור את ה־Repository ← למלא רק `DATABASE_URL` ו־`CORS_ORIGIN` ← **Apply**. ה־`JWT_SECRET` ייווצר אוטומטית. שתי הדרכים מגיעות לאותה תוצאה – בחרי אחת.

---

## חלק ד – בדיקה שהכל עובד

החליפי `<הכתובת-שלך>` בכתובת מ־Render.

### 1. בדיקת בריאות
פתחי בדפדפן: `https://<הכתובת-שלך>/api/health`
צריך לראות:
```json
{"status":"ok","database":"up","time":"..."}
```
- `database: "down"` → בעיה ב־`DATABASE_URL` (ראי פתרון תקלות).

### 2. Swagger
פתחי: `https://<הכתובת-שלך>/api-docs`
יופיע דף עם כל ה־Endpoints, מחולקים לפי נושאים.

### 3. הרשמה מתוך Swagger
1. פתחי **2. התחברות ופרופיל** ← `POST /api/auth/register`.
2. לחצי **Try it out**.
3. בתיבה **Request body** כתבי:
   ```json
   { "fullName": "רחל לוי", "email": "rachel@example.com", "phone": "0501234567", "password": "Secret123" }
   ```
4. לחצי **Execute**. למטה, ב־**Server response**, צריך לראות **201**.

### 4. קבלת JWT
אותו דבר עם `POST /api/auth/login`:
```json
{ "email": "rachel@example.com", "password": "Secret123" }
```
בתשובה (200) יש `"token": "eyJ..."`. העתיקי את הערך **בלי המירכאות**.

### 5. Authorize
1. גללי לראש הדף ולחצי על הכפתור **Authorize** 🔓.
2. הדביקי את ה־token (בלי המילה Bearer) ולחצי **Authorize** ← **Close**.
3. המנעול נסגר 🔒 – עכשיו כל הבקשות נשלחות עם ה־token.

### 6. קריאה ל־Endpoint מוגן
`GET /api/auth/me` ← **Try it out** ← **Execute** → **200** עם הפרטים שלך.

**בדיקת 401:** לחצי שוב **Authorize** ← **Logout**, ונסי שוב `GET /api/auth/me` → **401**.

### 7. הוספת רשומה
(אחרי Authorize מחדש) `POST /api/events` ← **Try it out**:
```json
{ "title": "מפגש בדיקה", "category": "FRIENDS", "budget": 300 }
```
**Execute** → **201**. רשמי את ה־`id` מתוך `event` בתשובה.

### 8. שליפת הרשומה ממסד הנתונים
- `GET /api/events` → המפגש מופיע ברשימה.
- `GET /api/events/{eventId}` עם ה־id → פרטי המפגש.
- רענני את הדף, התחברי מחדש ובדקי שוב – המידע נשמר במסד הנתונים ✅

**בדיקת 403:** הירשמי עם משתמש שני, הזמיני אותו למפגש (`POST /api/events/{eventId}/invitations` עם המייל שלו), התחברי איתו, אשרי את ההזמנה (`GET /api/invitations/me` ואז `accept`), ונסי `PUT /api/events/{eventId}` → **403**.

### 9. חיבור ה־React
1. בפרויקט ה־React הגדירי את ה־Base URL לכתובת מ־Render.
2. כשה־React עולה לאינטרנט (למשל ל־Netlify או Vercel), חזרי ל־Render ← השירות ← **Environment** ← ערכי את `CORS_ORIGIN` והוסיפי את הכתובת, מופרדת בפסיק:
   ```
   http://localhost:5173,https://my-yachad.netlify.app
   ```
   (בלי `/` בסוף.) שמירה תפעיל את השרת מחדש.

---

## חלק ה – פתרון תקלות

| תקלה | איך מזהים | פתרון |
|---|---|---|
| **Build Failed** | ב־Logs שגיאה בשלב `npm ci` / `build` | ודאי שה־Build Command הוא בדיוק `npm ci --include=dev && npm run build`. ודאי ש־`package-lock.json` הועלה ל־GitHub ושה־`package.json` בשורש ה־Repository |
| `Cannot find module 'typescript'` / `tsc: not found` | בשלב Build | חסר `--include=dev` ב־Build Command |
| `JWT_SECRET חייב להכיל לפחות 32 תווים` | השרת לא עולה | צרי JWT_SECRET ארוך יותר (חלק ג, שלב 4) |
| `DATABASE_URL חסר` | השרת לא עולה | הוסיפי את המשתנה ב־Environment |
| **DATABASE_URL שגוי** – `P1001: Can't reach database server` / `P1000: Authentication failed` | ב־Logs בזמן Start | העתיקי שוב את הכתובת מ־Neon, כולה, כולל `?sslmode=require`. בלי רווחים ובלי מירכאות |
| **בעיית Prisma** – `P3009` / `migrate found failed migrations` | ב־Start | בדרך כלל אחרי ניסיון שנכשל באמצע. ב־Neon הכי פשוט: למחוק את ה־Branch / Database וליצור חדש (אין בו עדיין נתונים חשובים), לעדכן `DATABASE_URL` ו־**Manual Deploy** |
| `prepared statement already exists` או migrations נתקעות | ב־Start | את משתמשת בחיבור pooled. קחי מ־Neon כתובת **בלי** `-pooler` |
| `No migration found in prisma/migrations` | ב־Start | התיקייה `prisma/migrations` לא הועלתה ל־GitHub. העלי אותה |
| **השרת לא עולה** / `Port scan timeout` | Deploy נכשל אחרי Build מוצלח | בדקי את ה־Logs למעלה מהשגיאה – בדרך כלל אחת מהשורות למעלה (משתנה חסר, מסד לא נגיש). ודאי שה־Start Command הוא `npm run start:prod` |
| `/api/health` מחזיר `database: "down"` | בדפדפן | מסד הנתונים לא נגיש – בדקי `DATABASE_URL`, ושהפרויקט ב־Neon פעיל |
| הבקשה הראשונה לוקחת דקה | – | תקין: השרת החינמי התעורר משינה |
| **שגיאת CORS** בקונסול של הדפדפן (`blocked by CORS policy`) | ב־React | הכתובת של ה־React לא נמצאת ב־`CORS_ORIGIN`. הוסיפי אותה בדיוק (כולל `http/https` ופורט, בלי `/` בסוף) |
| **401** | בכל בקשה | לא נשלח token, או שנשלח לא נכון. הכותרת: `Authorization: Bearer <token>` (רווח אחד). אם עבר שבוע – פג התוקף, התחברי מחדש. ב־Swagger – לחצי שוב Authorize |
| **403** | בפעולה מסוימת | זו פעולה של מארגן בלבד, או על תפקיד / הוצאה של מישהו אחר. התחברי עם המשתמש הנכון |
| **404** על מפגש שקיים | – | המשתמש המחובר לא חבר במפגש (או עוד לא אישר את ההזמנה) |
| **Swagger לא נפתח** | `/api-docs` לא נטען | ודאי שהכתובת היא `/api-docs` (עם מקף), ושהשרת Live. נסי גם `/api-docs.json` |
| Swagger מחזיר `Failed to fetch` | ב־Execute | השרת נרדם / נבנה מחדש. חכי דקה ונסי שוב |

**איפה רואים את ה־Logs ב־Render:** השירות ← **Logs** (בתפריט בצד).
**לפרוס מחדש ידנית:** השירות ← **Manual Deploy** ← **Deploy latest commit**.

---

## עדכון הקוד בהמשך

1. ערכי את הקבצים במחשב.
2. ב־GitHub: היכנסי לתיקייה המתאימה ← **Add file** ← **Upload files** ← גררי את הקבצים ששינית ← **Commit changes**.
3. Render יזהה את השינוי ויפרוס מחדש אוטומטית (בערך 5 דקות).

בהצלחה! 🎉
