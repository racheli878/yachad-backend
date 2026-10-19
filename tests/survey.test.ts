import { beforeEach, describe, expect, it } from 'vitest';
import { api, auth, createEventWith, registerUser, resetDb } from './helpers';

beforeEach(resetDb);

const setup = async () => {
  const org = await registerUser('מארגנת');
  const a = await registerUser('אביגיל');
  const b = await registerUser('בתיה');
  const c = await registerUser('ציפורה');
  const { eventId } = await createEventWith(org, [a, b, c], {
    questions: [
      { text: 'איפה?', options: ['בית', 'פארק'] },
      { text: 'מתי?', options: ['ראשון', 'שני', 'שלישי'] },
    ],
  });
  const survey = (await api().get(`/api/events/${eventId}/survey`).set(auth(a)).expect(200)).body;
  const [where, when] = survey.questions;
  return { org, a, b, c, eventId, where, when };
};

describe('סקר', () => {
  it('מענה עם כמה תשובות, הערה, ועריכה שמחליפה את הקודם', async () => {
    const { a, eventId, where, when } = await setup();

    const saved = await api()
      .put(`/api/events/${eventId}/survey/answers`)
      .set(auth(a))
      .send({ answers: [{ questionId: when.id, optionIds: [when.options[0].id, when.options[2].id] }], note: 'מגיעה מאוחר' })
      .expect(200);
    expect(saved.body).toMatchObject({ isOpen: true, hasResponded: true, myNote: 'מגיעה מאוחר' });
    expect(saved.body.questions[1].options.map((o: { selectedByMe: boolean }) => o.selectedByMe)).toEqual([true, false, true]);

    const edited = await api()
      .put(`/api/events/${eventId}/survey/answers`)
      .set(auth(a))
      .send({ answers: [{ questionId: where.id, optionIds: [where.options[1].id] }], note: null })
      .expect(200);
    expect(edited.body.myNote).toBeNull();
    expect(edited.body.questions[0].options.map((o: { selectedByMe: boolean }) => o.selectedByMe)).toEqual([false, true]);
    expect(edited.body.questions[1].options.every((o: { selectedByMe: boolean }) => !o.selectedByMe)).toBe(true);
  });

  it('אפשרות / שאלה לא שייכות → 400', async () => {
    const { a, eventId, where, when } = await setup();
    const r = await api()
      .put(`/api/events/${eventId}/survey/answers`)
      .set(auth(a))
      .send({ answers: [{ questionId: where.id, optionIds: [when.options[0].id] }] })
      .expect(400);
    expect(r.body.error.code).toBe('INVALID_OPTION');
    await api().put(`/api/events/${eventId}/survey/answers`).set(auth(a)).send({ answers: [{ questionId: 99999, optionIds: [] }] }).expect(400);
  });

  it('תוצאות למארגן: סטטיסטיקה, טבלה מפורטת, מי לא ענה; משתתף → 403', async () => {
    const { org, a, b, c, eventId, where, when } = await setup();
    const answer = (u: typeof a, whereIdx: number[], whenIdx: number[], note?: string) =>
      api()
        .put(`/api/events/${eventId}/survey/answers`)
        .set(auth(u))
        .send({
          answers: [
            { questionId: where.id, optionIds: whereIdx.map((i) => where.options[i].id) },
            { questionId: when.id, optionIds: whenIdx.map((i) => when.options[i].id) },
          ],
          note,
        })
        .expect(200);

    await answer(a, [0], [0, 1], 'אני צמחונית');
    await answer(b, [0], [1]);
    await answer(c, [1], [1, 2]);

    await api().get(`/api/events/${eventId}/survey/results`).set(auth(a)).expect(403);
    const res = (await api().get(`/api/events/${eventId}/survey/results`).set(auth(org)).expect(200)).body;

    expect(res).toMatchObject({ participantsCount: 4, respondentsCount: 3, responseRate: 75 });
    const [qWhere, qWhen] = res.questions;
    expect(qWhere.options.map((o: { votes: number }) => o.votes)).toEqual([2, 1]);
    expect(qWhere.options[0]).toMatchObject({ percentage: 66.7, isTop: true });
    expect(qWhen.options.map((o: { votes: number }) => o.votes)).toEqual([1, 3, 1]);
    expect(qWhen.options[1]).toMatchObject({ percentage: 100, isTop: true });
    expect(qWhen.options[1].voters.map((v: { fullName: string }) => v.fullName).sort()).toEqual(['אביגיל', 'בתיה', 'ציפורה']);

    const rowA = res.responses.find((r: { user: { fullName: string } }) => r.user.fullName === 'אביגיל');
    expect(rowA.note).toBe('אני צמחונית');
    expect(rowA.answers[1].optionTexts).toEqual(['ראשון', 'שני']);
    expect(res.notResponded.map((u: { fullName: string }) => u.fullName)).toEqual(['מארגנת']);
  });

  it('הוספת שאלה: רק מארגן; אחרי שהמפגש נקבע הסקר נסגר (409)', async () => {
    const { org, a, eventId, where } = await setup();
    await api().post(`/api/events/${eventId}/survey/questions`).set(auth(a)).send({ text: 'מה להביא?', options: ['עוגה', 'סלט'] }).expect(403);
    await api().post(`/api/events/${eventId}/survey/questions`).set(auth(org)).send({ text: 'מה להביא?', options: ['עוגה', 'עוגה'] }).expect(400);
    const q = await api().post(`/api/events/${eventId}/survey/questions`).set(auth(org)).send({ text: 'מה להביא?', options: ['עוגה', 'סלט'] }).expect(201);
    expect(q.body.question.order).toBe(3);

    await api().put(`/api/events/${eventId}`).set(auth(org)).send({ status: 'SCHEDULED' }).expect(200);
    const closed = await api()
      .put(`/api/events/${eventId}/survey/answers`)
      .set(auth(a))
      .send({ answers: [{ questionId: where.id, optionIds: [where.options[0].id] }] })
      .expect(409);
    expect(closed.body.error.code).toBe('SURVEY_CLOSED');
    await api().post(`/api/events/${eventId}/survey/questions`).set(auth(org)).send({ text: 'עוד?', options: ['כן', 'לא'] }).expect(409);
    expect((await api().get(`/api/events/${eventId}/survey`).set(auth(a))).body.isOpen).toBe(false);
  });

  it('שאלות פתיחה מוכנות', async () => {
    const u = await registerUser();
    const res = await api().get('/api/survey/default-questions').set(auth(u)).expect(200);
    expect(res.body.questions.length).toBeGreaterThan(0);
    await api().get('/api/survey/default-questions').expect(401);
  });
});
