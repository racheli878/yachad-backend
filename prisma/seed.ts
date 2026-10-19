/**
 * נתוני הדגמה (Seed) – הרצה: npm run db:seed
 *
 * ⚠️ הסקריפט מוחק את כל הנתונים הקיימים ובונה נתוני דוגמה מחדש.
 *    בסביבת production הוא לא ירוץ, אלא אם הוגדרו:
 *      ALLOW_SEED_IN_PRODUCTION=true
 *      SEED_DEMO_PASSWORD=<סיסמה שאת בוחרת>
 *    כך אין באתר האמיתי חשבונות עם סיסמה שמופיעה בקוד.
 *
 * כל הנתונים מומצאים.
 */
import 'dotenv/config';
import { ActivityType, EventCategory, EventRole, EventStatus, InvitationStatus, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculateSettlement } from '../src/modules/settlement/settlement.algorithm';

const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === 'production';
const DEV_PASSWORD = 'Demo1234!';

const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function main() {
  if (isProduction && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
    throw new Error('Seed חסום ב-production. הגדירי ALLOW_SEED_IN_PRODUCTION=true אם את בטוחה.');
  }
  const password = process.env.SEED_DEMO_PASSWORD ?? (isProduction ? undefined : DEV_PASSWORD);
  if (!password) throw new Error('ב-production חובה להגדיר SEED_DEMO_PASSWORD');

  console.log('🧹 מוחק נתונים קיימים...');
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "SettlementTransfer", "Expense", "SurveyAnswer", "SurveyResponse", "SurveyOption",
      "SurveyQuestion", "Task", "Invitation", "EventParticipant", "Event", "User"
    RESTART IDENTITY CASCADE;
  `);

  const passwordHash = await bcrypt.hash(password, 10);
  const mkUser = (fullName: string, email: string, phone: string) =>
    prisma.user.create({ data: { fullName, email, phone, passwordHash } });

  console.log('👤 יוצר משתמשים...');
  const rachel = await mkUser('רחל לוי', 'rachel@example.com', '0501234567'); // מארגנת ראשית
  const sara = await mkUser('שרה כהן', 'sara@example.com', '0521112233'); // משתתפת
  const dana = await mkUser('דנה מזרחי', 'dana@example.com', '0533334444'); // משתתפת + הזמנה ממתינה
  const yossi = await mkUser('יוסי פרץ', 'yossi@example.com', '0544445555'); // מארגן מפגש משלו

  const join = (eventId: number, userId: number, role: EventRole = EventRole.PARTICIPANT) =>
    prisma.eventParticipant.create({ data: { eventId, userId, role } });
  const acceptedInvite = (eventId: number, invitedById: number, email: string) =>
    prisma.invitation.create({
      data: { eventId, invitedById, email, status: InvitationStatus.ACCEPTED, respondedAt: new Date() },
    });

  console.log('📅 יוצר מפגשים...');

  // ---- מפגש 1: בתכנון, עם סקר ותשובות ----
  const hanukkah = await prisma.event.create({
    data: {
      title: 'ארוחת חנוכה משפחתית',
      description: 'המפגש השנתי של כל המשפחה. מביאים את הילדים!',
      food: 'לביבות וסופגניות',
      category: EventCategory.FAMILY,
      activityType: ActivityType.HOLIDAY,
      status: EventStatus.PLANNING,
      budget: 800,
      organizerId: rachel.id,
    },
  });
  await join(hanukkah.id, rachel.id, EventRole.ORGANIZER);
  for (const u of [sara, dana]) {
    await acceptedInvite(hanukkah.id, rachel.id, u.email);
    await join(hanukkah.id, u.id);
  }
  // הזמנה ממתינה למישהו שעוד לא נרשם – כשיירשם עם המייל הזה, יראה אותה
  await prisma.invitation.create({ data: { eventId: hanukkah.id, invitedById: rachel.id, email: 'miriam@example.com' } });

  const qWhere = await prisma.surveyQuestion.create({
    data: {
      eventId: hanukkah.id,
      text: 'איפה נוח לכם להיפגש?',
      order: 1,
      options: { create: [{ text: 'בבית של סבא וסבתא', order: 1 }, { text: 'באולם קטן', order: 2 }] },
    },
    include: { options: true },
  });
  const qWhen = await prisma.surveyQuestion.create({
    data: {
      eventId: hanukkah.id,
      text: 'באיזה ערב נוח לכם?',
      order: 2,
      options: { create: [{ text: 'נר ראשון', order: 1 }, { text: 'נר שלישי', order: 2 }, { text: 'נר חמישי', order: 3 }] },
    },
    include: { options: true },
  });
  const answer = async (userId: number, optionIds: number[], note?: string) => {
    await prisma.surveyAnswer.createMany({ data: optionIds.map((optionId) => ({ optionId, userId })) });
    await prisma.surveyResponse.create({ data: { eventId: hanukkah.id, userId, note } });
  };
  await answer(sara.id, [qWhere.options[0]!.id, qWhen.options[0]!.id, qWhen.options[1]!.id], 'אגיע עם העגלה, צריך מקום חניה');
  await answer(dana.id, [qWhere.options[0]!.id, qWhen.options[1]!.id]);

  await prisma.task.createMany({
    data: [
      { eventId: hanukkah.id, description: 'להביא שתייה', assigneeId: sara.id },
      { eventId: hanukkah.id, description: 'לקנות כלים חד-פעמיים' },
      { eventId: hanukkah.id, description: 'להכין משחק לילדים' },
    ],
  });

  // ---- מפגש 2: נקבע, עם הוצאות והתחשבנות ----
  const picnic = await prisma.event.create({
    data: {
      title: 'פיקניק חברות בפארק',
      description: 'יום כיף בפארק עם אוכל ומשחקים',
      eventDate: days(14),
      location: 'פארק הירקון',
      food: 'סלטים, כריכים ופירות',
      category: EventCategory.FRIENDS,
      activityType: ActivityType.REFRESHMENT,
      status: EventStatus.SCHEDULED,
      budget: 500,
      organizerId: rachel.id,
    },
  });
  await join(picnic.id, rachel.id, EventRole.ORGANIZER);
  for (const u of [sara, dana]) {
    await acceptedInvite(picnic.id, rachel.id, u.email);
    await join(picnic.id, u.id);
  }
  await prisma.task.createMany({
    data: [
      { eventId: picnic.id, description: 'להביא מחצלות', assigneeId: dana.id },
      { eventId: picnic.id, description: 'להביא כדור', assigneeId: dana.id },
      { eventId: picnic.id, description: 'אחראית אוכל', assigneeId: rachel.id },
    ],
  });
  await prisma.expense.createMany({
    data: [
      { eventId: picnic.id, paidById: rachel.id, amount: 240, reason: 'סלטים וכריכים' },
      { eventId: picnic.id, paidById: sara.id, amount: 120.5, reason: 'שתייה וקרח' },
      { eventId: picnic.id, paidById: rachel.id, amount: 45, reason: 'פירות' },
    ],
  });
  // חישוב התחשבנות אמיתי עם אותו אלגוריתם של השרת
  const participants = [rachel, sara, dana];
  const paid = { [rachel.id]: 28500, [sara.id]: 12050, [dana.id]: 0 } as Record<number, number>;
  const result = calculateSettlement(participants.map((u) => ({ userId: u.id, paidCents: paid[u.id] ?? 0 })));
  await prisma.settlementTransfer.createMany({
    data: result.transfers.map((t) => ({ eventId: picnic.id, fromUserId: t.fromUserId, toUserId: t.toUserId, amount: t.amountCents / 100 })),
  });
  await prisma.event.update({
    where: { id: picnic.id },
    data: {
      settlementCalculatedAt: new Date(),
      settlementOutdated: false,
      settlementSummary: {
        totalCents: result.totalCents,
        participantsCount: participants.length,
        balances: result.balances.map((b) => ({ ...b, fullName: participants.find((u) => u.id === b.userId)!.fullName })),
      },
    },
  });

  // ---- מפגש 3: הסתיים (לבדיקת סינון "שעברו") ----
  const birthday = await prisma.event.create({
    data: {
      title: 'יום הולדת 10 לנועה',
      eventDate: days(-30),
      location: 'בבית',
      category: EventCategory.FAMILY,
      activityType: ActivityType.BIRTHDAY,
      status: EventStatus.COMPLETED,
      organizerId: rachel.id,
    },
  });
  await join(birthday.id, rachel.id, EventRole.ORGANIZER);
  await join(birthday.id, sara.id);

  // ---- מפגש 4: של יוסי – רחל משתתפת, ודנה הוזמנה (ממתינה) ----
  const soccer = await prisma.event.create({
    data: {
      title: 'משחק כדורגל שכונתי',
      eventDate: days(7),
      location: 'מגרש בית הספר',
      category: EventCategory.CLASS_COMMUNITY,
      activityType: ActivityType.SPORT,
      status: EventStatus.SCHEDULED,
      organizerId: yossi.id,
    },
  });
  await join(soccer.id, yossi.id, EventRole.ORGANIZER);
  await acceptedInvite(soccer.id, yossi.id, rachel.email);
  await join(soccer.id, rachel.id);
  await prisma.invitation.create({ data: { eventId: soccer.id, invitedById: yossi.id, phone: dana.phone } });

  // ---- מפגש 5: בוטל ----
  const work = await prisma.event.create({
    data: {
      title: 'ערב גיבוש צוות',
      category: EventCategory.WORK,
      activityType: ActivityType.GATHERING,
      status: EventStatus.CANCELLED,
      organizerId: yossi.id,
    },
  });
  await join(work.id, yossi.id, EventRole.ORGANIZER);

  console.log('\n✅ נתוני ההדגמה נוצרו בהצלחה!\n');
  console.log(`סיסמה לכל המשתמשים: ${process.env.SEED_DEMO_PASSWORD ? '(הסיסמה מ-SEED_DEMO_PASSWORD)' : DEV_PASSWORD}`);
  console.table([
    { email: rachel.email, תפקיד: 'מארגנת של 3 מפגשים, משתתפת בכדורגל' },
    { email: sara.email, תפקיד: 'משתתפת, ענתה על הסקר, רשמה הוצאה' },
    { email: dana.email, תפקיד: 'משתתפת, יש לה הזמנה ממתינה מיוסי' },
    { email: yossi.email, תפקיד: 'מארגן של כדורגל וגיבוש' },
  ]);
}

main()
  .catch((err) => {
    console.error('❌', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
