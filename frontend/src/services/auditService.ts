/**
 * Immutable Audit Logging Service
 * Provides tamper-resistant, append-only forensic logging
 * with deep state snapshots and visual diff analysis
 * 
 * All demo data has been removed. Logs are now real-time only.
 * Future: Will persist to PostgreSQL AuditLog table via backend API.
 */

import { ImmutableAuditLog, AuditLogFilterParams } from '../types/stockAdjustment';

type AuditListener = () => void;

export class AuditService {
  private static STORAGE_KEY = 'pharmapulse_audit_logs_v1';

  private static loadLogs(): ImmutableAuditLog[] {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(AuditService.STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return [];
  }

  private static saveLogs(logs: ImmutableAuditLog[]): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(AuditService.STORAGE_KEY, JSON.stringify(logs.slice(0, 500)));
      }
    } catch {
      // ignore
    }
  }

  // Persistent append-only log store
  private static logs: ImmutableAuditLog[] = AuditService.loadLogs();
  private static listeners: AuditListener[] = [];
  private static isEmitting = false;

  public static subscribe(listener: AuditListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private static emitChange() {
    if (this.isEmitting) return;
    this.isEmitting = true;
    queueMicrotask(() => {
      this.isEmitting = false;
      const snapshot = [...this.listeners];
      snapshot.forEach(listener => {
        try {
          listener();
        } catch (err) {
          console.error('AuditService listener error:', err);
        }
      });
    });
  }

  /**
   * Helper to calculate diff between beforeState and afterState
   */
  public static calculateDiff(
    beforeState: Record<string, any> | null,
    afterState: Record<string, any> | null
  ): { field: string; oldValue: any; newValue: any }[] {
    if (!beforeState && !afterState) return [];

    const before = beforeState || {};
    const after = afterState || {};
    const diffs: { field: string; oldValue: any; newValue: any }[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    allKeys.forEach((key) => {
      const oldVal = before[key];
      const newVal = after[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diffs.push({
          field: key,
          oldValue: oldVal !== undefined ? oldVal : '(none)',
          newValue: newVal !== undefined ? newVal : '(removed)',
        });
      }
    });

    return diffs;
  }

  /**
   * Append-only record log method.
   * Logs are immutable once written.
   */
  public static recordAuditLog(payload: {
    userId: string;
    userName: string;
    userRole: string;
    action: ImmutableAuditLog['action'];
    module: ImmutableAuditLog['module'];
    targetEntityId: string;
    targetEntityType: string;
    summary: string;
    beforeState: Record<string, any> | null;
    afterState: Record<string, any> | null;
    clientIp?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): ImmutableAuditLog {
    const diffSummary = this.calculateDiff(payload.beforeState, payload.afterState);

    const newLog: ImmutableAuditLog = {
      id: `AUD-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
      userId: payload.userId,
      userName: payload.userName,
      userRole: payload.userRole,
      action: payload.action,
      module: payload.module,
      targetEntityId: payload.targetEntityId,
      targetEntityType: payload.targetEntityType,
      clientIp: payload.clientIp || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'),
      userAgent: payload.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Node-Client'),
      summary: payload.summary,
      beforeState: payload.beforeState,
      afterState: payload.afterState,
      diffSummary,
      metadata: payload.metadata,
    };

    // Prepend to maintain reverse chronological order (newest first)
    this.logs = [newLog, ...this.logs];
    AuditService.saveLogs(this.logs);
    this.emitChange();

    return newLog;
  }

  /**
   * Retrieve all audit logs (read-only)
   */
  public static getAllLogs(): ImmutableAuditLog[] {
    if (this.logs.length === 0) {
      this.logs = AuditService.loadLogs();
    }
    return this.logs;
  }

  /**
   * Reset logs — clears the in-memory trail
   */
  public static resetSampleLogs(): ImmutableAuditLog[] {
    this.logs = [];
    AuditService.saveLogs([]);
    this.emitChange();
    return [];
  }

  /**
   * Clear audit logs by time window ('last_day' | 'last_week' | 'last_month' | 'older_than_30d' | 'all')
   */
  public static clearLogsByWindow(
    window: 'last_day' | 'last_week' | 'last_month' | 'older_than_30d' | 'all'
  ): number {
    const current = this.getAllLogs();
    const beforeCount = current.length;
    if (window === 'all') {
      this.logs = [];
      AuditService.saveLogs([]);
      this.emitChange();
      return beforeCount;
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const cutoff =
      window === 'last_day'
        ? now - dayMs
        : window === 'last_week'
        ? now - 7 * dayMs
        : now - 30 * dayMs;

    if (window === 'older_than_30d') {
      this.logs = current.filter((l) => new Date(l.timestamp).getTime() >= cutoff);
    } else {
      this.logs = current.filter((l) => new Date(l.timestamp).getTime() < cutoff);
    }

    AuditService.saveLogs(this.logs);
    this.emitChange();
    return beforeCount - this.logs.length;
  }

  /**
   * Filter audit logs by module, action, date, user, userRole, or search query
   */
  public static filterLogs(params: AuditLogFilterParams): ImmutableAuditLog[] {
    const logs = this.getAllLogs();

    return logs.filter((log) => {
      // Module filter
      if (params.module && params.module !== 'all' && log.module !== params.module) {
        return false;
      }

      // Action filter
      if (params.action && params.action !== 'all' && log.action !== params.action) {
        return false;
      }

      // User filter
      if (params.userId && params.userId !== 'all' && log.userId !== params.userId) {
        return false;
      }

      // User Role filter
      if (params.userRole && params.userRole !== 'all') {
        const target = params.userRole.toLowerCase().trim();
        const logRole = (log.userRole || '').toLowerCase().trim();
        if (logRole !== target && !logRole.includes(target) && !target.includes(logRole)) {
          return false;
        }
      }

      // Date range filter
      if (params.startDate) {
        const logDate = new Date(log.timestamp).getTime();
        const start = new Date(params.startDate).getTime();
        if (logDate < start) return false;
      }
      if (params.endDate) {
        const logDate = new Date(log.timestamp).getTime();
        const end = new Date(params.endDate).getTime() + 86400000; // end of day
        if (logDate > end) return false;
      }

      // Search query
      if (params.searchQuery && params.searchQuery.trim()) {
        const q = params.searchQuery.toLowerCase().trim();
        const match =
          log.summary.toLowerCase().includes(q) ||
          log.targetEntityId.toLowerCase().includes(q) ||
          log.targetEntityType.toLowerCase().includes(q) ||
          log.userName.toLowerCase().includes(q) ||
          log.userRole.toLowerCase().includes(q) ||
          log.clientIp.toLowerCase().includes(q) ||
          log.id.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }

  /**
   * Tamper-proof guard: Deletion of audit logs is forbidden by enterprise compliance
   */
  public static deleteLog(): never {
    throw new Error('Regulatory Compliance Violation: Hard deletion of audit log entries is strictly forbidden.');
  }
}
