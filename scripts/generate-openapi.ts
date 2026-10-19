/**
 * יוצר את הקובץ docs/openapi.json מתוך התיעוד שבקוד.
 * הרצה: npm run docs:generate
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openApiDocument } from '../src/docs/openapi';

const target = join(__dirname, '..', 'docs', 'openapi.json');
writeFileSync(target, JSON.stringify(openApiDocument, null, 2) + '\n', 'utf8');
console.log(`✅ נוצר ${target}`);
