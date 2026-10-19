import { beforeEach, describe, expect, it } from 'vitest';
import { api, auth, createEventWith, registerUser, resetDb } from './helpers';

beforeEach(resetDb);

describe('יצירת מפגש (אשף)', () => {
  it('יוצר מפגש עם מוזמנים ושאלות בקריאה אחת; היוצר הוא המארגן', async () => {
    const org = await registerUser('רחל');
    const res = await api()
      .post('/api/events')
      .set(auth(org))
      .send({
        title: 'ארוחת חנוכה',
        budget: 800,
        category: 'FAMILY',
        activityType: 'MEAL',
        invitees: [{ email: 'a@test.com' }, { phone: '052-111-2233' }, { contact: 'b@test.com' }, { contact: '0533334444' }],
        questions: [
          { text: 'איפה?', options: ['בית', 'פארק'] },
          { text: 'מתי?', options: ['15.12', '16.12', '17.12'] },
        ],
      })
      .expect(201);

    expect(res.body.event).toMatchObject({ title: 'ארוחת חנוכה', budget: 800, status: 'PLANNING', myRole: 'ORGANIZER' });
    expect(res.body.participants).toHaveLength(1);
    expect(res.body.invitationsSummary).toMatchObject({ createdCount: 4, skippedCount: 0 });
    expect(res.body.questionsCount).toBe(2);
  });

  it('חובה רק שם; ברירות מחדל: OTHER / PLANNING', async () => {
    const org = await registerUser();
    const res = await api().post('/api/events').set(auth(org)).send({ title: 'מפגש' }).expect(201);
    expect(res.body.event).toMatchObject({ category: 'OTHER', activityType: 'OTHER', status: 'PLANNING', eventDate: null });
  });

  it('ולידציה: בלי שם / שאלה עם תשובה אחת / מוזמן לא תקין → 400, ושום דבר לא נשמר', async () => {
    const org = await registerUser();
    await api().post('/api/events').set(auth(org)).send({}).expect(400);
    await api()
      .post('/api/events')
      .set(auth(org))
      .send({ title: 'מפגש', questions: [{ text: 'שאלה', options: ['רק אחת'] }] })
      .expect(400);
    const r = await api().post('/api/events').set(auth(org)).send({ title: 'מפגש', invitees: [{ contact: 'לא-תקין' }] }).expect(400);
    expect(r.body.error.details[0].field).toBe('invitees.0.contact');
    const list = await api().get('/api/events').set(auth(org)).expect(200);
    expect(list.body.count).toBe(0);
  });

  it('מוזמנים כפולים ברשימה / המארגן עצמו → skipped', async () => {
    const org = await registerUser();
    const res = await api()
      .post('/api/events')
      .set(auth(org))
      .send({ title: 'מפגש', invitees: [{ email: 'x@test.com' }, { contact: 'X@test.com' }, { email: org.email }] })
      .expect(201);
    expect(res.body.invitationsSummary.createdCount).toBe(1);
    const reasons = res.body.invitationsSummary.skipped.map((s: { reason: string }) => s.reason);
    expect(reasons).toEqual(['DUPLICATE_IN_LIST', 'ALREADY_PARTICIPANT']);
  });
});

