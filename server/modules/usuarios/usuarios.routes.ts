import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import { ADMIN_USERS } from './usuarios.data';
import { listUsers, setAdminUserPassword } from './usuarios.service';

export const usuariosRouter = Router();

usuariosRouter.get('/admin/api/users', requireAdmin, (_req, res) => {
  res.json({ ok: true, users: listUsers() });
});

usuariosRouter.post('/admin/api/users/password', requireAdmin, async (req, res, next) => {
  try {
    if (req.adminUser!.parkingRole !== 'admin') return res.status(403).json({ ok: false, error: 'Solo administradores pueden cambiar contrasenas' });
    const target = ADMIN_USERS.find((u) => u.id === req.body.userId);
    if (!target) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    const password = String(req.body.password || '');
    if (password.length < 8 || password.length > 80) return res.status(400).json({ ok: false, error: 'La contrasena debe tener entre 8 y 80 caracteres' });
    await setAdminUserPassword(target.id, password);
    res.json({ ok: true, user: { id: target.id, name: target.name, email: target.email } });
  } catch (err) {
    next(err);
  }
});
