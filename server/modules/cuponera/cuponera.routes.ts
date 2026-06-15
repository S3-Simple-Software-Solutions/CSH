import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import { getAdminCuponera, getPublicCuponera, setCuponEstado } from './cuponera.service';

export const cuponeraRouter = Router();

cuponeraRouter.get('/api/cuponera/publico', (_req, res) => {
  res.json({ ok: true, ...getPublicCuponera() });
});

cuponeraRouter.get('/admin/api/cuponera', requireAdmin, (req, res) => {
  res.json({ ok: true, ...getAdminCuponera(req.adminUser!) });
});

cuponeraRouter.post('/admin/api/cuponera/:id/estado', requireAdmin, (req, res, next) => {
  try {
    res.json({ ok: true, ...setCuponEstado(req.adminUser!, String(req.params.id), String(req.body.estado || '')) });
  } catch (err) {
    next(err);
  }
});