describe('הרשאות בדף מפגש', () => {
  it('משתתף רואה את הדף; מי שלא חבר מקבל 404', async () => {
    const org = await registerUser('מארגנת');
    const p = await registerUser('משתתפת');
    const stranger = await registerUser('זרה');
    const { eventId } = await createEventWith(org, [p]);

    const page = await api().get(`/api/events/${eventId}`).set(auth(p)).expect(200);
    expect(page.body.event.myRole).toBe('PARTICIPANT');
    expect(page.body.participants.map((x: { fullName: string }) => x.fullName)).toEqual(['מארגנת', 'משתתפת']);
    expect(page.body.participants[0]).not.toHaveProperty('email');

    const r = await api().get(`/api/events/${eventId}`).set(auth(stranger)).expect(404);
    expect(r.body.error.code).toBe('EVENT_NOT_FOUND');
    await api().get(`/api/events/${eventId}/participants`).set(auth(stranger)).expect(404);
    await api().get('/api/events/abc').set(auth(org)).expect(400);
  });

  it('רק המארגן עורך ומוחק (משתתף → 403)', async () => {
    const org = await registerUser();
    const p = await registerUser();
    const { eventId } = await createEventWith(org, [p]);

    const r = await api().put(`/api/events/${eventId}`).set(auth(p)).send({ title: 'פריצה' }).expect(403);
    expect(r.body.error.code).toBe('ORGANIZER_ONLY');
    await api().delete(`/api/events/${eventId}`).set(auth(p)).expect(403);

    const upd = await api()
      .put(`/api/events/${eventId}`)
      .set(auth(org))
      .send({ location: 'בית סבא', eventDate: '2030-12-15T18:00:00.000Z', status: 'SCHEDULED', budget: 1000.5 })
      .expect(200);
    expect(upd.body.event).toMatchObject({ location: 'בית סבא', status: 'SCHEDULED', budget: 1000.5 });

    const cleared = await api().put(`/api/events/${eventId}`).set(auth(org)).send({ location: null }).expect(200);
    expect(cleared.body.event.location).toBeNull();

    await api().put(`/api/events/${eventId}`).set(auth(org)).send({ status: 'WRONG' }).expect(400);
    await api().put(`/api/events/${eventId}`).set(auth(org)).send({}).expect(400);

    await api().delete(`/api/events/${eventId}`).set(auth(org)).expect(200);
    await api().get(`/api/events/${eventId}`).set(auth(org)).expect(404);
  });
});

describe('רשימת המפגשים שלי – חיפוש, סינון, מיון', () => {
  it('בלי פרמטרים מחזיר הכל; כל פרמטר מצמצם', async () => {
    const me = await registerUser('אני');
    const other = await registerUser('אחרת');

    await api().post('/api/events').set(auth(me)).send({ title: 'ארוחת שישי', category: 'FAMILY', activityType: 'MEAL', eventDate: '2030-01-10T18:00:00.000Z' });
    await api().post('/api/events').set(auth(me)).send({ title: 'כדורגל בפארק', category: 'FRIENDS', activityType: 'SPORT', eventDate: '2030-01-05T18:00:00.000Z' });
    await api().post('/api/events').set(auth(me)).send({ title: 'יום הולדת ישן', category: 'FAMILY', activityType: 'BIRTHDAY', eventDate: '2020-01-01T18:00:00.000Z', status: 'COMPLETED' });
    await createEventWith(other, [me], { title: 'ארוחת צוות', category: 'WORK' });
    await api().post('/api/events').set(auth(other)).send({ title: 'לא שלי' });

    const all = await api().get('/api/events').set(auth(me)).expect(200);
    expect(all.body.count).toBe(4);
    // מיון ברירת מחדל: תאריך עולה, בלי תאריך בסוף
    expect(all.body.events.map((e: { title: string }) => e.title)).toEqual(['יום הולדת ישן', 'כדורגל בפארק', 'ארוחת שישי', 'ארוחת צוות']);

    const q = async (query: string) =>
      (await api().get(`/api/events?${query}`).set(auth(me)).expect(200)).body.events.map((e: { title: string }) => e.title);

    expect(await q('search=ארוחת')).toEqual(['ארוחת שישי', 'ארוחת צוות']);
    expect(await q('category=FAMILY')).toEqual(['יום הולדת ישן', 'ארוחת שישי']);
    expect(await q('activityType=SPORT')).toEqual(['כדורגל בפארק']);
    expect(await q('status=COMPLETED')).toEqual(['יום הולדת ישן']);
    expect(await q('myRole=PARTICIPANT')).toEqual(['ארוחת צוות']);
    expect(await q('myRole=ORGANIZER&category=FAMILY&search=שישי')).toEqual(['ארוחת שישי']);
    expect(await q('timeframe=upcoming')).toEqual(['כדורגל בפארק', 'ארוחת שישי', 'ארוחת צוות']);
    expect(await q('timeframe=past')).toEqual(['יום הולדת ישן']);
    expect(await q('sortBy=eventDate&sortOrder=desc')).toEqual(['ארוחת שישי', 'כדורגל בפארק', 'יום הולדת ישן', 'ארוחת צוות']);
    expect((await q('sortBy=createdAt&sortOrder=desc'))[0]).toBe('ארוחת צוות');

    await api().get('/api/events?category=NOPE').set(auth(me)).expect(400);
  });
});

