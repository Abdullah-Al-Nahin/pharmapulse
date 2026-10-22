import { Request, Response } from 'express';
import { prisma } from '../server';

export class UserController {
  static async getAllUsers(_req: Request, res: Response) {
    try {
      const users: any = await prisma.$queryRaw`
        SELECT 
          u.id,
          u.username,
          u."fullName" as name,
          u.email,
          u.phone,
          u."branchId",
          u."branchName",
          u."licenseNumber",
          u.status,
          r.name as "roleName",
          r.slug as "roleCode",
          r.id as "roleId"
        FROM "users" u
        LEFT JOIN "roles" r ON u."roleId" = r.id
        ORDER BY u."createdAt" ASC
      `;

      // Map to frontend AuthUser format
      const mapped = users.map((u: any) => ({
        id: u.id,
        name: u.name || u.username,
        email: u.email,
        phone: u.phone,
        roleCode: u.roleCode || 'cashier',
        roleName: u.roleName || 'Cashier',
        branchId: u.branchId || 'br-snakra',
        branchName: u.branchName || 'snakra',
        licenseNumber: u.licenseNumber,
        maxDiscountPercent: u.roleCode === 'super_admin' ? 100 : u.roleCode === 'pharmacy_manager' ? 30 : u.roleCode === 'pharmacist' ? 10 : 5,
        canViewPurchaseCosts: ['super_admin', 'pharmacy_manager', 'purchase_officer', 'accountant'].includes(u.roleCode),
        canViewProfitMargins: ['super_admin', 'pharmacy_manager', 'accountant'].includes(u.roleCode),
        canViewAccounting: ['super_admin', 'pharmacy_manager', 'accountant'].includes(u.roleCode),
        permissions: u.roleCode === 'super_admin' ? ['*'] : [`${u.roleCode}:access`],
      }));

      res.json(mapped);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async createUser(req: Request, res: Response) {
    try {
      const { name, email, phone, roleCode, branchId, branchName, licenseNumber, password } = req.body;
      const role = await prisma.role.findFirst({ where: { slug: roleCode } });
      const roleId = role ? role.id : (await prisma.role.findFirst())?.id || 'role-default';
      const newId = `user-emp-${Date.now()}`;
      const username = (email || name || 'user').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');

      await prisma.$executeRawUnsafe(`
        INSERT INTO "users" ("id", "username", "fullName", "email", "phone", "passwordHash", "roleId", "branchId", "branchName", "licenseNumber", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, newId, username, name, email, phone || null, 'hashed_pw_pharma123', roleId, branchId || 'br-snakra', branchName || 'snakra', licenseNumber || null);

      res.status(201).json({
        id: newId,
        name,
        email,
        phone,
        roleCode: role?.slug || 'cashier',
        roleName: role?.name || 'Cashier',
        branchId: branchId || 'br-snakra',
        branchName: branchName || 'snakra',
        licenseNumber
      });
    } catch (error: any) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, email, phone, roleCode, branchId, branchName, licenseNumber } = req.body;

      let roleId = undefined;
      if (roleCode) {
        const role = await prisma.role.findFirst({ where: { slug: roleCode } });
        if (role) roleId = role.id;
      }

      await prisma.$executeRawUnsafe(`
        UPDATE "users"
        SET 
          "fullName" = COALESCE($2, "fullName"),
          "email" = COALESCE($3, "email"),
          "phone" = COALESCE($4, "phone"),
          "roleId" = COALESCE($5, "roleId"),
          "branchId" = COALESCE($6, "branchId"),
          "branchName" = COALESCE($7, "branchName"),
          "licenseNumber" = COALESCE($8, "licenseNumber"),
          "updatedAt" = NOW()
        WHERE "id" = $1
      `, id, name, email, phone, roleId, branchId, branchName, licenseNumber);

      res.json({ success: true, message: 'User updated in database' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.$executeRawUnsafe(`DELETE FROM "users" WHERE "id" = $1`, id);
      res.json({ success: true, message: 'User deleted from database' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getAllRoles(_req: Request, res: Response) {
    try {
      const roles = await prisma.role.findMany({
        orderBy: { name: 'asc' }
      });
      res.json(roles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
