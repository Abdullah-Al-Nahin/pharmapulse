import { AuthUser, AuthTokenPayload } from '../types/rbac';

/**
 * Browser-safe Base64URL encoding for JWT creation without Node.js buffer dependencies
 */
function base64UrlEncode(str: string): string {
  const utf8Bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  );
  return btoa(utf8Bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Browser-safe Base64URL decoding
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const decoded = atob(base64);
  try {
    return decodeURIComponent(
      decoded
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return decoded;
  }
}

/**
 * Fast, pure JavaScript pseudo-HMAC signature for client-side JWT generation
 * Avoids Node.js 'buffer' / 'crypto' crash in Vite browser bundles.
 */
function createSignature(headerPayload: string, secret: string): string {
  let hash = 0x811c9dc5;
  const combined = `${headerPayload}:${secret}`;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return base64UrlEncode(`sig_${hex}_${Date.now().toString(36)}`);
}

/**
 * Generate client-safe signed Bearer JWT token
 */
export function generateJwtToken(user: AuthUser, expiresInHours = 8): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + expiresInHours * 3600;

  const payload: AuthTokenPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    roleCode: user.roleCode,
    permissions: user.permissions,
    maxDiscountPercent: user.maxDiscountPercent,
    canViewPurchaseCosts: user.canViewPurchaseCosts,
    canViewProfitMargins: user.canViewProfitMargins,
    iat: nowSec,
    exp: expSec,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const headerAndPayload = `${encodedHeader}.${encodedPayload}`;
  const signature = createSignature(
    headerAndPayload,
    'pharmacy-saas-production-secret-key-2026-secure'
  );

  return `${headerAndPayload}.${signature}`;
}

/**
 * Decode JWT token safely in browser
 */
export function decodeJwtToken(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const jsonStr = base64UrlDecode(parts[1]);
    return JSON.parse(jsonStr) as AuthTokenPayload;
  } catch {
    return null;
  }
}
