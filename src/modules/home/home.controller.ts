import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { getHome } from './home.service';

export const home = async (req: Request, res: Response) => {
  res.json(await getHome(currentUser(req)));
};
