import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { api, auth, registerUser, resetDb } from './helpers';

beforeEach(resetDb);

describe('בדיקת בריאות', () => {
  it('GET /api/health מחזיר ok עם חיבור למסד', async () => {
    const res = await api().get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('כתובת לא קיימת מחזירה 404 בפורמט אחיד', async () => {
    const res = await api().get('/api/nothing').expect(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('הרשמה', () => {
  it('נרשמת בהצלחה, מנרמלת מייל וטלפון, לא מחזירה סיסמה', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ fullName: 'רחל לוי', email: '  Rachel@Example.COM ', phone: '+972-50-123-4567', password: 'Secret123' })
      .expect(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ fullName: 'רחל לוי', email: 'rachel@example.com', phone: '0501234567' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Secret123/);
  });

  it('מייל תפוס → 409 EMAIL_TAKEN, טלפון תפוס → 409 PHONE_TAKEN', async () => {
    const u = await registerUser();
    const r1 = await api()
      .post('/api/auth/register')
      .send({ fullName: 'אחר', email: u.email, phone: '0599999999', password: 'Secret123' })
      .expect(409);
    expect(r1.body.error.code).toBe('EMAIL_TAKEN');
    const r2 = await api()
      .post('/api/auth/register')
      .send({ fullName: 'אחר', email: 'new@test.com', phone: u.phone, password: 'Secret123' })
      .expect(409);
    expect(r2.body.error.code).toBe('PHONE_TAKEN');
  });

  it('נתונים לא תקינים → 400 עם פירוט שדות בעברית', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ fullName: 'א', email: 'not-an-email', phone: '123', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['fullName', 'email', 'phone', 'password']));
    expect(res.body.error.details[0].message).toMatch(/[א-ת]/);
  });

  it('JSON שבור → 400 INVALID_JSON', async () => {
    const res = await api().post('/api/auth/register').set('Content-Type', 'application/json').send('{bad').expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('התחברות ו-Token', () => {
  it('login תקין מחזיר Token שעובד ב-/auth/me', async () => {
    const u = await registerUser('דנה');
    const res = await api().post('/api/auth/login').send({ email: u.email.toUpperCase(), password: 'Passw0rd!' }).expect(200);
    const me = await api().get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`).expect(200);
    expect(me.body.user).toMatchObject({ id: u.id, fullName: 'דנה' });
  });

  it('סיסמה שגויה או מייל לא קיים → 401 INVALID_CREDENTIALS', async () => {
    const u = await registerUser();
    const r1 = await api().post('/api/auth/login').send({ email: u.email, password: 'wrong123' }).expect(401);
    expect(r1.body.error.code).toBe('INVALID_CREDENTIALS');
    const r2 = await api().post('/api/auth/login').send({ email: 'nobody@test.com', password: 'wrong123' }).expect(401);
    expect(r2.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('בלי Token → 401 TOKEN_MISSING', async () => {
    const res = await api().get('/api/auth/me').expect(401);
    expect(res.body.error.code).toBe('TOKEN_MISSING');
  });

  it('Token מזויף → 401 TOKEN_INVALID', async () => {
    const forged = jwt.sign({}, 'some-other-secret-some-other-secret', { subject: '1' });
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
    await api().get('/api/auth/me').set('Authorization', 'Bearer garbage').expect(401);
  });

  it('Token שפג תוקפו → 401 TOKEN_EXPIRED', async () => {
    const u = await registerUser();
    const expired = jwt.sign({}, process.env.JWT_SECRET!, { subject: String(u.id), expiresIn: -10 });
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('פרופיל', () => {
  it('עריכת פרופיל, ומייל של משתמש אחר → 409', async () => {
    const a = await registerUser('אסתר');
    const b = await registerUser('בלהה');
    const res = await api().put('/api/users/me').set(auth(a)).send({ fullName: 'שם חדש', phone: '054-111-2222' }).expect(200);
    expect(res.body.user).toMatchObject({ fullName: 'שם חדש', phone: '0541112222' });
    await api().put('/api/users/me').set(auth(a)).send({ email: b.email }).expect(409);
    await api().put('/api/users/me').set(auth(a)).send({}).expect(400);
  });

  it('שינוי סיסמה: סיסמה נוכחית שגויה → 400, תקינה → אפשר להתחבר עם החדשה', async () => {
    const u = await registerUser();
    const bad = await api().put('/api/users/me/password').set(auth(u)).send({ currentPassword: 'nope', newPassword: 'NewPass123' }).expect(400);
    expect(bad.body.error.code).toBe('WRONG_PASSWORD');
    await api().put('/api/users/me/password').set(auth(u)).send({ currentPassword: 'Passw0rd!', newPassword: 'NewPass123' }).expect(200);
    await api().post('/api/auth/login').send({ email: u.email, password: 'NewPass123' }).expect(200);
    await api().post('/api/auth/login').send({ email: u.email, password: 'Passw0rd!' }).expect(401);
  });
});
