import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import {
  createCupon,
  getAdminCuponera,
  getPublicCuponera,
  patchCupon,
  removeCupon,
  setCuponEstado,
} from './cuponera.service';

export const cuponeraRouter = Router();

cuponeraRouter.get('/api/cuponera/publico', async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await getPublicCuponera()) });
  } catch (err) {
    next(err);
  }
});

cuponeraRouter.get('/admin/api/cuponera', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await getAdminCuponera(req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

cuponeraRouter.post('/admin/api/cuponera', requireAdmin, async (req, res, next) => {
  try {
    res.status(201).json({ ok: true, ...(await createCupon(req.adminUser!, req.body)) });
  } catch (err) {
    next(err);
  }
});

cuponeraRouter.patch('/admin/api/cuponera/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await patchCupon(req.adminUser!, String(req.params.id), req.body)) });
  } catch (err) {
    next(err);
  }
});

cuponeraRouter.delete('/admin/api/cuponera/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await removeCupon(req.adminUser!, String(req.params.id))) });
  } catch (err) {
    next(err);
  }
});

cuponeraRouter.post('/admin/api/cuponera/:id/estado', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await setCuponEstado(req.adminUser!, String(req.params.id), String(req.body.estado || ''))) });
  } catch (err) {
    next(err);
  }
});
