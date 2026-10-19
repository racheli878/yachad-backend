import { z, ZodErrorMap, ZodIssueCode } from 'zod';

/**
 * הודעות שגיאה בעברית לכל הוולידציות (Zod).
 * כך כל שדה לא תקין מקבל הודעה ברורה שאפשר להציג ישירות בטופס.
 */
const hebrewErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') return { message: 'שדה חובה' };
      if (issue.received === 'null') return { message: 'השדה אינו יכול להיות ריק' };
      return { message: `סוג ערך לא תקין (נדרש ${translateType(issue.expected)})` };
    case ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: `נדרשים לפחות ${issue.minimum} תווים` };
      if (issue.type === 'array') return { message: `נדרשים לפחות ${issue.minimum} פריטים` };
      if (issue.type === 'number')
        return {
          message: issue.inclusive ? `הערך חייב להיות ${issue.minimum} ומעלה` : `הערך חייב להיות גדול מ-${issue.minimum}`,
        };
      break;
    case ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `מותר עד ${issue.maximum} תווים` };
      if (issue.type === 'array') return { message: `מותר עד ${issue.maximum} פריטים` };
      if (issue.type === 'number') return { message: `הערך המקסימלי הוא ${issue.maximum}` };
      break;
    case ZodIssueCode.invalid_enum_value:
      return { message: `ערך לא תקין. ערכים אפשריים: ${issue.options.join(', ')}` };
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'כתובת מייל לא תקינה' };
      if (issue.validation === 'datetime') return { message: 'תאריך לא תקין (נדרש פורמט ISO, למשל 2026-12-15T18:00:00.000Z)' };
      return { message: 'ערך לא תקין' };
    case ZodIssueCode.unrecognized_keys:
      return { message: `שדות לא מוכרים: ${issue.keys.join(', ')}` };
    case ZodIssueCode.invalid_date:
      return { message: 'תאריך לא תקין' };
    case ZodIssueCode.not_multiple_of:
      return { message: 'מותרות עד 2 ספרות אחרי הנקודה' };
    default:
      break;
  }
  return { message: ctx.defaultError };
};

const translateType = (t: string): string =>
  ({ string: 'טקסט', number: 'מספר', integer: 'מספר שלם', boolean: 'true / false', array: 'מערך', object: 'אובייקט' })[t] ?? t;

z.setErrorMap(hebrewErrorMap);
