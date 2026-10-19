import { beforeEach, describe, expect, it } from 'vitest';
import { api, auth, createEventWith, registerUser, resetDb } from './helpers';

beforeEach(resetDb);

describe('תפקידים', () => {
  it('רק המארגן יוצר; משתתף לוקח תפקיד פנוי; כולם רואים מי לקח', async () => {
    const org = await registerUser('מארגנת');
    const p = await registerUser('שרה');
    const { eventId } = await createEventWith(org, [p]);

    await api().post(`/api/events/${eventId}/tasks`).set(auth(p)).send({ description: 'שתייה' }).expect(403);
    await api().post(`/api/events/${eventId}/tasks`).set(auth(org)).send({ description: 'א' }).expect(400);
    const t = await api().post(`/api/events/${eventId}/tasks`).set(auth(org)).send({ description: 'להביא שתייה' }).expect(201);
    const taskId = t.body.task.id;

    const claimed = await api().post(`/api/events/${eventId}/tasks/${taskId}/claim`).set(auth(p)).expect(200);
    expect(claimed.body.task).toMatchObject({ isTaken: true, isMine: true, assignee: { fullName: 'שרה' } });

    const list = await api().get(`/api/events/${eventId}/tasks`).set(auth(org)).expect(200);
    expect(list.body).toMatchObject({ count: 1, openCount: 0 });
    expect(list.body.tasks[0]).toMatchObject({ isMine: false, assignee: { fullName: 'שרה' } });
  });

  it('תפקיד תפוס: אחר מקבל 409; המארגן לא עורך / מוחק / משחרר אותו', async () => {
    const org = await registerUser();
    const p1 = await registerUser();
    const p2 = await registerUser();
    const { eventId } = await createEventWith(org, [p1, p2]);
    const taskId = (await api().post(`/api/events/${eventId}/tasks`).set(auth(org)).send({ description: 'כלים' })).body.task.id;

    await api().post(`/api/events/${eventId}/tasks/${taskId}/claim`).set(auth(p1)).expect(200);
    const r = await api().post(`/api/events/${eventId}/tasks/${taskId}/claim`).set(auth(p2)).expect(409);
    expect(r.body.error.code).toBe('TASK_ALREADY_TAKEN');
    expect((await api().post(`/api/events/${eventId}/tasks/${taskId}/claim`).set(auth(p1)).expect(409)).body.error.code).toBe('TASK_ALREADY_MINE');

    expect((await api().put(`/api/events/${eventId}/tasks/${taskId}`).set(auth(org)).send({ description: 'חדש' }).expect(409)).body.error.code).toBe('TASK_TAKEN');
    await api().delete(`/api/events/${eventId}/tasks/${taskId}`).set(auth(org)).expect(409);
    expect((await api().post(`/api/events/${eventId}/tasks/${taskId}/release`).set(auth(org)).expect(403)).body.error.code).toBe('NOT_YOUR_TASK');

    const rel = await api().post(`/api/events/${eventId}/tasks/${taskId}/release`).set(auth(p1)).expect(200);
    expect(rel.body.task.assignee).toBeNull();
    await api().post(`/api/events/${eventId}/tasks/${taskId}/release`).set(auth(p1)).expect(409);

    await api().put(`/api/events/${eventId}/tasks/${taskId}`).set(auth(org)).send({ description: 'כלים חד-פעמיים' }).expect(200);
    await api().delete(`/api/events/${eventId}/tasks/${taskId}`).set(auth(org)).expect(200);
    await api().post(`/api/events/${eventId}/tasks/${taskId}/claim`).set(auth(p1)).expect(404);
  });

  it('שניים לוקחים באותו רגע – רק אחד מצליח', async () => {
    const org = await registerUser();
    const users = [await registerUser(), await registerUser(), await registerUser(), await registerUser()];
    const { eventId } = await createEventWith(org, users);
    const taskId = (await api().post(`/api/events/${eventId}/tasks`).set(auth(org)).send({ description: 'הסעות' })).body.task.id;

    const results = await Promise.all(users.map((u) => api().post(`/api/events/${eventId}/tasks/${taskId}/claim`).set(auth(u))));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409]);
  });

  it('משתתף יכול להחזיק כמה תפקידים; תפקיד ממפגש אחר → 404', async () => {
    const org = await registerUser();
    const p = await registerUser();
    const { eventId } = await createEventWith(org, [p]);
    const other = await createEventWith(org, []);
    const t1 = (await api().post(`/api/events/${eventId}/tasks`).set(auth(org)).send({ description: 'אחד' })).body.task.id;
    const t2 = (await api().post(`/api/events/${eventId}/tasks`).set(auth(org)).send({ description: 'שניים' })).body.task.id;
    const foreign = (await api().post(`/api/events/${other.eventId}/tasks`).set(auth(org)).send({ description: 'זר' })).body.task.id;

    await api().post(`/api/events/${eventId}/tasks/${t1}/claim`).set(auth(p)).expect(200);
    await api().post(`/api/events/${eventId}/tasks/${t2}/claim`).set(auth(p)).expect(200);
    await api().post(`/api/events/${eventId}/tasks/${foreign}/claim`).set(auth(p)).expect(404);
  });
});
