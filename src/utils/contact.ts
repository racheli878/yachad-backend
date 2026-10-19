/**
 * נרמול מייל וטלפון כדי שהשוואה בין הזמנה למשתמש תעבוד תמיד.
 */

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * מחזיר טלפון ישראלי בפורמט ספרות בלבד שמתחיל ב-0, למשל 0501234567.
 * מקבל גם "050-123-4567", "+972501234567", "972 50 123 4567".
 * אם הפורמט לא תקין – מחזיר null.
 */
export const normalizePhone = (phone: string): string | null => {
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('972')) digits = '0' + digits.slice(3);
  if (!/^0\d{8,9}$/.test(digits)) return null;
  return digits;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = (value: string): boolean => EMAIL_REGEX.test(value.trim());

/**
 * מזהה אוטומטית אם הטקסט הוא מייל או טלפון (לשדה "טלפון או מייל" באשף).
 */
export const detectContact = (
  value: string,
): { email: string } | { phone: string } | null => {
  if (value.includes('@')) {
    return isEmail(value) ? { email: normalizeEmail(value) } : null;
  }
  const phone = normalizePhone(value);
  return phone ? { phone } : null;
};
