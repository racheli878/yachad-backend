import { beforeEach, describe, expect, it } from 'vitest';
import { api, auth, registerUser, resetDb } from './helpers';

beforeEach(resetDb);

describe('הזמנות', () => {
  it('מוזמן שעוד לא רשום רואה את ההזמנה ברגע שנרשם (לפי טלפון)', async () => {
    const org = await registerUser('רחל');
    const { body } = await api()
      .post('/api/events')
      .set(auth(org))
      .send({ title: 'מפגש כיתה', invitees: [{ phone: '058-123-4567' }] })
      .expect(201);

    const newUser = await registerUser('יוסי', { phone: '0581234567' });
    const mine = await api().get('/api/invitations/me').set(auth(newUser)).expect(200);
    expect(mine.body.count).toBe(1);
    expect(mine.body.invitations[0].event).toMatchObject({ id: body.event.id, title: 'מפגש כיתה', organizer: { fullName: 'רחל' } });
    expect(mine.body.invitations[0].invitedBy.fullName).toBe('רחל');
  });

  it('לפני אישור: לא ברשימת המשתתפים ואין גישה לדף; אחרי אישור: יש', async () => {
    const org = await registerUser();
    const guest = await registerUser('אורחת');
    const { body } = await api().post('/api/events').set(auth(org)).send({ title: 'מפגש', invitees: [{ email: guest.email }] }).expect(201);
    const eventId = body.event.id;

    await api().get(`/api/events/${eventId}`).set(auth(guest)).expect(404);
    let participants = await api().get(`/api/events/${eventId}/participants`).set(auth(org)).expect(200);
    expect(participants.body.count).toBe(1);

    const inv = (await api().get('/api/invitations/me').set(auth(guest))).body.invitations[0];
    const acc = await api().post(`/api/invitations/${inv.id}/accept`).set(auth(guest)).expect(200);
    expect(acc.body.eventId).toBe(eventId);

    participants = await api().get(`/api/events/${eventId}/participants`).set(auth(org)).expect(200);
    expect(participants.body.count).toBe(2);
    await api().get(`/api/events/${eventId}`).set(auth(guest)).expect(200);

    // ההזמנה כבר לא ממתינה ולא אפשר לאשר שוב
    expect((await api().get('/api/invitations/me').set(auth(guest))).body.count).toBe(0);
    await api().post(`/api/invitations/${inv.id}/accept`).set(auth(guest)).expect(404);

    const list = await api().get(`/api/events/${eventId}/invitations`).set(auth(org)).expect(200);
    expect(list.body).toMatchObject({ count: 1, acceptedCount: 1, pendingCount: 0 });
    expect(list.body.invitations[0].registeredUser.fullName).toBe('אורחת');
  });

  it('דחיית הזמנה; המארגן רואה "נדחתה" ויכול להזמין שוב', async () => {
    const org = await registerUser();
    const guest = await registerUser();
    const { body } = await api().post('/api/events').set(auth(org)).send({ title: 'מפגש', invitees: [{ email: guest.email }] });
    const inv = (await api().get('/api/invitations/me').set(auth(guest))).body.invitations[0];

    await api().post(`/api/invitations/${inv.id}/decline`).set(auth(guest)).expect(200);
    const list = await api().get(`/api/events/${body.event.id}/invitations`).set(auth(org)).expect(200);
    expect(list.body.invitations[0].status).toBe('DECLINED');

    const again = await api().post(`/api/events/${body.event.id}/invitations`).set(auth(org)).send({ invitees: [{ email: guest.email }] }).expect(201);
    expect(again.body.createdCount).toBe(1);
  });

  it('אדם אחר לא יכול לאשר / לדחות הזמנה שלא שלו (404)', async () => {
    const org = await registerUser();
    const guest = await registerUser();
    const thief = await registerUser();
    await api().post('/api/events').set(auth(org)).send({ title: 'מפגש', invitees: [{ email: guest.email }] });
    const inv = (await api().get('/api/invitations/me').set(auth(guest))).body.invitations[0];

    await api().post(`/api/invitations/${inv.id}/accept`).set(auth(thief)).expect(404);
    await api().post(`/api/invitations/${inv.id}/decline`).set(auth(thief)).expect(404);
    expect((await api().get('/api/invitations/me').set(auth(thief))).body.count).toBe(0);
  });

  it('הוזמן גם במייל וגם בטלפון: מופיעה הזמנה אחת, ואישור סוגר את שתיהן', async () => {
    const org = await registerUser();
    const guest = await registerUser();
    const { body } = await api()
      .post('/api/events')
      .set(auth(org))
      .send({ title: 'מפגש', invitees: [{ email: guest.email }] });
    // הזמנה נוספת בטלפון – מזוהה כאותו אדם רשום ולכן מדולגת
    const add = await api().post(`/api/events/${body.event.id}/invitations`).set(auth(org)).send({ invitees: [{ phone: guest.phone }] }).expect(201);
    expect(add.body.skipped[0].reason).toBe('ALREADY_INVITED');

    const mine = await api().get('/api/invitations/me').set(auth(guest));
    expect(mine.body.count).toBe(1);
  });

  it('רק המארגן מוסיף מוזמנים ורואה את רשימת ההזמנות (משתתף → 403)', async () => {
    const org = await registerUser();
    const p = await registerUser();
    const { body } = await api().post('/api/events').set(auth(org)).send({ title: 'מפגש', invitees: [{ email: p.email }] });
    const inv = (await api().get('/api/invitations/me').set(auth(p))).body.invitations[0];
    await api().post(`/api/invitations/${inv.id}/accept`).set(auth(p));

    await api().post(`/api/events/${body.event.id}/invitations`).set(auth(p)).send({ invitees: [{ email: 'z@test.com' }] }).expect(403);
    await api().get(`/api/events/${body.event.id}/invitations`).set(auth(p)).expect(403);
    await api().post(`/api/events/${body.event.id}/invitations`).set(auth(org)).send({ invitees: [] }).expect(400);

    const dup = await api().post(`/api/events/${body.event.id}/invitations`).set(auth(org)).send({ invitees: [{ email: p.email }] }).expect(201);
    expect(dup.body.skipped[0].reason).toBe('ALREADY_PARTICIPANT');
  });
});
