import { Request, Response } from 'express';
import { prisma } from '../server';

export class CustomerController {
  static async getAllCustomers(req: Request, res: Response) {
    try {
      const { search } = req.query;

      const customers = await prisma.customer.findMany({
        where: search ? {
          OR: [
            { name: { contains: search as string, mode: 'insensitive' } },
            { phone: { contains: search as string } }
          ]
        } : undefined,
        orderBy: { createdAt: 'desc' }
      });

      // Map to frontend Customer model
      const mapped = customers.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email || '',
        address: c.address || '',
        customerType: c.customerType ? c.customerType.toLowerCase() : 'retail',
        pricingTier: 'retail',
        creditLimit: Number(c.creditLimit || 0),
        outstandingBalance: Number(c.outstandingBalance || 0),
        loyaltyPoints: c.loyaltyPointsBalance || 0,
        totalSpent: Number(c.outstandingBalance || 0) * 2.5,
        totalOrders: 5,
        status: 'active',
        notes: c.allergyNotes || '',
        createdAt: c.createdAt.toISOString().split('T')[0]
      }));

      res.json(mapped);
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async createCustomer(req: Request, res: Response) {
    try {
      const { name, phone, email, address, customerType, creditLimit, pricingTier } = req.body;
      const count = await prisma.customer.count();
      const customerCode = `CUST-${String(count + 1).padStart(4, '0')}`;

      const customer = await prisma.customer.create({
        data: {
          customerCode,
          name,
          phone,
          email: email || null,
          address: address || null,
          customerType: (customerType || 'RETAIL').toUpperCase(),
          creditLimit: creditLimit ? Number(creditLimit) : 0,
          outstandingBalance: 0,
          loyaltyPointsBalance: 0
        }
      });

      res.status(201).json({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        address: customer.address || '',
        customerType: customer.customerType.toLowerCase(),
        pricingTier: pricingTier || 'retail',
        creditLimit: Number(customer.creditLimit),
        outstandingBalance: 0,
        loyaltyPoints: 0,
        totalSpent: 0,
        totalOrders: 0,
        status: 'active',
        createdAt: customer.createdAt.toISOString().split('T')[0]
      });
    } catch (error: any) {
      console.error('Error creating customer:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async updateCustomer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, phone, email, address, customerType, creditLimit, outstandingBalance, loyaltyPoints } = req.body;

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          name: name ? String(name) : undefined,
          phone: phone ? String(phone) : undefined,
          email: email !== undefined ? email : undefined,
          address: address !== undefined ? address : undefined,
          customerType: customerType ? customerType.toUpperCase() : undefined,
          creditLimit: creditLimit !== undefined ? Number(creditLimit) : undefined,
          outstandingBalance: outstandingBalance !== undefined ? Number(outstandingBalance) : undefined,
          loyaltyPointsBalance: loyaltyPoints !== undefined ? Number(loyaltyPoints) : undefined
        }
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
