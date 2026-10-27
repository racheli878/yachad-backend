import { EventStatus } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma';

/**
 * מפגש "בתכנון" או "נקבע" שהתאריך שלו כבר עבר מסומן אוטומטית "הסתיים".
 * רץ לפני כל בקשה ל-API, כך שהסטטוס תמיד מעודכן גם בלי שהמארגן ישנה אותו בעצמו.
 */
export const closePastEvents = async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    await prisma.event.updateMany({
      where: {
        status: { in: [EventStatus.PLANNING, EventStatus.SCHEDULED] },
        eventDate: { lt: new Date() },
      },
      data: { status: EventStatus.COMPLETED },
    });
    next();
  } catch (err) {
    next(err);
  }
};
