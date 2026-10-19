import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../src/docs/openapi';
import { api } from './helpers';

type Op = { security?: unknown[]; responses: Record<string, unknown> };
const operations = Object.entries(openApiDocument.paths as Record<string, Record<string, Op>>).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, op]) => ({ path, method, op })),
);

describe('Swagger / OpenAPI', () => {
  it('/api-docs נפתח, ו-/api-docs.json מחזיר OpenAPI 3', async () => {
    const html = await api().get('/api-docs/').expect(200);
    expect(html.text).toContain('swagger');
    const doc = await api().get('/api-docs.json').expect(200);
    expect(doc.body.openapi).toMatch(/^3\./);
    expect(doc.body.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
  });

  it('מתועדות בדיוק 37 פעולות', () => {
    expect(operations).toHaveLength(37);
  });

  it('כל פעולה מתועדת קיימת בשרת (לא מחזירה ROUTE_NOT_FOUND)', async () => {
    for (const { path, method } of operations) {
      const url = path.replace(/\{[^}]+\}/g, '1');
      const res = await (api() as unknown as Record<string, (u: string) => Promise<{ body: { error?: { code: string } } }>>)[method]!(url);
      expect(res.body?.error?.code, `${method.toUpperCase()} ${path}`).not.toBe('ROUTE_NOT_FOUND');
    }
  });

  it('כל פעולה מוגנת מתעדת 401, וכל ה-$ref מפנים לסכמות קיימות', () => {
    for (const { path, method, op } of operations) {
      const isPublic = Array.isArray(op.security) && op.security.length === 0;
      if (!isPublic) expect(op.responses['401'], `${method} ${path}`).toBeDefined();
    }
    const schemas = Object.keys(openApiDocument.components.schemas);
    const refs = JSON.stringify(openApiDocument).match(/#\/components\/schemas\/[A-Za-z]+/g) ?? [];
    for (const r of refs) expect(schemas).toContain(r.split('/').pop());
  });

  it('docs/openapi.json מעודכן מול הקוד (npm run docs:generate)', () => {
    const file = JSON.parse(readFileSync(join(__dirname, '..', 'docs', 'openapi.json'), 'utf8'));
    expect(file).toEqual(JSON.parse(JSON.stringify(openApiDocument)));
  });
});
