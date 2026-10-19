import { ActivityType, EventCategory, EventRole, EventStatus } from '@prisma/client';
import { z } from 'zod';
import { optionalText } from '../../utils/validate';
import { inviteesListSchema } from '../invitations/invitations.schemas';
import { questionsListSchema } from '../survey/survey.schemas';

const eventDateSchema = z
  .string()
  .datetime({ offset: true })
  .nullish()
  .transform((v) => (v === undefined ? undefined : v === null ? null : new Date(v)));

const budgetSchema = z
  .number()
  .min(0)
  .max(1_000_000)
  .multipleOf(0.01)
  .nullish();

/** השדות של מפגש שאפשר לקבוע ביצירה ולשנות בעריכה */
const eventFields = {
  description: optionalText(1000),
  eventDate: eventDateSchema,
  location: optionalText(200),
  food: optionalText(500),
  category: z.nativeEnum(EventCategory).optional(),
  activityType: z.nativeEnum(ActivityType).optional(),
  status: z.nativeEnum(EventStatus).optional(),
  budget: budgetSchema,
};

/** POST /events – אשף היצירה: פרטים + מוזמנים + שאלות סקר בבקשה אחת */
export const createEventSchema = z
  .object({
    title: z.string().trim().min(2).max(100),
    ...eventFields,
    invitees: inviteesListSchema.default([]),
    questions: questionsListSchema.default([]),
  })
  .strict();

/** PUT /events/:eventId – עדכון חלקי: שולחים רק את מה שמשתנה. null = ריקון השדה */
export const updateEventSchema = z
  .object({
    title: z.string().trim().min(2).max(100).optional(),
    ...eventFields,
  })
  .strict()
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'יש לשלוח לפחות שדה אחד לעדכון',
  });

/** GET /events – כל הפרמטרים רשות. בלי פרמטרים מוחזרים כל המפגשים שלי */
export const listEventsQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    category: z.nativeEnum(EventCategory).optional(),
    activityType: z.nativeEnum(ActivityType).optional(),
    status: z.nativeEnum(EventStatus).optional(),
    myRole: z.nativeEnum(EventRole).optional(),
    timeframe: z.enum(['upcoming', 'past', 'all']).default('all'),
    sortBy: z.enum(['eventDate', 'createdAt']).default('eventDate'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
