/**
 * תיעוד OpenAPI 3 מלא של השרת. מוצג ב-/api-docs ונשמר גם ל-docs/openapi.json
 * (npm run docs:generate).
 */

type Json = Record<string, unknown>;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema: Json) => ({ ...schema, nullable: true });
const str = (extra: Json = {}) => ({ type: 'string', ...extra });
const int = (extra: Json = {}) => ({ type: 'integer', ...extra });
const num = (extra: Json = {}) => ({ type: 'number', ...extra });
const bool = (extra: Json = {}) => ({ type: 'boolean', ...extra });
const arr = (items: Json, extra: Json = {}) => ({ type: 'array', items, ...extra });
const obj = (properties: Json, required: string[] = [], extra: Json = {}) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  ...extra,
});
const dateTime = (extra: Json = {}) => str({ format: 'date-time', ...extra });

const ENUMS = {
  category: ['FAMILY', 'FRIENDS', 'CLASS_COMMUNITY', 'WORK', 'OTHER'],
  activityType: ['BIRTHDAY', 'GATHERING', 'MEAL', 'SPORT', 'TRIP', 'REFRESHMENT', 'HOLIDAY', 'OTHER'],
  status: ['PLANNING', 'SCHEDULED', 'COMPLETED', 'CANCELLED'],
  role: ['ORGANIZER', 'PARTICIPANT'],
  invitationStatus: ['PENDING', 'ACCEPTED', 'DECLINED'],
};

// ---------- פרמטרים ----------
const pathParam = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: int({ minimum: 1 }),
});
const P = {
  eventId: pathParam('eventId', 'מזהה המפגש'),
  userId: pathParam('userId', 'מזהה המשתמש להסרה'),
  invitationId: pathParam('invitationId', 'מזהה ההזמנה'),
  taskId: pathParam('taskId', 'מזהה התפקיד'),
  expenseId: pathParam('expenseId', 'מזהה ההוצאה'),
};
const queryParam = (name: string, description: string, schema: Json) => ({
  name,
  in: 'query',
  required: false,
  description,
  schema,
});

// ---------- תשובות שגיאה ----------
const errorExample = (code: string, message: string, details: unknown[] = []) => ({
  error: { code, message, details },
});
const errorResponse = (description: string, examples: Record<string, [string, string]>) => ({
  description,
  content: {
    'application/json': {
      schema: ref('Error'),
      examples: Object.fromEntries(
        Object.entries(examples).map(([k, [code, message]]) => [k, { value: errorExample(code, message) }]),
      ),
    },
  },
});

const E = {
  400: {
    description: 'נתונים לא תקינים (ולידציה)',
    content: {
      'application/json': {
        schema: ref('Error'),
        example: errorExample('VALIDATION_ERROR', 'הנתונים שנשלחו אינם תקינים', [
          { field: 'title', message: 'נדרשים לפחות 2 תווים' },
        ]),
      },
    },
  },
  401: errorResponse('לא מחובר: חסר Token, Token לא תקין או שפג תוקפו', {
    missing: ['TOKEN_MISSING', 'יש להתחבר כדי לבצע פעולה זו (חסר Token)'],
    invalid: ['TOKEN_INVALID', 'ה-Token אינו תקין, יש להתחבר מחדש'],
    expired: ['TOKEN_EXPIRED', 'פג תוקף ההתחברות, יש להתחבר מחדש'],
  }),
  403: errorResponse('אין הרשאה (למשל: פעולה של מארגן בלבד)', {
    organizerOnly: ['ORGANIZER_ONLY', 'רק מארגן המפגש יכול לבצע פעולה זו'],
  }),
  404: errorResponse('לא נמצא, או שאינך חבר/ה במפגש', {
    event: ['EVENT_NOT_FOUND', 'המפגש לא נמצא או שאינך חברה בו'],
  }),
};
const conflictResponse = (examples: Record<string, [string, string]>) => errorResponse('התנגשות', examples);

// ---------- גוף תשובה ----------
const json = (schema: Json, example?: unknown, description = 'הצלחה') => ({
  description,
  content: { 'application/json': { schema, ...(example !== undefined ? { example } : {}) } },
});
const body = (schema: Json, example?: unknown) => ({
  required: true,
  content: { 'application/json': { schema, ...(example !== undefined ? { example } : {}) } },
});

interface OpDef {
  tag: string;
  summary: string;
  description: string;
  auth?: boolean;
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
}

const op = ({ tag, summary, description, auth = true, parameters, requestBody, responses }: OpDef) => ({
  tags: [tag],
  summary,
  description,
  ...(auth ? { security: [{ bearerAuth: [] }] } : { security: [] }),
  ...(parameters ? { parameters } : {}),
  ...(requestBody ? { requestBody } : {}),
  responses: auth ? { ...responses, 401: E[401] } : responses,
});

const MESSAGE = ref('Message');

// =================== סכמות ===================

