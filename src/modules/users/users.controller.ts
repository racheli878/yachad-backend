import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { parse } from '../../utils/validate';
import { changePasswordSchema, updateProfileSchema } from './users.schemas';
import * as usersService from './users.service';

export const updateMe = async (req: Request, res: Response) => {
  const input = parse(updateProfileSchema, req.body);
  res.json(await usersService.updateProfile(currentUser(req).id, input));
};

export const changePassword = async (req: Request, res: Response) => {
  const input = parse(changePasswordSchema, req.body);
  res.json(await usersService.changePassword(currentUser(req).id, input));
};
