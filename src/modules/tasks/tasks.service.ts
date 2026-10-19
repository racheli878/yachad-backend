import { prisma } from '../../db/prisma';
import { conflict, forbidden, notFound } from '../../utils/AppError';
import { toTask } from '../events/events.serializer';

const assigneeInclude = { assignee: { select: { id: true, fullName: true } } } as const;

const findTask = async (eventId: number, taskId: number) => {
  const task = await prisma.task.findFirst({ where: { id: taskId, eventId }, include: assigneeInclude });
  if (!task) throw notFound('התפקיד לא נמצא', 'TASK_NOT_FOUND');
  return task;
};

export const listTasks = async (eventId: number, userId: number) => {
  const tasks = await prisma.task.findMany({
    where: { eventId },
    orderBy: { createdAt: 'asc' },
    include: assigneeInclude,
  });
  const items = tasks.map((t) => toTask(t, userId));
  return {
    count: items.length,
    openCount: items.filter((t) => !t.isTaken).length,
    tasks: items,
  };
};

export const createTask = async (eventId: number, userId: number, description: string) => {
  const task = await prisma.task.create({ data: { eventId, description }, include: assigneeInclude });
  return { task: toTask(task, userId) };
};

/** ⭐ כלל: המארגן עורך / מוחק רק תפקיד שעדיין פנוי */
const assertTaskIsFree = (task: { assigneeId: number | null }) => {
  if (task.assigneeId !== null) {
    throw conflict('TASK_TAKEN', 'אי אפשר לשנות או למחוק תפקיד שכבר נלקח');
  }
};

export const updateTask = async (eventId: number, taskId: number, userId: number, description: string) => {
  assertTaskIsFree(await findTask(eventId, taskId));
  // התנאי assigneeId: null מבטיח שלא נשנה תפקיד שנלקח בדיוק באותו רגע
  const { count } = await prisma.task.updateMany({
    where: { id: taskId, eventId, assigneeId: null },
    data: { description },
  });
  if (count === 0) throw conflict('TASK_TAKEN', 'אי אפשר לשנות או למחוק תפקיד שכבר נלקח');
  return { task: toTask(await findTask(eventId, taskId), userId) };
};

export const deleteTask = async (eventId: number, taskId: number) => {
  assertTaskIsFree(await findTask(eventId, taskId));
  const { count } = await prisma.task.deleteMany({ where: { id: taskId, eventId, assigneeId: null } });
  if (count === 0) throw conflict('TASK_TAKEN', 'אי אפשר לשנות או למחוק תפקיד שכבר נלקח');
  return { message: 'התפקיד נמחק' };
};

/**
 * לקיחת תפקיד – פעולה אטומית: העדכון מצליח רק אם התפקיד עדיין פנוי.
 * אם שניים לוחצים באותו רגע, רק אחד מצליח והשני מקבל 409.
 */
export const claimTask = async (eventId: number, taskId: number, userId: number) => {
  const { count } = await prisma.task.updateMany({
    where: { id: taskId, eventId, assigneeId: null },
    data: { assigneeId: userId },
  });
  if (count === 0) {
    const task = await findTask(eventId, taskId); // 404 אם לא קיים
    if (task.assigneeId === userId) throw conflict('TASK_ALREADY_MINE', 'התפקיד כבר שלך');
    throw conflict('TASK_ALREADY_TAKEN', 'התפקיד כבר נלקח ע"י משתתף אחר');
  }
  return { task: toTask(await findTask(eventId, taskId), userId) };
};

/** ⭐ כלל: כל אחד משחרר רק תפקיד שהוא עצמו לקח (גם המארגן) */
export const releaseTask = async (eventId: number, taskId: number, userId: number) => {
  const task = await findTask(eventId, taskId);
  if (task.assigneeId === null) throw conflict('TASK_NOT_TAKEN', 'התפקיד כבר פנוי');
  if (task.assigneeId !== userId) throw forbidden('אפשר לשחרר רק תפקיד שלקחת בעצמך', 'NOT_YOUR_TASK');
  await prisma.task.updateMany({ where: { id: taskId, assigneeId: userId }, data: { assigneeId: null } });
  return { task: toTask(await findTask(eventId, taskId), userId) };
};
