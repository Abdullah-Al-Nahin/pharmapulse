import { Request, Response, NextFunction } from 'express';

export interface AuditRecordPayload {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  targetEntityId: string;
  targetEntityType: string;
  clientIp: string;
  userAgent?: string;
  beforeState: Record<string, any> | null;
  afterState: Record<string, any> | null;
  summary: string;
}

// In-memory append-only audit repository (mirrors Prisma schema & DB)
const immutableAuditStore: AuditRecordPayload[] = [];

/**
 * Express Middleware: Captures all state mutations (POST, PUT, PATCH, DELETE),
 * reads before-state, records response after-state, and generates an immutable audit entry.
 */
export function auditLoggingMiddleware(options?: {
  moduleName?: string;
  entityType?: string;
  getBeforeState?: (req: Request) => Promise<Record<string, any> | null> | Record<string, any> | null;
  getEntityId?: (req: Request, res: Response) => string;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only capture mutation methods (POST, PUT, PATCH, DELETE)
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
    if (!isMutation) {
      return next();
    }

    // Extract client IP address safely
    const clientIp = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const user = req.user || {
      userId: 'anonymous-or-system',
      name: 'System / Unauthenticated',
      roleCode: 'GUEST'
    };

    // Determine Action Type
    let action = 'UPDATE';
    if (req.method === 'POST') action = 'CREATE';
    else if (req.method === 'DELETE') action = 'DELETE';
    else if (req.path.includes('/adjust')) action = 'ADJUST';
    else if (req.path.includes('/approve')) action = 'APPROVE';
    else if (req.path.includes('/reject')) action = 'REJECT';

    // Determine Module Name
    const pathParts = req.baseUrl ? req.baseUrl.split('/') : req.path.split('/');
    const inferredModule = options?.moduleName || pathParts[2] || 'system';

    // Capture Before-State snapshot
    let beforeState: Record<string, any> | null = null;
    if (options?.getBeforeState) {
      try {
        beforeState = await options.getBeforeState(req);
      } catch {
        beforeState = null;
      }
    }

    // Intercept res.json / res.send to capture After-State
    const originalJson = res.json.bind(res);
    let afterState: Record<string, any> | null = null;

    res.json = (body: any) => {
      // Only capture successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        afterState = body && typeof body === 'object' ? (body.data || body) : { raw: body };

        const targetEntityId = options?.getEntityId 
          ? options.getEntityId(req, res)
          : req.params.id || body?.id || body?.data?.id || 'N/A';

        const record: AuditRecordPayload = {
          id: `AUD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          timestamp: new Date().toISOString(),
          userId: user.userId,
          userName: user.name,
          userRole: user.roleCode,
          action,
          module: inferredModule,
          targetEntityId: String(targetEntityId),
          targetEntityType: options?.entityType || 'Entity',
          clientIp,
          userAgent: req.headers['user-agent'],
          beforeState,
          afterState,
          summary: `${action} on ${options?.entityType || inferredModule} (ID: ${targetEntityId}) by ${user.name}`
        };

        // Append to immutable log store
        immutableAuditStore.push(record);
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Controller endpoint to view audit logs (Read-Only)
 */
export function getAuditLogsEndpoint(req: Request, res: Response): void {
  const { module, action, userId, searchQuery, limit = '50', offset = '0' } = req.query;

  let filtered = [...immutableAuditStore].reverse();

  if (module && module !== 'all') {
    filtered = filtered.filter(l => l.module === module);
  }
  if (action && action !== 'all') {
    filtered = filtered.filter(l => l.action === action);
  }
  if (userId && userId !== 'all') {
    filtered = filtered.filter(l => l.userId === userId);
  }
  if (searchQuery) {
    const q = String(searchQuery).toLowerCase();
    filtered = filtered.filter(l => 
      l.summary.toLowerCase().includes(q) ||
      l.targetEntityId.toLowerCase().includes(q) ||
      l.userName.toLowerCase().includes(q) ||
      l.clientIp.toLowerCase().includes(q)
    );
  }

  const numLimit = parseInt(String(limit), 10) || 50;
  const numOffset = parseInt(String(offset), 10) || 0;
  const paginated = filtered.slice(numOffset, numOffset + numLimit);

  res.json({
    success: true,
    total: filtered.length,
    limit: numLimit,
    offset: numOffset,
    logs: paginated
  });
}

/**
 * Hard delete prohibition: Any DELETE request to the audit trail is rejected with 403 Forbidden.
 */
export function preventAuditLogDeletion(_req: Request, res: Response): void {
  res.status(403).json({
    error: 'Forbidden',
    code: 'AUDIT_LOG_IMMUTABLE',
    message: 'Regulatory compliance policy: Hard deletion of audit trail entries is strictly forbidden.'
  });
}
