import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import apiRoutes from './routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Global Prisma Client (singleton)
export const prisma = new PrismaClient();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    try {
      const hostname = new URL(origin).hostname;
      if (
        allowedOrigins.includes(origin) ||
        hostname.endsWith('.vercel.app') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1'
      ) {
        return callback(null, true);
      }
    } catch {
      return callback(new Error('Invalid Origin header'));
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(helmet());
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});
app.use(express.json());

// Health Check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected', version: '2.0.0', capabilities: ['users', 'branches', 'customers', 'adjustments', 'transfers', 'system'] });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: String(error) });
  }
});

// API Routes
app.use('/api', apiRoutes);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Start Server
app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
  console.log(`[server]: Health check at http://localhost:${port}/health`);
  console.log(`[server]: Telemetry API at http://localhost:${port}/api/telemetry/snapshot`);
});
