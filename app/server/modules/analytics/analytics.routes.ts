import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import { answerQuery } from './analytics.service';

export const analyticsRouter = Router();

analyticsRouter.post('/admin/api/analytics/query', requireAdmin, async (req, res, next) => {
  try {
    if (!req.adminUser!.isSuperAdmin) {
      return res.status(403).json({ ok: false, error: 'Solo super administradores pueden usar Analytics.' });
    }
    const pregunta = String(req.body?.pregunta || '').trim();
    if (!pregunta) return res.status(400).json({ ok: false, error: 'Escribí una pregunta.' });
    if (pregunta.length > 1000) return res.status(400).json({ ok: false, error: 'La pregunta es demasiado larga.' });
    const result = await answerQuery(pregunta, req.adminUser!);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});
