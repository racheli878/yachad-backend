import { Prisma } from '@prisma/client';

/**
 * כל החישובים הכספיים נעשים באגורות (מספרים שלמים) כדי למנוע טעויות עיגול.
 */
export const toCents = (value: Prisma.Decimal | number | string): number =>
  Math.round(Number(value) * 100);

export const fromCents = (cents: number): number => cents / 100;

/** Decimal של Prisma → מספר רגיל ב-JSON */
export const decimalToNumber = (value: Prisma.Decimal | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

export const round2 = (n: number): number => Math.round(n * 100) / 100;
