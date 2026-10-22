import { Router } from 'express';
import { RbacController } from '../controllers/rbacController';
import { authenticateToken, requirePermission } from '../middleware/rbacMiddleware';

export const rbacRouter = Router();

// Public / Internal catalogs
rbacRouter.get('/permissions', RbacController.getPermissionsCatalog);
rbacRouter.get('/roles', RbacController.getRoles);

// Super Admin Dynamic Role Configuration Endpoints
rbacRouter.post(
  '/roles',
  authenticateToken,
  requirePermission('rbac:roles:manage'),
  RbacController.createRole
);

rbacRouter.put(
  '/roles/:id',
  authenticateToken,
  requirePermission('rbac:roles:manage'),
  RbacController.updateRole
);

rbacRouter.delete(
  '/roles/:id',
  authenticateToken,
  requirePermission('rbac:roles:manage'),
  RbacController.deleteRole
);

export const authRouter = Router();

// Token issuance & active profile
authRouter.post('/token', RbacController.issueToken);
authRouter.get('/current-user', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

export default rbacRouter;