describe('עזיבה והסרה', () => {
  it('משתתף עוזב: התפקידים מתפנים, התשובות נמחקות; מארגן לא יכול לעזוב', async () => {
    const org = await registerUser();
    const p = await registerUser();
    const { eventId } = await createEventWith(org, [p], { questions: [{ text: 'מתי?', options: ['א', 'ב'] }] });

    const task = await api().post(`/api/events/${eventId}/tasks`).set(auth(org)).send({ description: 'שתייה' }).expect(201);
    await api().post(`/api/events/${eventId}/tasks/${task.body.task.id}/claim`).set(auth(p)).expect(200);
    const survey = await api().get(`/api/events/${eventId}/survey`).set(auth(p)).expect(200);
    const q = survey.body.questions[0];
    await api().put(`/api/events/${eventId}/survey/answers`).set(auth(p)).send({ answers: [{ questionId: q.id, optionIds: [q.options[0].id] }] }).expect(200);

    const r = await api().post(`/api/events/${eventId}/leave`).set(auth(org)).expect(403);
    expect(r.body.error.code).toBe('ORGANIZER_CANNOT_LEAVE');

    await api().post(`/api/events/${eventId}/leave`).set(auth(p)).expect(200);
    await api().get(`/api/events/${eventId}`).set(auth(p)).expect(404);

    const page = await api().get(`/api/events/${eventId}`).set(auth(org)).expect(200);
    expect(page.body.tasks[0].assignee).toBeNull();
    const results = await api().get(`/api/events/${eventId}/survey/results`).set(auth(org)).expect(200);
    expect(results.body.respondentsCount).toBe(0);
    expect(results.body.questions[0].options[0].votes).toBe(0);
  });

  it('מארגן מסיר משתתף; משתתף עם הוצאות לא ניתן להסרה (409)', async () => {
    const org = await registerUser();
    const p1 = await registerUser();
    const p2 = await registerUser();
    const { eventId } = await createEventWith(org, [p1, p2]);

    await api().delete(`/api/events/${eventId}/participants/${p2.id}`).set(auth(p1)).expect(403);
    await api().delete(`/api/events/${eventId}/participants/${org.id}`).set(auth(org)).expect(400);

    await api().post(`/api/events/${eventId}/expenses`).set(auth(p1)).send({ amount: 50, reason: 'פיצה' }).expect(201);
    const r = await api().delete(`/api/events/${eventId}/participants/${p1.id}`).set(auth(org)).expect(409);
    expect(r.body.error.code).toBe('HAS_EXPENSES');
    const r2 = await api().post(`/api/events/${eventId}/leave`).set(auth(p1)).expect(409);
    expect(r2.body.error.code).toBe('HAS_EXPENSES');

    await api().delete(`/api/events/${eventId}/participants/${p2.id}`).set(auth(org)).expect(200);
    await api().delete(`/api/events/${eventId}/participants/${p2.id}`).set(auth(org)).expect(404);
    const list = await api().get(`/api/events/${eventId}/participants`).set(auth(org)).expect(200);
    expect(list.body.count).toBe(2);
  });
});
