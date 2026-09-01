import { Router } from 'express';
import { User } from '../models/User.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/normalize.js';
import { ADMIN_PERMISSIONS, OPERATOR_PERMISSIONS, PERMISSIONS } from '../utils/permissions.js';
import { audit } from '../services/audit.js';
import { objectId, paginationQuery, userCreateSchema, userUpdateSchema } from './schemas.js';
import { z } from 'zod';

export const usersRouter = Router();
usersRouter.use(authenticate);

usersRouter.get('/permissions', requirePermission('users:view'), (_req, res) => {
  res.json({ permissions: PERMISSIONS });
});

usersRouter.get('/', requirePermission('users:view'), validate(paginationQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, search, active } = req.validatedQuery as z.infer<typeof paginationQuery>;
  const filter: Record<string, unknown> = {};
  if (active !== 'all') filter.active = active === 'true';
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { username: rx }, { role: rx }];
  }
  const [data, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter)
  ]);
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

usersRouter.post('/', requirePermission('users:create'), validate(userCreateSchema), asyncHandler(async (req, res) => {
  const input = req.body;
  const permissions = input.role === 'admin'
    ? ADMIN_PERMISSIONS
    : (input.permissions.length ? input.permissions : OPERATOR_PERMISSIONS);
  const user = await User.create({
    ...input,
    passwordHash: await User.hashPassword(input.password),
    password: undefined,
    permissions
  });
  await audit(req, 'create', 'user', user.id, { username: user.username, role: user.role });
  res.status(201).json({ data: user, message: 'Usuario creado.' });
}));

usersRouter.put('/:id', requirePermission('users:edit'), validate(z.object({ id: objectId }), 'params'), validate(userUpdateSchema), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('+passwordHash');
  if (!user) throw new AppError('Usuario no encontrado.', 404);

  if (req.body.role === 'operator' && user.role === 'admin') {
    const otherAdmins = await User.countDocuments({ _id: { $ne: user._id }, role: 'admin', active: true });
    if (otherAdmins === 0) throw new AppError('Debe permanecer al menos un administrador activo.', 409);
  }
  if (req.body.active === false && user.role === 'admin') {
    const otherAdmins = await User.countDocuments({ _id: { $ne: user._id }, role: 'admin', active: true });
    if (otherAdmins === 0) throw new AppError('No puedes desactivar al unico administrador.', 409);
  }

  const { password, revision, ...changes } = req.body;
  if (revision !== undefined && user.get('revision') !== revision) throw new AppError('El usuario fue modificado en otra ventana. Actualiza e intenta nuevamente.', 409);
  Object.assign(user, changes);
  if (changes.role === 'admin') user.permissions = [...ADMIN_PERMISSIONS];
  if (password) user.passwordHash = await User.hashPassword(password);
  if (password || changes.active === false) user.tokenVersion += 1;
  await user.save();
  await audit(req, 'update', 'user', user.id, { fields: Object.keys(changes), passwordChanged: Boolean(password) });
  res.json({ data: user, message: 'Usuario actualizado.' });
}));

usersRouter.patch('/:id/deactivate', requirePermission('users:deactivate'), validate(z.object({ id: objectId }), 'params'), asyncHandler(async (req, res) => {
  if (req.params.id === req.user?.id) throw new AppError('No puedes desactivar tu propia cuenta.', 409);
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('Usuario no encontrado.', 404);
  if (user.role === 'admin') {
    const otherAdmins = await User.countDocuments({ _id: { $ne: user._id }, role: 'admin', active: true });
    if (otherAdmins === 0) throw new AppError('No puedes desactivar al unico administrador.', 409);
  }
  user.active = false;
  user.tokenVersion += 1;
  await user.save();
  await audit(req, 'deactivate', 'user', user.id);
  res.json({ message: 'Usuario desactivado.' });
}));
