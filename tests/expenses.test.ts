import { beforeEach, describe, expect, it } from 'vitest';
import { calculateSettlement } from '../src/modules/settlement/settlement.algorithm';
import { api, auth, createEventWith, registerUser, resetDb } from './helpers';

beforeEach(resetDb);

describe('אלגוריתם ההתחשבנות (בדיקת יחידה)', () => {
  it('חלוקה שווה ומספר העברות מינימלי', () => {
    const r = calculateSettlement([
      { userId: 1, paidCents: 40000 },
      { userId: 2, paidCents: 20000 },
      { userId: 3, paidCents: 0 },
    ]);
    expect(r.totalCents).toBe(60000);
    expect(r.transfers).toEqual([{ fromUserId: 3, toUserId: 1, amountCents: 20000 }]);
  });

  it('סכום שלא מתחלק – האגורות מתחלקות, ואין כסף שנעלם', () => {
    const r = calculateSettlement([
      { userId: 1, paidCents: 10000 },
      { userId: 2, paidCents: 0 },
      { userId: 3, paidCents: 0 },
    ]);
    expect(r.balances.map((b) => b.shareCents)).toEqual([3334, 3333, 3333]);
    const totalTransfers = r.transfers.reduce((s, t) => s + t.amountCents, 0);
    expect(totalTransfers).toBe(10000 - 3334);
    expect(r.transfers.length).toBeLessThanOrEqual(2);
  });

  it('כולם שילמו אותו דבר / אין הוצאות – אין העברות', () => {
    expect(calculateSettlement([{ userId: 1, paidCents: 500 }, { userId: 2, paidCents: 500 }]).transfers).toEqual([]);
    expect(calculateSettlement([{ userId: 1, paidCents: 0 }]).transfers).toEqual([]);
  });
});

describe('הוצאות', () => {
  it('רישום, סיכום מול תקציב, עריכה ומחיקה רק של הוצאה שלי', async () => {
    const org = await registerUser('רחל');
    const p = await registerUser('שרה');
    const { eventId } = await createEventWith(org, [p], { budget: 500 });

    await api().post(`/api/events/${eventId}/expenses`).set(auth(org)).send({ amount: 300.5, reason: 'אוכל' }).expect(201);
    const pe = await api().post(`/api/events/${eventId}/expenses`).set(auth(p)).send({ amount: 250, reason: 'שתייה' }).expect(201);
    expect(pe.body.expense).toMatchObject({ amount: 250, isMine: true, paidBy: { fullName: 'שרה' } });

    await api().post(`/api/events/${eventId}/expenses`).set(auth(p)).send({ amount: 0, reason: 'כלום' }).expect(400);
    await api().post(`/api/events/${eventId}/expenses`).set(auth(p)).send({ amount: 10.123, reason: 'שבר' }).expect(400);

    const sum = (await api().get(`/api/events/${eventId}/expenses`).set(auth(p)).expect(200)).body;
    expect(sum).toMatchObject({ budget: 500, total: 550.5, remaining: -50.5, percentUsed: 110.1, isOverBudget: true, expensesCount: 2, myTotal: 250 });
    expect(sum.byParticipant).toEqual([
      { userId: org.id, fullName: 'רחל', total: 300.5 },
      { userId: p.id, fullName: 'שרה', total: 250 },
    ]);

    const orgExpenseId = sum.expenses.find((e: { isMine: boolean }) => !e.isMine).id;
    // ⭐ גם המארגן לא יכול למחוק הוצאה של אחר, וגם משתתף לא
    expect((await api().delete(`/api/events/${eventId}/expenses/${pe.body.expense.id}`).set(auth(org)).expect(403)).body.error.code).toBe('NOT_YOUR_EXPENSE');
    await api().put(`/api/events/${eventId}/expenses/${orgExpenseId}`).set(auth(p)).send({ amount: 1 }).expect(403);

    const upd = await api().put(`/api/events/${eventId}/expenses/${pe.body.expense.id}`).set(auth(p)).send({ amount: 199.99 }).expect(200);
    expect(upd.body.expense.amount).toBe(199.99);
    await api().delete(`/api/events/${eventId}/expenses/${pe.body.expense.id}`).set(auth(p)).expect(200);
    await api().delete(`/api/events/${eventId}/expenses/${pe.body.expense.id}`).set(auth(p)).expect(404);
  });

  it('בלי תקציב – שדות התקציב null; לא חבר → 404', async () => {
    const org = await registerUser();
    const stranger = await registerUser();
    const { eventId } = await createEventWith(org);
    const res = await api().get(`/api/events/${eventId}/expenses`).set(auth(org)).expect(200);
    expect(res.body).toMatchObject({ budget: null, remaining: null, percentUsed: null, isOverBudget: false, total: 0 });
    await api().get(`/api/events/${eventId}/expenses`).set(auth(stranger)).expect(404);
    await api().post(`/api/events/${eventId}/expenses`).set(auth(stranger)).send({ amount: 5, reason: 'נסיון' }).expect(404);
  });
});

