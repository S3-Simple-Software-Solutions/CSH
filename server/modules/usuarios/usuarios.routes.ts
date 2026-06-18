import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import { findUserById, isPasswordManagedByEnv, listUsers, setAdminUserPassword } from './usuarios.service';

export const usuariosRouter = Router();

usuariosRouter.get('/admin/api/users', requireAdmin, async (_req, res, next) => {
  try {
    res.json({ ok: true, users: await listUsers() });
  } catch (err) {
    next(err);
  }
});

usuariosRouter.post('/admin/api/users/password', requireAdmin, async (req, res, next) => {
  try {
    if (req.adminUser!.parkingRole !== 'admin') return res.status(403).json({ ok: false, error: 'Solo administradores pueden cambiar contrasenas' });
    const target = await findUserById(req.body.userId);
    if (!target) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    if (isPasswordManagedByEnv(target)) return res.status(400).json({ ok: false, error: 'La clave del administrador principal se gestiona por variables de entorno' });
    const password = String(req.body.password || '');
    if (password.length < 8 || password.length > 80) return res.status(400).json({ ok: false, error: 'La contrasena debe tener entre 8 y 80 caracteres' });
    const user = await setAdminUserPassword(target.id, password);
    res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    next(err);
  }
});
