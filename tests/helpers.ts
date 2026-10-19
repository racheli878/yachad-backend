import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';

export const app = createApp();
export const api = () => request(app);

/** מרוקן את כל הטבלאות לפני כל בדיקה */
export const resetDb = async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "SettlementTransfer", "Expense", "SurveyAnswer", "SurveyResponse", "SurveyOption",
      "SurveyQuestion", "Task", "Invitation", "EventParticipant", "Event", "User"
    RESTART IDENTITY CASCADE;
  `);
};

let counter = 0;

export interface TestUser {
  id: number;
  token: string;
  email: string;
  phone: string;
  fullName: string;
}

/** רושם משתמש חדש דרך ה-API ומחזיר את ה-Token שלו */
export const registerUser = async (fullName = 'משתמש בדיקה', overrides: Partial<{ email: string; phone: string }> = {}) => {
  counter += 1;
  const email = overrides.email ?? `user${counter}@test.com`;
  const phone = overrides.phone ?? `05${String(10000000 + counter).padStart(8, '0')}`;
  const res = await api()
    .post('/api/auth/register')
    .send({ fullName, email, phone, password: 'Passw0rd!' })
    .expect(201);
  return { id: res.body.user.id, token: res.body.token, email, phone, fullName } as TestUser;
};

export const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });

/** יוצר מפגש ע"י organizer, ומצרף אליו משתתפים (הזמנה + אישור) */
export const createEventWith = async (
  organizer: TestUser,
  participants: TestUser[] = [],
  extra: Record<string, unknown> = {},
) => {
  const res = await api()
    .post('/api/events')
    .set(auth(organizer))
    .send({ title: 'מפגש בדיקה', invitees: participants.map((p) => ({ email: p.email })), ...extra })
    .expect(201);
  const eventId: number = res.body.event.id;

  for (const p of participants) {
    const inv = await api().get('/api/invitations/me').set(auth(p)).expect(200);
    const invitation = inv.body.invitations.find((i: { event: { id: number } }) => i.event.id === eventId);
    await api().post(`/api/invitations/${invitation.id}/accept`).set(auth(p)).expect(200);
  }
  return { eventId, body: res.body };
};