describe('התחשבנות', () => {
  it('מארגן מחשב; כולם רואים; שינוי בהוצאות מסמן "לא מעודכן"; דף הבית מציג כמה לשלם', async () => {
    const org = await registerUser('רחל');
    const p1 = await registerUser('שרה');
    const p2 = await registerUser('דנה');
    const { eventId } = await createEventWith(org, [p1, p2]);

    const before = await api().get(`/api/events/${eventId}/settlement`).set(auth(p1)).expect(200);
    expect(before.body).toMatchObject({ calculated: false, transfers: [] });

    await api().post(`/api/events/${eventId}/expenses`).set(auth(org)).send({ amount: 400, reason: 'אוכל' });
    await api().post(`/api/events/${eventId}/expenses`).set(auth(p1)).send({ amount: 200, reason: 'שתייה' });

    await api().post(`/api/events/${eventId}/settlement/calculate`).set(auth(p1)).expect(403);
    const calc = (await api().post(`/api/events/${eventId}/settlement/calculate`).set(auth(org)).expect(200)).body;
    expect(calc).toMatchObject({ calculated: true, isOutdated: false, total: 600, participantsCount: 3, sharePerPerson: 200, myBalance: 200 });
    expect(calc.transfers).toHaveLength(1);
    expect(calc.transfers[0]).toMatchObject({ from: { fullName: 'דנה' }, to: { fullName: 'רחל', phone: org.phone }, amount: 200 });

    const forP2 = (await api().get(`/api/events/${eventId}/settlement`).set(auth(p2)).expect(200)).body;
    expect(forP2.myBalance).toBe(-200);
    expect(forP2.myTransfers.toPay).toEqual([{ id: calc.transfers[0].id, toUser: { id: org.id, fullName: 'רחל', phone: org.phone }, amount: 200 }]);

    const home = (await api().get('/api/home').set(auth(p2)).expect(200)).body;
    expect(home.money).toMatchObject({ totalToPay: 200, totalToReceive: 0 });

    await api().post(`/api/events/${eventId}/expenses`).set(auth(p2)).send({ amount: 30, reason: 'מפיות' });
    expect((await api().get(`/api/events/${eventId}/settlement`).set(auth(p1))).body.isOutdated).toBe(true);
    const re = (await api().post(`/api/events/${eventId}/settlement/calculate`).set(auth(org))).body;
    expect(re).toMatchObject({ isOutdated: false, total: 630, sharePerPerson: 210 });
  });
});

describe('דף הבית', () => {
  it('מפגשים קרובים, הזמנות ממתינות ותפקידים שלי', async () => {
    const org = await registerUser();
    const me = await registerUser();
    const { eventId } = await createEventWith(org, [me], { title: 'קרוב', eventDate: '2031-01-01T10:00:00.000Z' });
    await api().post('/api/events').set(auth(org)).send({ title: 'הזמנה', invitees: [{ email: me.email }] });
    await api().post('/api/events').set(auth(me)).send({ title: 'עבר', eventDate: '2020-01-01T10:00:00.000Z' });
    const t = (await api().post(`/api/events/${eventId}/tasks`).set(auth(org)).send({ description: 'עוגה' })).body.task.id;
    await api().post(`/api/events/${eventId}/tasks/${t}/claim`).set(auth(me));

    const home = (await api().get('/api/home').set(auth(me)).expect(200)).body;
    expect(home.upcomingEvents.map((e: { title: string }) => e.title)).toEqual(['קרוב']);
    expect(home.pendingInvitationsCount).toBe(1);
    expect(home.myOpenTasks).toEqual([{ id: t, description: 'עוגה', event: { id: eventId, title: 'קרוב', eventDate: '2031-01-01T10:00:00.000Z' } }]);
    await api().get('/api/home').expect(401);
  });
});