const schemas = {
  Error: obj(
    {
      error: obj(
        {
          code: str({ example: 'VALIDATION_ERROR' }),
          message: str({ example: 'הנתונים שנשלחו אינם תקינים' }),
          details: arr(obj({ field: str(), message: str() })),
        },
        ['code', 'message', 'details'],
      ),
    },
    ['error'],
  ),
  Message: obj({ message: str() }, ['message']),

  User: obj(
    {
      id: int({ example: 1 }),
      fullName: str({ example: 'רחל לוי' }),
      email: str({ example: 'rachel@example.com' }),
      phone: str({ example: '0501234567' }),
      createdAt: dateTime(),
      updatedAt: dateTime(),
    },
    ['id', 'fullName', 'email', 'phone'],
  ),
  AuthResponse: obj({ token: str({ description: 'JWT – לשלוח בכל בקשה בכותרת Authorization: Bearer <token>' }), user: ref('User') }, [
    'token',
    'user',
  ]),
  PersonRef: obj({ id: int(), fullName: str() }, ['id', 'fullName']),
  EventRef: obj({ id: int(), title: str() }, ['id', 'title']),
  PersonWithPhone: obj({ id: int(), fullName: str(), phone: str() }, ['id', 'fullName', 'phone']),

  EventListItem: obj({
    id: int(),
    title: str(),
    description: nullable(str()),
    category: str({ enum: ENUMS.category }),
    activityType: str({ enum: ENUMS.activityType }),
    status: str({ enum: ENUMS.status }),
    eventDate: nullable(dateTime()),
    location: nullable(str()),
    myRole: str({ enum: ENUMS.role }),
    participantsCount: int(),
    organizer: ref('PersonRef'),
    createdAt: dateTime(),
  }),
  EventDetails: obj({
    id: int(),
    title: str(),
    description: nullable(str()),
    eventDate: nullable(dateTime()),
    location: nullable(str()),
    food: nullable(str()),
    category: str({ enum: ENUMS.category }),
    activityType: str({ enum: ENUMS.activityType }),
    status: str({ enum: ENUMS.status }),
    budget: nullable(num()),
    organizer: ref('PersonWithPhone'),
    myRole: str({ enum: ENUMS.role }),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
  Participant: obj({
    userId: int(),
    fullName: str(),
    phone: str(),
    role: str({ enum: ENUMS.role }),
    joinedAt: dateTime(),
  }),
  Task: obj({
    id: int(),
    description: str(),
    isTaken: bool(),
    assignee: nullable(ref('PersonRef')),
    isMine: bool({ description: 'האם התפקיד לקוח ע"י המשתמש המחובר' }),
    createdAt: dateTime(),
  }),
  EventPage: obj({
    event: ref('EventDetails'),
    participants: arr(ref('Participant')),
    tasks: arr(ref('Task')),
  }),

  Invitee: obj(
    {
      email: str({ description: 'מייל המוזמן' }),
      phone: str({ description: 'טלפון המוזמן' }),
      contact: str({ description: 'מייל או טלפון – השרת מזהה לבד' }),
    },
    [],
    { description: 'חובה לפחות אחד מהשדות: email, phone, contact' },
  ),
  SkippedInvitee: obj({
    email: nullable(str()),
    phone: nullable(str()),
    reason: str({ enum: ['ALREADY_PARTICIPANT', 'ALREADY_INVITED', 'DUPLICATE_IN_LIST'] }),
    message: str(),
  }),
  OrganizerInvitation: obj({
    id: int(),
    email: nullable(str()),
    phone: nullable(str()),
    status: str({ enum: ENUMS.invitationStatus }),
    createdAt: dateTime(),
    respondedAt: nullable(dateTime()),
    registeredUser: nullable(ref('PersonRef')),
  }),
  MyInvitation: obj({
    id: int(),
    createdAt: dateTime(),
    invitedBy: ref('PersonRef'),
    event: obj({
      id: int(),
      title: str(),
      description: nullable(str()),
      eventDate: nullable(dateTime()),
      location: nullable(str()),
      category: str({ enum: ENUMS.category }),
      activityType: str({ enum: ENUMS.activityType }),
      status: str({ enum: ENUMS.status }),
      budget: nullable(num()),
      participantsCount: int(),
      organizer: ref('PersonRef'),
    }),
  }),

  QuestionInput: obj(
    {
      text: str({ minLength: 2, maxLength: 300, example: 'איפה נוח לכם?' }),
      options: arr(str({ minLength: 1, maxLength: 200 }), { minItems: 2, maxItems: 10, example: ['בית סבא', 'פארק'] }),
    },
    ['text', 'options'],
  ),
  Survey: obj({
    isOpen: bool({ description: 'true כשהמפגש בסטטוס PLANNING – אפשר לענות' }),
    hasResponded: bool(),
    mySubmittedAt: nullable(dateTime()),
    myNote: nullable(str()),
    questions: arr(
      obj({
        id: int(),
        text: str(),
        order: int(),
        options: arr(obj({ id: int(), text: str(), selectedByMe: bool() })),
      }),
    ),
  }),
  SurveyResults: obj({
    isOpen: bool(),
    participantsCount: int(),
    respondentsCount: int(),
    responseRate: num({ description: 'אחוז המשתתפים שענו' }),
    questions: arr(
      obj({
        id: int(),
        text: str(),
        order: int(),
        respondentsCount: int(),
        options: arr(
          obj({
            id: int(),
            text: str(),
            votes: int(),
            percentage: num({ description: 'אחוז מהעונים על השאלה שבחרו באפשרות' }),
            isTop: bool({ description: 'האפשרות שקיבלה הכי הרבה קולות' }),
            voters: arr(ref('PersonRef')),
          }),
        ),
      }),
    ),
    responses: arr(
      obj({
        user: ref('PersonRef'),
        submittedAt: dateTime(),
        updatedAt: dateTime(),
        note: nullable(str()),
        answers: arr(obj({ questionId: int(), optionIds: arr(int()), optionTexts: arr(str()) })),
      }),
    ),
    notResponded: arr(ref('PersonRef')),
  }),

  Expense: obj({
    id: int(),
    amount: num(),
    reason: str(),
    paidBy: ref('PersonRef'),
    isMine: bool({ description: 'האם ההוצאה שלי – רק אז מותר לערוך / למחוק' }),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
  ExpensesSummary: obj({
    budget: nullable(num()),
    total: num(),
    remaining: nullable(num({ description: 'שלילי = חריגה' })),
    percentUsed: nullable(num()),
    isOverBudget: bool(),
    expensesCount: int(),
    myTotal: num(),
    byParticipant: arr(obj({ userId: int(), fullName: str(), total: num() })),
    expenses: arr(ref('Expense')),
  }),
  Settlement: obj({
    calculated: bool(),
    calculatedAt: nullable(dateTime()),
    isOutdated: bool({ description: 'true אם היו שינויים בהוצאות / במשתתפים אחרי החישוב' }),
    total: nullable(num()),
    participantsCount: nullable(int()),
    sharePerPerson: nullable(num()),
    myBalance: nullable(num({ description: 'חיובי = מגיע לי, שלילי = אני חייבת' })),
    balances: arr(obj({ userId: int(), fullName: str(), paid: num(), share: num(), balance: num() })),
    transfers: arr(obj({ id: int(), from: ref('PersonWithPhone'), to: ref('PersonWithPhone'), amount: num() })),
    myTransfers: obj({
      toPay: arr(obj({ id: int(), toUser: ref('PersonWithPhone'), amount: num() })),
      toReceive: arr(obj({ id: int(), fromUser: ref('PersonWithPhone'), amount: num() })),
    }),
  }),
  Home: obj({
    user: ref('PersonRef'),
    upcomingEvents: arr(
      obj({
        id: int(),
        title: str(),
        eventDate: nullable(dateTime()),
        location: nullable(str()),
        status: str({ enum: ENUMS.status }),
        category: str({ enum: ENUMS.category }),
        activityType: str({ enum: ENUMS.activityType }),
        myRole: str({ enum: ENUMS.role }),
      }),
    ),
    pendingInvitationsCount: int(),
    myOpenTasks: arr(obj({ id: int(), description: str(), event: obj({ id: int(), title: str(), eventDate: nullable(dateTime()) }) })),
    money: obj({
      totalToPay: num(),
      totalToReceive: num(),
      toPay: arr(obj({ event: ref('EventRef'), toUser: ref('PersonWithPhone'), amount: num() })),
      toReceive: arr(obj({ event: ref('EventRef'), fromUser: ref('PersonWithPhone'), amount: num() })),
    }),
  }),
};

// =================== דוגמאות ===================

const EX = {
  user: { id: 1, fullName: 'רחל לוי', email: 'rachel@example.com', phone: '0501234567', createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z' },
  eventDetails: {
    id: 12,
    title: 'ארוחת חנוכה משפחתית',
    description: 'מפגש משפחתי שנתי',
    eventDate: null,
    location: null,
    food: 'לביבות',
    category: 'FAMILY',
    activityType: 'MEAL',
    status: 'PLANNING',
    budget: 800,
    organizer: { id: 1, fullName: 'רחל לוי', phone: '0501234567' },
    myRole: 'ORGANIZER',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
};
const eventPageExample = {
  event: EX.eventDetails,
  participants: [
    { userId: 1, fullName: 'רחל לוי', phone: '0501234567', role: 'ORGANIZER', joinedAt: '2026-10-01T10:00:00.000Z' },
    { userId: 2, fullName: 'שרה כהן', phone: '0521112233', role: 'PARTICIPANT', joinedAt: '2026-10-02T09:00:00.000Z' },
  ],
  tasks: [
    { id: 5, description: 'להביא שתייה', isTaken: true, assignee: { id: 2, fullName: 'שרה כהן' }, isMine: false, createdAt: '2026-10-02T09:00:00.000Z' },
    { id: 6, description: 'לקנות כלים חד-פעמיים', isTaken: false, assignee: null, isMine: false, createdAt: '2026-10-02T09:00:00.000Z' },
  ],
};

const eventIdOnly = [P.eventId];
const R = 'הרשאה: ';

// =================== נתיבים ===================

const paths = {
  '/api/health': {
    get: op({
      tag: '1. מערכת',
      summary: 'בדיקת בריאות השרת',
      description: 'בודק שהשרת פועל ושיש חיבור למסד הנתונים. ציבורי. 503 אם אין חיבור למסד.',
      auth: false,
      responses: {
        200: json(obj({ status: str(), database: str(), time: dateTime() }), { status: 'ok', database: 'up', time: '2026-10-19T08:00:00.000Z' }),
        503: json(obj({ status: str(), database: str(), time: dateTime() }), { status: 'error', database: 'down', time: '2026-10-19T08:00:00.000Z' }, 'אין חיבור למסד הנתונים'),
      },
    }),
  },

  // ---------- אימות ----------
  '/api/auth/register': {
    post: op({
      tag: '2. התחברות ופרופיל',
      summary: 'הרשמה',
      description:
        'יצירת חשבון חדש. מחזיר Token ופרטי משתמש (המשתמש מחובר מיד). ' +
        'הטלפון נשמר כספרות בלבד (050-123-4567 → 0501234567). סיסמה: 8+ תווים, אות באנגלית וספרה. ציבורי.',
      auth: false,
      requestBody: body(
        obj(
          {
            fullName: str({ minLength: 2, maxLength: 80 }),
            email: str({ format: 'email' }),
            phone: str({ example: '0501234567' }),
            password: str({ minLength: 8, maxLength: 72 }),
          },
          ['fullName', 'email', 'phone', 'password'],
        ),
        { fullName: 'רחל לוי', email: 'rachel@example.com', phone: '050-123-4567', password: 'Secret123' },
      ),
      responses: {
        201: json(ref('AuthResponse'), { token: 'eyJhbGciOi...', user: EX.user }, 'נוצר חשבון'),
        400: E[400],
        409: conflictResponse({ email: ['EMAIL_TAKEN', 'כתובת המייל כבר רשומה במערכת'], phone: ['PHONE_TAKEN', 'מספר הטלפון כבר רשום במערכת'] }),
      },
    }),
  },
  '/api/auth/login': {
    post: op({
      tag: '2. התחברות ופרופיל',
      summary: 'התחברות',
      description: 'מחזיר Token. העתיקי את ה-token ולחצי על Authorize (למעלה) כדי לבדוק את שאר הכתובות. ציבורי.',
      auth: false,
      requestBody: body(obj({ email: str(), password: str() }, ['email', 'password']), {
        email: 'rachel@example.com',
        password: 'Demo1234!',
      }),
      responses: {
        200: json(ref('AuthResponse'), { token: 'eyJhbGciOi...', user: EX.user }),
        400: E[400],
        401: errorResponse('מייל או סיסמה שגויים', { wrong: ['INVALID_CREDENTIALS', 'מייל או סיסמה שגויים'] }),
      },
    }),
  },
  '/api/auth/me': {
    get: op({
      tag: '2. התחברות ופרופיל',
      summary: 'המשתמש המחובר',
      description: 'מחזיר את פרטי המשתמש לפי ה-Token. שימושי בטעינת האפליקציה לבדיקה אם ה-Token עדיין תקף.',
      responses: { 200: json(obj({ user: ref('User') }), { user: EX.user }) },
    }),
  },
  '/api/users/me': {
    put: op({
      tag: '2. התחברות ופרופיל',
      summary: 'עריכת הפרופיל שלי',
      description: 'עדכון חלקי – שולחים רק את השדות שמשתנים (לפחות אחד).',
      requestBody: body(obj({ fullName: str(), email: str(), phone: str() }), { fullName: 'רחל לוי-כהן' }),
      responses: {
        200: json(obj({ user: ref('User') })),
        400: E[400],
        409: conflictResponse({ email: ['EMAIL_TAKEN', 'כתובת המייל כבר רשומה במערכת'], phone: ['PHONE_TAKEN', 'מספר הטלפון כבר רשום במערכת'] }),
      },
    }),
  },
  '/api/users/me/password': {
    put: op({
      tag: '2. התחברות ופרופיל',
      summary: 'שינוי סיסמה',
      description: 'דורש את הסיסמה הנוכחית. אם היא שגויה – 400 עם הקוד WRONG_PASSWORD.',
      requestBody: body(obj({ currentPassword: str(), newPassword: str({ minLength: 8 }) }, ['currentPassword', 'newPassword']), {
        currentPassword: 'Demo1234!',
        newPassword: 'NewSecret99',
      }),
      responses: { 200: json(MESSAGE, { message: 'הסיסמה עודכנה בהצלחה' }), 400: E[400] },
    }),
  },

  // ---------- דף הבית ----------
  '/api/home': {
    get: op({
      tag: '3. דף הבית',
      summary: 'נתוני דף הבית',
      description:
        'בקריאה אחת: עד 5 מפגשים קרובים, מספר ההזמנות הממתינות, התפקידים שלקחתי במפגשים פעילים, וכמה עליי לשלם / לקבל לפי ההתחשבנויות.',
      responses: {
        200: json(ref('Home'), {
          user: { id: 2, fullName: 'שרה כהן' },
          upcomingEvents: [{ id: 12, title: 'ארוחת חנוכה', eventDate: '2026-12-15T18:00:00.000Z', location: 'בית סבא', status: 'SCHEDULED', category: 'FAMILY', activityType: 'MEAL', myRole: 'PARTICIPANT' }],
          pendingInvitationsCount: 2,
          myOpenTasks: [{ id: 5, description: 'להביא שתייה', event: { id: 12, title: 'ארוחת חנוכה', eventDate: '2026-12-15T18:00:00.000Z' } }],
          money: { totalToPay: 80, totalToReceive: 0, toPay: [{ event: { id: 12, title: 'ארוחת חנוכה' }, toUser: { id: 1, fullName: 'רחל לוי', phone: '0501234567' }, amount: 80 }], toReceive: [] },
        }),
      },
    }),
  },

  // ---------- מפגשים ----------
  '/api/events': {
    get: op({
      tag: '4. מפגשים',
      summary: 'המפגשים שלי (חיפוש, סינון, מיון)',
      description:
        'בלי פרמטרים – מחזיר את **כל** המפגשים שאני מארגנת או משתתפת בהם, ממוינים לפי תאריך המפגש (מפגשים בלי תאריך בסוף). ' +
        'כל פרמטר מצמצם את התוצאה. timeframe=upcoming: בתכנון/נקבע ותאריך שלא עבר (או בלי תאריך). timeframe=past: כל השאר.',
      parameters: [
        queryParam('search', 'חיפוש חלקי בשם המפגש (לא תלוי באותיות גדולות/קטנות)', str()),
        queryParam('category', 'סינון לפי קטגוריה', str({ enum: ENUMS.category })),
        queryParam('activityType', 'סינון לפי סוג פעילות', str({ enum: ENUMS.activityType })),
        queryParam('status', 'סינון לפי סטטוס', str({ enum: ENUMS.status })),
        queryParam('myRole', 'ORGANIZER = מפגשים שאני מארגנת, PARTICIPANT = שאני משתתפת', str({ enum: ENUMS.role })),
        queryParam('timeframe', 'קרובים / שעברו / הכל', str({ enum: ['upcoming', 'past', 'all'], default: 'all' })),
        queryParam('sortBy', 'שדה המיון', str({ enum: ['eventDate', 'createdAt'], default: 'eventDate' })),
        queryParam('sortOrder', 'כיוון המיון', str({ enum: ['asc', 'desc'], default: 'asc' })),
      ],
      responses: {
        200: json(obj({ count: int(), events: arr(ref('EventListItem')) }), {
          count: 1,
          events: [{ id: 12, title: 'ארוחת חנוכה', description: null, category: 'FAMILY', activityType: 'MEAL', status: 'SCHEDULED', eventDate: '2026-12-15T18:00:00.000Z', location: 'בית סבא', myRole: 'ORGANIZER', participantsCount: 6, organizer: { id: 1, fullName: 'רחל לוי' }, createdAt: '2026-10-01T10:00:00.000Z' }],
        }),
        400: E[400],
      },
    }),
    post: op({
      tag: '4. מפגשים',
      summary: 'יצירת מפגש (אשף מלא בקריאה אחת)',
      description:
        'כל משתמש מחובר יכול ליצור מפגש, והיוצר הופך למארגן. חובה רק title. ' +
        'invitees: רשימת מוזמנים (מייל/טלפון). questions: שאלות הסקר. הכל נשמר יחד – אם משהו לא תקין, שום דבר לא נשמר. ' +
        'מוזמן כפול / שכבר משתתף לא מקבל הזמנה ומופיע ב-invitationsSummary.skipped.',
      requestBody: body(
        obj(
          {
            title: str({ minLength: 2, maxLength: 100 }),
            description: nullable(str({ maxLength: 1000 })),
            eventDate: nullable(dateTime()),
            location: nullable(str({ maxLength: 200 })),
            food: nullable(str({ maxLength: 500 })),
            category: str({ enum: ENUMS.category, default: 'OTHER' }),
            activityType: str({ enum: ENUMS.activityType, default: 'OTHER' }),
            status: str({ enum: ENUMS.status, default: 'PLANNING' }),
            budget: nullable(num({ minimum: 0, maximum: 1000000 })),
            invitees: arr(ref('Invitee'), { maxItems: 100 }),
            questions: arr(ref('QuestionInput'), { maxItems: 30 }),
          },
          ['title'],
        ),
        {
          title: 'ארוחת חנוכה משפחתית',
          description: 'מפגש משפחתי שנתי',
          category: 'FAMILY',
          activityType: 'MEAL',
          budget: 800,
          invitees: [{ email: 'sara@example.com' }, { phone: '0521112233' }, { contact: 'dana@example.com' }],
          questions: [
            { text: 'איפה נוח לכם?', options: ['בית סבא', 'פארק'] },
            { text: 'מתי נוח לכם?', options: ['15.12', '16.12'] },
          ],
        },
      ),
      responses: {
        201: json(
          {
            allOf: [
              ref('EventPage'),
              obj({
                invitationsSummary: obj({ createdCount: int(), skippedCount: int(), skipped: arr(ref('SkippedInvitee')) }),
                questionsCount: int(),
              }),
            ],
          },
          { ...eventPageExample, invitationsSummary: { createdCount: 3, skippedCount: 0, skipped: [] }, questionsCount: 2 },
          'המפגש נוצר',
        ),
        400: E[400],
      },
    }),
  },
  '/api/events/{eventId}': {
    get: op({
      tag: '4. מפגשים',
      summary: 'דף מפגש',
      description: R + 'חבר/ה במפגש (מארגן או משתתף). מחזיר פרטי מפגש, משתתפים מאושרים ותפקידים. מי שלא חבר מקבל 404.',
      parameters: eventIdOnly,
      responses: { 200: json(ref('EventPage'), eventPageExample), 400: E[400], 404: E[404] },
    }),
    put: op({
      tag: '4. מפגשים',
      summary: 'עריכת מפגש (כולל סטטוס)',
      description:
        R + 'מארגן בלבד. עדכון חלקי – שולחים רק את מה שמשתנה. null מרוקן שדה רשות (למשל "location": null). ' +
        'כך המארגן קובע את פרטי המפגש לפי תוצאות הסקר, ומשנה סטטוס (SCHEDULED סוגר את הסקר).',
      parameters: eventIdOnly,
      requestBody: body(
        obj({
          title: str(),
          description: nullable(str()),
          eventDate: nullable(dateTime()),
          location: nullable(str()),
          food: nullable(str()),
          category: str({ enum: ENUMS.category }),
          activityType: str({ enum: ENUMS.activityType }),
          status: str({ enum: ENUMS.status }),
          budget: nullable(num()),
        }),
        { eventDate: '2026-12-15T18:00:00.000Z', location: 'בית סבא', status: 'SCHEDULED' },
      ),
      responses: { 200: json(obj({ event: ref('EventDetails') }), { event: EX.eventDetails }), 400: E[400], 403: E[403], 404: E[404] },
    }),
    delete: op({
      tag: '4. מפגשים',
      summary: 'מחיקת מפגש',
      description: R + 'מארגן בלבד. מוחק את המפגש וכל מה שקשור אליו (הזמנות, תפקידים, סקר, הוצאות).',
      parameters: eventIdOnly,
      responses: { 200: json(MESSAGE, { message: 'המפגש נמחק' }), 403: E[403], 404: E[404] },
    }),
  },
  '/api/events/{eventId}/leave': {
    post: op({
      tag: '4. מפגשים',
      summary: 'עזיבת מפגש',
      description:
        R + 'משתתף (לא מארגן). התפקידים שלי מתפנים ותשובות הסקר שלי נמחקות. ' +
        'אם רשמתי הוצאות – 409 HAS_EXPENSES (צריך למחוק אותן קודם).',
      parameters: eventIdOnly,
      responses: {
        200: json(MESSAGE, { message: 'עזבת את המפגש' }),
        403: errorResponse('המארגן לא יכול לעזוב', { organizer: ['ORGANIZER_CANNOT_LEAVE', 'המארגן לא יכול לעזוב את המפגש. אפשר למחוק את המפגש במקום זאת'] }),
        404: E[404],
        409: conflictResponse({ expenses: ['HAS_EXPENSES', 'למשתתף יש הוצאות רשומות במפגש. יש למחוק אותן קודם'] }),
      },
    }),
  },

  // ---------- משתתפים והזמנות ----------
  '/api/events/{eventId}/participants': {
    get: op({
      tag: '5. משתתפים והזמנות',
      summary: 'משתתפים מאושרים',
      description: R + 'חבר/ה במפגש. רק מי שאישר הזמנה (והמארגן). שם וטלפון – בלי מייל.',
      parameters: eventIdOnly,
      responses: { 200: json(obj({ count: int(), participants: arr(ref('Participant')) }), { count: 2, participants: eventPageExample.participants }), 404: E[404] },
    }),
  },
  '/api/events/{eventId}/participants/{userId}': {
    delete: op({
      tag: '5. משתתפים והזמנות',
      summary: 'הסרת משתתף',
      description: R + 'מארגן בלבד. התפקידים של המשתתף מתפנים ותשובות הסקר שלו נמחקות. משתתף עם הוצאות – 409.',
      parameters: [P.eventId, P.userId],
      responses: {
        200: json(MESSAGE, { message: 'המשתתף הוסר מהמפגש' }),
        400: errorResponse('ניסיון להסיר את המארגן', { self: ['CANNOT_REMOVE_ORGANIZER', 'המארגן לא יכול להסיר את עצמו מהמפגש'] }),
        403: E[403],
        404: errorResponse('המפגש או המשתתף לא נמצאו', { participant: ['PARTICIPANT_NOT_FOUND', 'המשתמש אינו משתתף במפגש'] }),
        409: conflictResponse({ expenses: ['HAS_EXPENSES', 'למשתתף יש הוצאות רשומות במפגש. יש למחוק אותן קודם'] }),
      },
    }),
  },
  '/api/events/{eventId}/invitations': {
    get: op({
      tag: '5. משתתפים והזמנות',
      summary: 'כל ההזמנות של המפגש',
      description: R + 'מארגן בלבד. כולל ממתינות, מאושרות ונדחו. registeredUser = המשתמש הרשום שתואם להזמנה (אם יש).',
      parameters: eventIdOnly,
      responses: {
        200: json(
          obj({ count: int(), pendingCount: int(), acceptedCount: int(), declinedCount: int(), invitations: arr(ref('OrganizerInvitation')) }),
          {
            count: 2,
            pendingCount: 1,
            acceptedCount: 1,
            declinedCount: 0,
            invitations: [
              { id: 7, email: 'dana@example.com', phone: null, status: 'PENDING', createdAt: '2026-10-02T09:00:00.000Z', respondedAt: null, registeredUser: { id: 3, fullName: 'דנה' } },
              { id: 6, email: null, phone: '0521112233', status: 'ACCEPTED', createdAt: '2026-10-02T09:00:00.000Z', respondedAt: '2026-10-03T09:00:00.000Z', registeredUser: { id: 2, fullName: 'שרה כהן' } },
            ],
          },
        ),
        403: E[403],
        404: E[404],
      },
    }),
    post: op({
      tag: '5. משתתפים והזמנות',
      summary: 'הוספת מוזמנים',
      description:
        R + 'מארגן בלבד. אפשר להזמין גם מי שעוד לא רשום – ההזמנה תופיע לו ברגע שיירשם עם אותו מייל/טלפון. ' +
        'מי שכבר משתתף / כבר הוזמן – מופיע ב-skipped ולא מקבל הזמנה כפולה.',
      parameters: eventIdOnly,
      requestBody: body(obj({ invitees: arr(ref('Invitee'), { minItems: 1, maxItems: 100 }) }, ['invitees']), {
        invitees: [{ contact: 'yossi@example.com' }, { phone: '054-777-8888' }],
      }),
      responses: {
        201: json(obj({ createdCount: int(), skippedCount: int(), created: arr(ref('OrganizerInvitation')), skipped: arr(ref('SkippedInvitee')) }), {
          createdCount: 1,
          skippedCount: 1,
          created: [{ id: 9, email: 'yossi@example.com', phone: null, status: 'PENDING', createdAt: '2026-10-05T09:00:00.000Z', respondedAt: null, registeredUser: null }],
          skipped: [{ email: null, phone: '0547778888', reason: 'ALREADY_INVITED', message: 'כבר נשלחה לאדם הזמנה שממתינה לתשובה' }],
        }),
        400: E[400],
        403: E[403],
        404: E[404],
      },
    }),
  },
  '/api/invitations/me': {
    get: op({
      tag: '5. משתתפים והזמנות',
      summary: 'ההזמנות הממתינות שלי',
      description: 'הזמנות שהמייל או הטלפון שלי תואמים להן, עם פרטים בסיסיים של המפגש. הזמנה אחת לכל מפגש. החדשות ראשונות. הזמנות למפגשים שהסתיימו או בוטלו לא מוצגות.',
      responses: {
        200: json(obj({ count: int(), invitations: arr(ref('MyInvitation')) }), {
          count: 1,
          invitations: [
            {
              id: 7,
              createdAt: '2026-10-02T09:00:00.000Z',
              invitedBy: { id: 1, fullName: 'רחל לוי' },
              event: { id: 12, title: 'ארוחת חנוכה', description: null, eventDate: null, location: null, category: 'FAMILY', activityType: 'MEAL', status: 'PLANNING', budget: 800, participantsCount: 3, organizer: { id: 1, fullName: 'רחל לוי' } },
            },
          ],
        }),
      },
    }),
  },
  '/api/invitations/{invitationId}/accept': {
    post: op({
      tag: '5. משתתפים והזמנות',
      summary: 'אישור הזמנה',
      description: R + 'רק המוזמן (המייל/טלפון שלו תואמים). אחרי האישור דף המפגש פתוח עבורו. השתמשי ב-eventId שחוזר כדי לנווט לדף המפגש.',
      parameters: [P.invitationId],
      responses: {
        200: json(obj({ message: str(), eventId: int() }), { message: 'ההזמנה אושרה, הצטרפת למפגש', eventId: 12 }),
        404: errorResponse('ההזמנה לא נמצאה, לא שלך, או שכבר נענתה', { notFound: ['INVITATION_NOT_FOUND', 'ההזמנה לא נמצאה או שכבר נענתה'] }),
        409: conflictResponse({
          already: ['ALREADY_PARTICIPANT', 'את כבר משתתפת במפגש הזה'],
          closed: ['EVENT_CLOSED', 'המפגש כבר הסתיים או בוטל, ולכן אי אפשר להצטרף אליו'],
        }),
      },
    }),
  },
  '/api/invitations/{invitationId}/decline': {
    post: op({
      tag: '5. משתתפים והזמנות',
      summary: 'דחיית הזמנה',
      description: R + 'רק המוזמן. ההזמנה מסומנת "נדחתה" והמארגן רואה זאת. המארגן יכול להזמין שוב בהמשך.',
      parameters: [P.invitationId],
      responses: {
        200: json(obj({ message: str(), eventId: int() }), { message: 'ההזמנה נדחתה', eventId: 12 }),
        404: errorResponse('ההזמנה לא נמצאה, לא שלך, או שכבר נענתה', { notFound: ['INVITATION_NOT_FOUND', 'ההזמנה לא נמצאה או שכבר נענתה'] }),
      },
    }),
  },

  // ---------- תפקידים ----------
  '/api/events/{eventId}/tasks': {
    get: op({
      tag: '6. תפקידים',
      summary: 'רשימת תפקידים',
      description: R + 'חבר/ה במפגש. assignee=null פירושו תפקיד פנוי.',
      parameters: eventIdOnly,
      responses: { 200: json(obj({ count: int(), openCount: int(), tasks: arr(ref('Task')) }), { count: 2, openCount: 1, tasks: eventPageExample.tasks }), 404: E[404] },
    }),
    post: op({
      tag: '6. תפקידים',
      summary: 'יצירת תפקיד',
      description: R + 'מארגן בלבד.',
      parameters: eventIdOnly,
      requestBody: body(obj({ description: str({ minLength: 2, maxLength: 200 }) }, ['description']), { description: 'להביא שתייה' }),
      responses: { 201: json(obj({ task: ref('Task') })), 400: E[400], 403: E[403], 404: E[404] },
    }),
  },
  '/api/events/{eventId}/tasks/{taskId}': {
    put: op({
      tag: '6. תפקידים',
      summary: 'עריכת תפקיד פנוי',
      description: R + 'מארגן בלבד, ורק תפקיד שעדיין פנוי. תפקיד שנלקח – 409 TASK_TAKEN.',
      parameters: [P.eventId, P.taskId],
      requestBody: body(obj({ description: str() }, ['description']), { description: 'להביא שתייה קלה' }),
      responses: {
        200: json(obj({ task: ref('Task') })),
        400: E[400],
        403: E[403],
        404: E[404],
        409: conflictResponse({ taken: ['TASK_TAKEN', 'אי אפשר לשנות או למחוק תפקיד שכבר נלקח'] }),
      },
    }),
    delete: op({
      tag: '6. תפקידים',
      summary: 'מחיקת תפקיד פנוי',
      description: R + 'מארגן בלבד, ורק תפקיד שעדיין פנוי.',
      parameters: [P.eventId, P.taskId],
      responses: {
        200: json(MESSAGE, { message: 'התפקיד נמחק' }),
        403: E[403],
        404: E[404],
        409: conflictResponse({ taken: ['TASK_TAKEN', 'אי אפשר לשנות או למחוק תפקיד שכבר נלקח'] }),
      },
    }),
  },
  '/api/events/{eventId}/tasks/{taskId}/claim': {
    post: op({
      tag: '6. תפקידים',
      summary: 'לקיחת תפקיד פנוי',
      description: R + 'חבר/ה במפגש. פעולה אטומית – אם שניים לוקחים באותו רגע, רק אחד מצליח והשני מקבל 409.',
      parameters: [P.eventId, P.taskId],
      responses: {
        200: json(obj({ task: ref('Task') })),
        404: E[404],
        409: conflictResponse({ taken: ['TASK_ALREADY_TAKEN', 'התפקיד כבר נלקח ע"י משתתף אחר'], mine: ['TASK_ALREADY_MINE', 'התפקיד כבר שלך'] }),
      },
    }),
  },
  '/api/events/{eventId}/tasks/{taskId}/release': {
    post: op({
      tag: '6. תפקידים',
      summary: 'שחרור תפקיד שלי',
      description: R + 'רק מי שלקח את התפקיד (גם המארגן משחרר רק את שלו).',
      parameters: [P.eventId, P.taskId],
      responses: {
        200: json(obj({ task: ref('Task') })),
        403: errorResponse('התפקיד לא שלך', { notYours: ['NOT_YOUR_TASK', 'אפשר לשחרר רק תפקיד שלקחת בעצמך'] }),
        404: E[404],
        409: conflictResponse({ free: ['TASK_NOT_TAKEN', 'התפקיד כבר פנוי'] }),
      },
    }),
  },

  // ---------- סקר ----------
  '/api/survey/default-questions': {
    get: op({
      tag: '7. סקר',
      summary: 'שאלות פתיחה מוכנות',
      description: 'שאלות בסיסיות למילוי שלב הסקר באשף. שאלה עם options ריק – המארגן משלים לפחות 2 תשובות לפני השליחה.',
      responses: {
        200: json(obj({ questions: arr(obj({ text: str(), options: arr(str()) })) }), {
          questions: [
            { text: 'איפה נוח לכם להיפגש?', options: [] },
            { text: 'באיזה תאריך נוח לכם?', options: [] },
            { text: 'באיזו שעה נוח לכם?', options: ['בבוקר', 'בצהריים', 'בערב'] },
            { text: 'מה תעדיפו לאכול?', options: ['חלבי', 'בשרי', 'פרווה'] },
          ],
        }),
      },
    }),
  },
  '/api/events/{eventId}/survey': {
    get: op({
      tag: '7. סקר',
      summary: 'הסקר + התשובות שלי',
      description: R + 'חבר/ה במפגש. selectedByMe מסמן מה סימנתי. isOpen=false כשהמפגש כבר לא בתכנון.',
      parameters: eventIdOnly,
      responses: {
        200: json(ref('Survey'), {
          isOpen: true,
          hasResponded: true,
          mySubmittedAt: '2026-10-03T09:00:00.000Z',
          myNote: 'אני מגיעה רק אחרי 19:00',
          questions: [{ id: 1, text: 'באיזה תאריך נוח לך?', order: 1, options: [{ id: 10, text: '15.12', selectedByMe: true }, { id: 11, text: '16.12', selectedByMe: false }] }],
        }),
        404: E[404],
      },
    }),
  },
  '/api/events/{eventId}/survey/questions': {
    post: op({
      tag: '7. סקר',
      summary: 'הוספת שאלה לסקר',
      description: R + 'מארגן בלבד, וכשהסקר פתוח. אין עריכה / מחיקה של שאלות קיימות.',
      parameters: eventIdOnly,
      requestBody: body(ref('QuestionInput'), { text: 'מה להביא?', options: ['עוגה', 'סלט', 'שתייה'] }),
      responses: {
        201: json(obj({ question: obj({ id: int(), text: str(), order: int(), options: arr(obj({ id: int(), text: str() })) }) })),
        400: E[400],
        403: E[403],
        404: E[404],
        409: conflictResponse({ closed: ['SURVEY_CLOSED', 'הסקר סגור, כי המפגש כבר אינו בסטטוס "בתכנון"'] }),
      },
    }),
  },
  '/api/events/{eventId}/survey/answers': {
    put: op({
      tag: '7. סקר',
      summary: 'שמירה / עריכה של התשובות שלי',
      description:
        R + 'חבר/ה במפגש, כשהסקר פתוח. מחליף לגמרי את התשובות הקודמות. אפשר לסמן כמה אפשרויות בכל שאלה. ' +
        'note = הערה חופשית למארגן (רק המארגן רואה). מחזיר את הסקר המעודכן.',
      parameters: eventIdOnly,
      requestBody: body(
        obj(
          {
            answers: arr(obj({ questionId: int(), optionIds: arr(int()) }, ['questionId', 'optionIds'])),
            note: nullable(str({ maxLength: 1000 })),
          },
          ['answers'],
        ),
        { answers: [{ questionId: 1, optionIds: [10, 11] }], note: 'אני מגיעה רק אחרי 19:00' },
      ),
      responses: {
        200: json(ref('Survey')),
        400: E[400],
        404: E[404],
        409: conflictResponse({ closed: ['SURVEY_CLOSED', 'הסקר סגור, כי המפגש כבר אינו בסטטוס "בתכנון"'] }),
      },
    }),
  },
  '/api/events/{eventId}/survey/results': {
    get: op({
      tag: '7. סקר',
      summary: 'תוצאות וסטטיסטיקות',
      description:
        R + 'מארגן בלבד. questions = סטטיסטיקה לכל אפשרות. responses = טבלה מפורטת: כל משתתף, מה בחר, וההערה שלו. ' +
        'notResponded = מי עוד לא ענה. האחוזים בשאלה יכולים להסתכם ביותר מ-100% כי אפשר לבחור כמה תשובות.',
      parameters: eventIdOnly,
      responses: {
        200: json(ref('SurveyResults'), {
          isOpen: true,
          participantsCount: 6,
          respondentsCount: 4,
          responseRate: 66.7,
          questions: [
            {
              id: 1,
              text: 'איפה נוח לכם?',
              order: 1,
              respondentsCount: 4,
              options: [
                { id: 10, text: 'בית סבא', votes: 3, percentage: 75, isTop: true, voters: [{ id: 2, fullName: 'שרה כהן' }] },
                { id: 11, text: 'פארק', votes: 1, percentage: 25, isTop: false, voters: [{ id: 3, fullName: 'דנה' }] },
              ],
            },
          ],
          responses: [
            { user: { id: 2, fullName: 'שרה כהן' }, submittedAt: '2026-10-03T09:00:00.000Z', updatedAt: '2026-10-03T09:00:00.000Z', note: 'אני מגיעה רק אחרי 19:00', answers: [{ questionId: 1, optionIds: [10], optionTexts: ['בית סבא'] }] },
          ],
          notResponded: [{ id: 5, fullName: 'יוסי' }],
        }),
        403: E[403],
        404: E[404],
      },
    }),
  },

  // ---------- הוצאות והתחשבנות ----------
  '/api/events/{eventId}/expenses': {
    get: op({
      tag: '8. הוצאות והתחשבנות',
      summary: 'הוצאות ומצב מול התקציב',
      description: R + 'חבר/ה במפגש. אם לא הוגדר תקציב: budget, remaining, percentUsed הם null.',
      parameters: eventIdOnly,
      responses: {
        200: json(ref('ExpensesSummary'), {
          budget: 800,
          total: 650,
          remaining: 150,
          percentUsed: 81.25,
          isOverBudget: false,
          expensesCount: 2,
          myTotal: 400,
          byParticipant: [{ userId: 1, fullName: 'רחל לוי', total: 400 }, { userId: 2, fullName: 'שרה כהן', total: 250 }],
          expenses: [{ id: 3, amount: 250, reason: 'שתייה', paidBy: { id: 2, fullName: 'שרה כהן' }, isMine: false, createdAt: '2026-10-04T09:00:00.000Z', updatedAt: '2026-10-04T09:00:00.000Z' }],
        }),
        404: E[404],
      },
    }),
    post: op({
      tag: '8. הוצאות והתחשבנות',
      summary: 'רישום הוצאה',
      description: R + 'חבר/ה במפגש. ההוצאה נרשמת על שם המשתמש המחובר (לפי ה-Token). סכום: גדול מ-0, עד 2 ספרות אחרי הנקודה.',
      parameters: eventIdOnly,
      requestBody: body(obj({ amount: num({ exclusiveMinimum: 0, maximum: 1000000 }), reason: str({ minLength: 2, maxLength: 200 }) }, ['amount', 'reason']), {
        amount: 120.5,
        reason: 'כלים חד-פעמיים',
      }),
      responses: { 201: json(obj({ expense: ref('Expense') })), 400: E[400], 404: E[404] },
    }),
  },
  '/api/events/{eventId}/expenses/{expenseId}': {
    put: op({
      tag: '8. הוצאות והתחשבנות',
      summary: 'עריכת הוצאה שלי',
      description: R + 'רק מי שרשם את ההוצאה (גם המארגן – רק את שלו).',
      parameters: [P.eventId, P.expenseId],
      requestBody: body(obj({ amount: num(), reason: str() }), { amount: 130 }),
      responses: {
        200: json(obj({ expense: ref('Expense') })),
        400: E[400],
        403: errorResponse('לא ההוצאה שלך', { notYours: ['NOT_YOUR_EXPENSE', 'אפשר לערוך או למחוק רק הוצאה שרשמת בעצמך'] }),
        404: E[404],
      },
    }),
    delete: op({
      tag: '8. הוצאות והתחשבנות',
      summary: 'מחיקת הוצאה שלי',
      description: R + 'רק מי שרשם את ההוצאה.',
      parameters: [P.eventId, P.expenseId],
      responses: {
        200: json(MESSAGE, { message: 'ההוצאה נמחקה' }),
        403: errorResponse('לא ההוצאה שלך', { notYours: ['NOT_YOUR_EXPENSE', 'אפשר לערוך או למחוק רק הוצאה שרשמת בעצמך'] }),
        404: E[404],
      },
    }),
  },
  '/api/events/{eventId}/settlement/calculate': {
    post: op({
      tag: '8. הוצאות והתחשבנות',
      summary: 'חישוב התחשבנות',
      description:
        R + 'מארגן בלבד. מחלק את סך ההוצאות שווה בשווה בין כל המשתתפים (כולל המארגן), ושומר רשימת העברות מינימלית. ' +
        'מחליף חישוב קודם. מחזיר את אותו מבנה כמו GET /settlement.',
      parameters: eventIdOnly,
      responses: { 200: json(ref('Settlement')), 403: E[403], 404: E[404] },
    }),
  },
  '/api/events/{eventId}/settlement': {
    get: op({
      tag: '8. הוצאות והתחשבנות',
      summary: 'תוצאת ההתחשבנות',
      description: R + 'חבר/ה במפגש. calculated=false אם עוד לא חושב. isOutdated=true אם היו שינויים אחרי החישוב.',
      parameters: eventIdOnly,
      responses: {
        200: json(ref('Settlement'), {
          calculated: true,
          calculatedAt: '2026-11-02T18:30:00.000Z',
          isOutdated: false,
          total: 600,
          participantsCount: 3,
          sharePerPerson: 200,
          myBalance: 200,
          balances: [
            { userId: 1, fullName: 'רחל לוי', paid: 400, share: 200, balance: 200 },
            { userId: 2, fullName: 'שרה כהן', paid: 200, share: 200, balance: 0 },
            { userId: 3, fullName: 'דנה', paid: 0, share: 200, balance: -200 },
          ],
          transfers: [{ id: 1, from: { id: 3, fullName: 'דנה', phone: '0533334444' }, to: { id: 1, fullName: 'רחל לוי', phone: '0501234567' }, amount: 200 }],
          myTransfers: { toPay: [], toReceive: [{ id: 1, fromUser: { id: 3, fullName: 'דנה', phone: '0533334444' }, amount: 200 }] },
        }),
        404: E[404],
      },
    }),
  },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'יחד – API לתיאום מפגשים קבוצתיים',
    version: '1.0.0',
    description:
      'שרת לתיאום מפגשים: הזמנות, סקר, תפקידים, הוצאות והתחשבנות.\n\n' +
      '**איך בודקים כאן:**\n' +
      '1. פתחי את `POST /api/auth/login`, לחצי Try it out ו-Execute.\n' +
      '2. העתיקי את הערך של `token` מהתשובה.\n' +
      '3. לחצי על הכפתור **Authorize** למעלה, הדביקי את ה-token (בלי המילה Bearer) ואשרי.\n' +
      '4. עכשיו אפשר לקרוא לכל הכתובות המוגנות.\n\n' +
      '**הרשאות לפי מפגש:** מארגן = מי שיצר את המפגש. משתתף = מי שאישר הזמנה. ' +
      'מי שלא חבר במפגש מקבל 404. משתתף שמנסה פעולה של מארגן מקבל 403. בלי Token – 401.',
  },
  servers: [{ url: '/', description: 'השרת הנוכחי' }],
  tags: [
    { name: '1. מערכת' },
    { name: '2. התחברות ופרופיל' },
    { name: '3. דף הבית' },
    { name: '4. מפגשים' },
    { name: '5. משתתפים והזמנות' },
    { name: '6. תפקידים' },
    { name: '7. סקר' },
    { name: '8. הוצאות והתחשבנות' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'הדביקי כאן את ה-token שקיבלת מ-login' },
    },
    schemas,
  },
  paths,
};
