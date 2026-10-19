import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { parse } from '../../utils/validate';
import { loginSchema, registerSchema } from './auth.schemas';
import * as authService from './auth.service';

export const register = async (req: Request, res: Response) => {
  const input = parse(registerSchema, req.body);
  res.status(201).json(await authService.register(input));
};

export const login = async (req: Request, res: Response) => {
  const input = parse(loginSchema, req.body);
  res.json(await authService.login(input));
};

export const me = async (req: Request, res: Response) => {
  res.json(await authService.getMe(currentUser(req).id));
};
