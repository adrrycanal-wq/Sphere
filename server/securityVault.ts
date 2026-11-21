import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import {
  ActiveSessionRecord,
  GovIdType,
  LoginActivityRecord,
  RecoveryAppealRecord,
  RecoveryRequestRecord,
  RecoveryReviewHistoryEntry,
  RecoveryStatus,
  ScreeningResult,
  SecurityAuditEventType,
  SecurityAuditLogEntry,
  SecurityRole,
  SuspiciousActivityAlert,
  UserProfile,
} from '../src/types/social';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const VAULT_DB_PATH = path.join(DATA_DIR, 'security-vault.json');
const VAULT_SECRET_PATH = path.join(DATA_DIR, '.id-vault-secret');
export const PRIVATE_ID_VAULT_DIR = path.resolve(process.cwd(), 'private-id-vault');

export const ALLOWED_GOV_ID_TYPES: GovIdType[] = [
  'PhilSys National ID',
  'Philippine Passport',
  "Driver's License",
  'UMID',
  'SSS ID',
  'PRC ID',
];

export const ACTIVE_RECOVERY_STATUSES: RecoveryStatus[] = [
  'pending_review',
  'under_verification',
  'additional_info_required',
  'appeal_under_review',
];

export const RA_10173_PRIVACY_NOTICE_VERSION = 'RA10173-2026-v1';

interface EncryptedDocMeta {
  id: string;
  requestId: string;
  mimeType: string;
  originalFileName: string;
  sizeBytes: number;
  sha256: string;
  uploadedAt: string;
  retainUntil: string;
  deletedAt?: string;
}

interface EmailResetTokenRecord {
  tokenHash: string;
  userId: string;
  email: string;
  expiresAt: number;
  usedAt?: number;
  createdAt: string;
}

interface PhoneRecoveryOtpRecord {
  id: string;
  phoneE164: string;
  userId: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  usedAt?: number;
  lockedUntil?: number;
}

interface RecoveryAuthTokenRecord {
  tokenHash: string;
  referenceNumber: string;
  userId: string;
  expiresAt: number;
  usedAt?: number;
  issuedBy: string;
}

interface StoredSessionRecord extends ActiveSessionRecord {
  tokenHash: string;
  adminMfaVerifiedAt?: number;
}

interface UserSecurityConfig {
  mfaEnabled: boolean;
  mfaMethod: 'authenticator_code' | 'email_otp';
  totpSecretBase32?: string;
  recoveryEmailBackup?: string;
  securityNotificationsEnabled: boolean;
}

export interface SecurityVaultDb {
  passwordHashes: Record<string, string>;
  personnelRoles: Record<string, SecurityRole[]>;
  userConfigs: Record<string, UserSecurityConfig>;
  sessions: StoredSessionRecord[];
  loginActivity: LoginActivityRecord[];
  emailResetTokens: EmailResetTokenRecord[];
  phoneRecoveryOtps: PhoneRecoveryOtpRecord[];
  recoveryAuthTokens: RecoveryAuthTokenRecord[];
  recoveryRequests: RecoveryRequestRecord[];
  encryptedDocuments: Record<string, EncryptedDocMeta>;
  auditLogs: SecurityAuditLogEntry[];
  alerts: SuspiciousActivityAlert[];
}

interface SecretKeys {
  idEncryptionKeyHex: string;
  hmacSecretHex: string;
}

let cachedVault: SecurityVaultDb | null = null;
let cachedKeys: SecretKeys | null = null;
const rateLimitBuckets = new Map<string, number[]>();

function ensureSecurityDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PRIVATE_ID_VAULT_DIR)) {
    fs.mkdirSync(PRIVATE_ID_VAULT_DIR, { recursive: true, mode: 0o700 });
  }
}

function getSecretKeys(): SecretKeys {
  if (cachedKeys) return cachedKeys;
  ensureSecurityDirs();

  const envIdKey = process.env.ID_ENCRYPTION_SECRET?.trim();
  const envHmac = process.env.AUDIT_HMAC_SECRET?.trim();

  if (envIdKey && envHmac) {
    cachedKeys = {
      idEncryptionKeyHex: crypto.createHash('sha256').update(envIdKey).digest('hex'),
      hmacSecretHex: crypto.createHash('sha256').update(envHmac).digest('hex'),
    };
    return cachedKeys;
  }

  if (fs.existsSync(VAULT_SECRET_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(VAULT_SECRET_PATH, 'utf-8')) as Partial<SecretKeys>;
      if (parsed.idEncryptionKeyHex && parsed.hmacSecretHex) {
        cachedKeys = {
          idEncryptionKeyHex: envIdKey
            ? crypto.createHash('sha256').update(envIdKey).digest('hex')
            : parsed.idEncryptionKeyHex,
          hmacSecretHex: envHmac
            ? crypto.createHash('sha256').update(envHmac).digest('hex')
            : parsed.hmacSecretHex,
        };
        return cachedKeys;
      }
    } catch {
      // Regenerate local vault secret file if unreadable
    }
  }

  const generated: SecretKeys = {
    idEncryptionKeyHex: envIdKey
      ? crypto.createHash('sha256').update(envIdKey).digest('hex')
      : crypto.randomBytes(32).toString('hex'),
    hmacSecretHex: envHmac
      ? crypto.createHash('sha256').update(envHmac).digest('hex')
      : crypto.randomBytes(32).toString('hex'),
  };
  fs.writeFileSync(VAULT_SECRET_PATH, JSON.stringify(generated), { encoding: 'utf-8', mode: 0o600 });
  cachedKeys = generated;
  return generated;
}

function getAesKey(): Buffer {
  const { idEncryptionKeyHex } = getSecretKeys();
  return Buffer.from(idEncryptionKeyHex, 'hex').subarray(0, 32);
}

function getHmacKey(): Buffer {
  const { hmacSecretHex } = getSecretKeys();
  return Buffer.from(hmacSecretHex, 'hex');
}

function createEmptyVault(): SecurityVaultDb {
  return {
    passwordHashes: {},
    personnelRoles: {
      adrian: ['platform_admin', 'security_admin'],
    },
    userConfigs: {},
    sessions: [],
    loginActivity: [],
    emailResetTokens: [],
    phoneRecoveryOtps: [],
    recoveryAuthTokens: [],
    recoveryRequests: [],
    encryptedDocuments: {},
    auditLogs: [],
    alerts: [],
  };
}

export function getSecurityVault(): SecurityVaultDb {
  if (cachedVault) return cachedVault;
  ensureSecurityDirs();
  if (fs.existsSync(VAULT_DB_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(VAULT_DB_PATH, 'utf-8')) as Partial<SecurityVaultDb>;
      const base = createEmptyVault();
      cachedVault = {
        ...base,
        ...parsed,
        passwordHashes: parsed.passwordHashes || {},
        personnelRoles: parsed.personnelRoles || base.personnelRoles,
        userConfigs: parsed.userConfigs || {},
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        loginActivity: Array.isArray(parsed.loginActivity) ? parsed.loginActivity : [],
        emailResetTokens: Array.isArray(parsed.emailResetTokens) ? parsed.emailResetTokens : [],
        phoneRecoveryOtps: Array.isArray(parsed.phoneRecoveryOtps) ? parsed.phoneRecoveryOtps : [],
        recoveryAuthTokens: Array.isArray(parsed.recoveryAuthTokens) ? parsed.recoveryAuthTokens : [],
        recoveryRequests: Array.isArray(parsed.recoveryRequests) ? parsed.recoveryRequests : [],
        encryptedDocuments: parsed.encryptedDocuments || {},
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      };
      return cachedVault;
    } catch {
      // Fall back to fresh vault
    }
  }
  cachedVault = createEmptyVault();
  saveSecurityVault(cachedVault);
  return cachedVault;
}

export function saveSecurityVault(vault: SecurityVaultDb): void {
  ensureSecurityDirs();
  cachedVault = vault;
  fs.writeFileSync(VAULT_DB_PATH, JSON.stringify(vault), { encoding: 'utf-8', mode: 0o600 });
}

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim().slice(0, 64);
  }
  return (req.socket?.remoteAddress || req.ip || '127.0.0.1').slice(0, 64);
}

export function parseDeviceLabel(req: Request): string {
  const ua = String(req.headers['user-agent'] || 'Unknown Browser');
  const browser = ua.includes('Edg/')
    ? 'Edge'
    : ua.includes('Chrome/')
      ? 'Chrome'
      : ua.includes('Firefox/')
        ? 'Firefox'
        : ua.includes('Safari/')
          ? 'Safari'
          : 'Web Client';
  const os = ua.includes('Android')
    ? 'Android'
    : ua.includes('iPhone') || ua.includes('iPad')
      ? 'iOS'
      : ua.includes('Mac OS')
        ? 'macOS'
        : ua.includes('Windows')
          ? 'Windows'
          : ua.includes('Linux')
            ? 'Linux'
            : 'Device';
  return `${browser} on ${os}`;
}

export function sha256Hex(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// =========================================================================
// PASSWORD HASHING (scrypt + timingSafeEqual)
// =========================================================================
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPasswordAgainstHash(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function setUserPasswordHash(userId: string, newPassword: string): void {
  const vault = getSecurityVault();
  vault.passwordHashes[userId] = hashPassword(newPassword);
  saveSecurityVault(vault);
}

export function verifyUserPassword(user: UserProfile, candidatePassword: string): boolean {
  const vault = getSecurityVault();
  const existingHash = vault.passwordHashes[user.id];
  if (existingHash) {
    return verifyPasswordAgainstHash(candidatePassword, existingHash);
  }
  if (user.password) {
    // Migrate legacy seed password to scrypt hash safely
    const matched = user.password === candidatePassword;
    if (matched) {
      vault.passwordHashes[user.id] = hashPassword(candidatePassword);
      saveSecurityVault(vault);
    }
    return matched;
  }
  return false;
}

export function userHasPassword(user: UserProfile): boolean {
  const vault = getSecurityVault();
  return Boolean(vault.passwordHashes[user.id] || user.password);
}

// =========================================================================
// RBAC & ROLE RESOLUTION
// =========================================================================
const BOOTSTRAPPED_PLATFORM_EMAILS = new Set([
  'adrrycanal@gmail.com',
  'adrian.villanueva@sphere.ph',
]);

export function resolveUserSecurityRoles(user: UserProfile | undefined): SecurityRole[] {
  if (!user) return [];
  const vault = getSecurityVault();
  const stored = vault.personnelRoles[user.id];
  const roleSet = new Set<SecurityRole>(['regular_user']);

  if (Array.isArray(stored)) {
    for (const r of stored) roleSet.add(r);
  } else if (
    user.role === 'admin' ||
    (user.email && BOOTSTRAPPED_PLATFORM_EMAILS.has(user.email.toLowerCase()))
  ) {
    // Platform Admin & Security Admin defaults: explicitly does NOT grant Gov ID officer access automatically
    roleSet.add('platform_admin');
    roleSet.add('security_admin');
  }

  return Array.from(roleSet);
}

export function hasAnySecurityRole(
  user: UserProfile | undefined,
  allowedRoles: SecurityRole[]
): boolean {
  const userRoles = resolveUserSecurityRoles(user);
  return allowedRoles.some((r) => userRoles.includes(r));
}

export function updatePersonnelRoles(
  actor: UserProfile,
  targetUser: UserProfile,
  nextRoles: SecurityRole[],
  ipAddress: string
): SecurityRole[] {
  const vault = getSecurityVault();
  const validSet = new Set<SecurityRole>([
    'regular_user',
    'verification_officer',
    'senior_reviewer',
    'security_admin',
    'platform_admin',
  ]);
  const sanitized = Array.from(
    new Set<SecurityRole>(['regular_user', ...nextRoles.filter((r) => validSet.has(r))])
  );
  vault.personnelRoles[targetUser.id] = sanitized;
  targetUser.securityRoles = sanitized;
  saveSecurityVault(vault);

  appendAuditLog({
    eventType: 'role_change',
    actorId: actor.id,
    actorRole: resolveUserSecurityRoles(actor).join(','),
    targetUserId: targetUser.id,
    ipAddress,
    outcome: 'success',
    details: `Updated personnel security roles for ${targetUser.handle} to [${sanitized.join(', ')}].`,
  });

  return sanitized;
}

// =========================================================================
// TAMPER-EVIDENT HASH-CHAINED SECURITY AUDIT LOGS & ALERTS
// =========================================================================
function computeAuditHash(
  prevHash: string,
  entry: Omit<SecurityAuditLogEntry, 'entryHash'>
): string {
  const payload = [
    prevHash,
    entry.seq,
    entry.timestamp,
    entry.eventType,
    entry.actorId,
    entry.actorRole,
    entry.targetUserId || '',
    entry.referenceNumber || '',
    entry.ipAddress,
    entry.outcome,
    entry.details,
  ].join('|');
  return crypto.createHmac('sha256', getHmacKey()).update(payload).digest('hex');
}

export function appendAuditLog(params: {
  eventType: SecurityAuditEventType;
  actorId: string;
  actorRole: string;
  targetUserId?: string;
  referenceNumber?: string;
  ipAddress: string;
  outcome: 'success' | 'failure' | 'blocked' | 'flagged';
  details: string;
}): SecurityAuditLogEntry {
  const vault = getSecurityVault();
  const prevEntry = vault.auditLogs[0];
  const seq = prevEntry ? prevEntry.seq + 1 : 1;
  const prevHash = prevEntry ? prevEntry.entryHash : 'GENESIS_0000000000000000';
  const baseEntry: Omit<SecurityAuditLogEntry, 'entryHash'> = {
    id: `aud-${seq}-${crypto.randomBytes(4).toString('hex')}`,
    seq,
    timestamp: new Date().toISOString(),
    eventType: params.eventType,
    actorId: params.actorId,
    actorRole: params.actorRole,
    targetUserId: params.targetUserId,
    referenceNumber: params.referenceNumber,
    ipAddress: params.ipAddress,
    outcome: params.outcome,
    details: params.details.slice(0, 500),
    prevHash,
  };
  const entryHash = computeAuditHash(prevHash, baseEntry);
  const fullEntry: SecurityAuditLogEntry = { ...baseEntry, entryHash };
  vault.auditLogs.unshift(fullEntry);
  if (vault.auditLogs.length > 2000) {
    vault.auditLogs = vault.auditLogs.slice(0, 2000);
  }
  saveSecurityVault(vault);
  return fullEntry;
}

export function verifyAuditLogChain(): {
  valid: boolean;
  totalEntries: number;
  brokenAtSeq?: number;
} {
  const vault = getSecurityVault();
  if (vault.auditLogs.length === 0) {
    return { valid: true, totalEntries: 0 };
  }
  const chronological = [...vault.auditLogs].reverse();
  let expectedPrev = 'GENESIS_0000000000000000';
  for (const entry of chronological) {
    if (entry.prevHash !== expectedPrev) {
      return { valid: false, totalEntries: chronological.length, brokenAtSeq: entry.seq };
    }
    const { entryHash, ...rest } = entry;
    const recomputed = computeAuditHash(expectedPrev, rest);
    if (entryHash !== recomputed) {
      return { valid: false, totalEntries: chronological.length, brokenAtSeq: entry.seq };
    }
    expectedPrev = entryHash;
  }
  return { valid: true, totalEntries: chronological.length };
}

export function recordSuspiciousAlert(params: {
  severity: SuspiciousActivityAlert['severity'];
  category: string;
  summary: string;
  targetUserId?: string;
  ipAddress: string;
}): SuspiciousActivityAlert {
  const vault = getSecurityVault();
  const alert: SuspiciousActivityAlert = {
    id: `alt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    severity: params.severity,
    category: params.category,
    summary: params.summary.slice(0, 400),
    targetUserId: params.targetUserId,
    ipAddress: params.ipAddress,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  vault.alerts.unshift(alert);
  if (vault.alerts.length > 500) vault.alerts = vault.alerts.slice(0, 500);
  saveSecurityVault(vault);

  appendAuditLog({
    eventType: 'suspicious_activity_alert',
    actorId: params.targetUserId || 'anonymous',
    actorRole: 'system',
    targetUserId: params.targetUserId,
    ipAddress: params.ipAddress,
    outcome: 'flagged',
    details: `[${params.severity.toUpperCase()}] ${params.category}: ${params.summary}`,
  });

  return alert;
}

// =========================================================================
// RATE LIMITING & CSRF PROTECTION
// =========================================================================
export function checkRateLimit(
  bucketKey: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number; count: number } {
  const now = Date.now();
  const hits = (rateLimitBuckets.get(bucketKey) || []).filter((ts) => now - ts < windowMs);
  if (hits.length >= maxRequests) {
    const oldest = hits[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    rateLimitBuckets.set(bucketKey, hits);
    return { allowed: false, retryAfterSeconds, count: hits.length };
  }
  hits.push(now);
  rateLimitBuckets.set(bucketKey, hits);
  return { allowed: true, retryAfterSeconds: 0, count: hits.length };
}

export function clearRateLimitsForTests(): void {
  rateLimitBuckets.clear();
}

export function issueCsrfToken(): string {
  const issuedAt = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${issuedAt}.${nonce}`;
  const sig = crypto.createHmac('sha256', getHmacKey()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyCsrfToken(token: string | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [issuedAtStr, nonce, sig] = parts;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || !nonce || !sig) return false;
  // 12-hour validity window
  if (Date.now() - issuedAt > 12 * 60 * 60 * 1000) return false;
  const expected = crypto
    .createHmac('sha256', getHmacKey())
    .update(`${issuedAtStr}.${nonce}`)
    .digest('hex');
  if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// =========================================================================
// SESSIONS, LOGIN ACTIVITY & TOTP MFA
// =========================================================================
export function createActiveSession(params: {
  userId: string;
  req: Request;
  method: string;
  mfaPassed?: boolean;
}): { rawToken: string; session: ActiveSessionRecord } {
  const vault = getSecurityVault();
  const rawToken = `sphs_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = sha256Hex(rawToken);
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const ipAddress = getClientIp(params.req);
  const deviceLabel = parseDeviceLabel(params.req);

  const stored: StoredSessionRecord = {
    id: `sess-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    userId: params.userId,
    tokenHash,
    deviceLabel,
    ipAddress,
    locationLabel: ipAddress === '127.0.0.1' || ipAddress === '::1' ? 'Localhost Session' : 'Verified Web Session',
    createdAt: nowIso,
    lastActiveAt: nowIso,
    expiresAt,
    adminMfaVerifiedAt: params.mfaPassed ? Date.now() : undefined,
    revoked: false,
  };

  vault.sessions.unshift(stored);
  // Keep latest 100 sessions across platform
  if (vault.sessions.length > 200) {
    vault.sessions = vault.sessions.slice(0, 200);
  }

  const loginEntry: LoginActivityRecord = {
    id: `log-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    userId: params.userId,
    method: params.method,
    deviceLabel,
    ipAddress,
    outcome: 'success',
    timestamp: nowIso,
  };
  vault.loginActivity.unshift(loginEntry);
  if (vault.loginActivity.length > 500) {
    vault.loginActivity = vault.loginActivity.slice(0, 500);
  }

  saveSecurityVault(vault);

  const { tokenHash: _th, adminMfaVerifiedAt: _mfa, ...publicSession } = stored;
  return { rawToken, session: publicSession };
}

export function recordFailedLoginActivity(
  userId: string,
  method: string,
  req: Request,
  outcome: 'failed' | 'mfa_challenged' = 'failed'
): void {
  const vault = getSecurityVault();
  vault.loginActivity.unshift({
    id: `log-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    userId,
    method,
    deviceLabel: parseDeviceLabel(req),
    ipAddress: getClientIp(req),
    outcome,
    timestamp: new Date().toISOString(),
  });
  if (vault.loginActivity.length > 500) {
    vault.loginActivity = vault.loginActivity.slice(0, 500);
  }
  saveSecurityVault(vault);
}

export function getSessionFromRequest(req: Request): StoredSessionRecord | null {
  const headerToken =
    (typeof req.headers['x-sphere-session'] === 'string' && req.headers['x-sphere-session'].trim()) ||
    (typeof req.headers.authorization === 'string' &&
    req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : '');

  if (!headerToken) return null;
  const tokenHash = sha256Hex(headerToken);
  const vault = getSecurityVault();
  const session = vault.sessions.find((s) => s.tokenHash === tokenHash);
  if (!session || session.revoked) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  session.lastActiveAt = new Date().toISOString();
  return session;
}

export function invalidateAllUserSessions(
  userId: string,
  exceptSessionId?: string
): number {
  const vault = getSecurityVault();
  let revokedCount = 0;
  for (const sess of vault.sessions) {
    if (sess.userId === userId && !sess.revoked && sess.id !== exceptSessionId) {
      sess.revoked = true;
      revokedCount += 1;
    }
  }
  if (revokedCount > 0) saveSecurityVault(vault);
  return revokedCount;
}

export function revokeSingleSession(userId: string, sessionId: string): boolean {
  const vault = getSecurityVault();
  const sess = vault.sessions.find((s) => s.id === sessionId && s.userId === userId);
  if (!sess) return false;
  sess.revoked = true;
  saveSecurityVault(vault);
  return true;
}

export function isSessionAdminMfaActive(session: StoredSessionRecord | null): boolean {
  if (!session || !session.adminMfaVerifiedAt) return false;
  // Admin MFA unlock valid for 30 minutes per session
  return Date.now() - session.adminMfaVerifiedAt < 30 * 60 * 1000;
}

export function markSessionAdminMfaVerified(session: StoredSessionRecord): void {
  const vault = getSecurityVault();
  const target = vault.sessions.find((s) => s.id === session.id);
  if (target) {
    target.adminMfaVerifiedAt = Date.now();
    saveSecurityVault(vault);
  }
}

// RFC 6238 TOTP Implementation (Base32 secret)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(length = 20): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += BASE32_ALPHABET[bytes[i] % 32];
  }
  return out;
}

function base32ToBuffer(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of clean) {
    const val = BASE32_ALPHABET.indexOf(ch);
    if (val >= 0) bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpCode(secretBase32: string, stepOffset = 0): string {
  const key = base32ToBuffer(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1_000_000;
  return String(code).padStart(6, '0');
}

export function verifyTotpCode(secretBase32: string, candidateCode: string): boolean {
  const clean = candidateCode.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  for (const offset of [-1, 0, 1]) {
    const expected = generateTotpCode(secretBase32, offset);
    if (crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

export function getOrInitUserSecurityConfig(userId: string): UserSecurityConfig {
  const vault = getSecurityVault();
  if (!vault.userConfigs[userId]) {
    vault.userConfigs[userId] = {
      mfaEnabled: false,
      mfaMethod: 'authenticator_code',
      totpSecretBase32: generateBase32Secret(),
      securityNotificationsEnabled: true,
    };
    saveSecurityVault(vault);
  } else if (!vault.userConfigs[userId].totpSecretBase32) {
    vault.userConfigs[userId].totpSecretBase32 = generateBase32Secret();
    saveSecurityVault(vault);
  }
  return vault.userConfigs[userId];
}

// =========================================================================
// AES-256-GCM ENCRYPTED GOV ID VAULT & SIGNED PREVIEW TOKENS
// =========================================================================
export function encryptGovIdToVault(params: {
  requestId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  retainUntil: string;
}): EncryptedDocMeta {
  ensureSecurityDirs();
  const docId = `doc-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getAesKey(), iv);
  const encrypted = Buffer.concat([cipher.update(params.buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]);

  const filePath = path.join(PRIVATE_ID_VAULT_DIR, `${docId}.enc`);
  fs.writeFileSync(filePath, payload, { mode: 0o600 });

  const meta: EncryptedDocMeta = {
    id: docId,
    requestId: params.requestId,
    mimeType: params.mimeType,
    originalFileName: path.basename(params.fileName).slice(0, 120),
    sizeBytes: params.buffer.length,
    sha256: sha256Hex(params.buffer),
    uploadedAt: new Date().toISOString(),
    retainUntil: params.retainUntil,
  };

  const vault = getSecurityVault();
  vault.encryptedDocuments[docId] = meta;
  saveSecurityVault(vault);
  return meta;
}

export function decryptGovIdFromVault(docId: string): {
  meta: EncryptedDocMeta;
  buffer: Buffer;
} | null {
  const vault = getSecurityVault();
  const meta = vault.encryptedDocuments[docId];
  if (!meta || meta.deletedAt) return null;
  const filePath = path.join(PRIVATE_ID_VAULT_DIR, `${docId}.enc`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath);
  if (raw.length < 29) return null;
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getAesKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return { meta, buffer: decrypted };
}

export function secureDeleteGovIdDocument(docId: string): boolean {
  const vault = getSecurityVault();
  const meta = vault.encryptedDocuments[docId];
  const filePath = path.join(PRIVATE_ID_VAULT_DIR, `${docId}.enc`);
  let deleted = false;
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    if (size > 0) {
      fs.writeFileSync(filePath, crypto.randomBytes(size));
      fs.writeFileSync(filePath, Buffer.alloc(size, 0));
    }
    fs.unlinkSync(filePath);
    deleted = true;
  }
  const nowIso = new Date().toISOString();
  if (meta) {
    meta.deletedAt = nowIso;
    deleted = true;
  }
  for (const reqRecord of vault.recoveryRequests) {
    if (reqRecord.documentRecordId === docId && !reqRecord.documentDeletedAt) {
      reqRecord.documentDeletedAt = nowIso;
    }
  }
  if (deleted) saveSecurityVault(vault);
  return deleted;
}

export function runRetentionPurge(actorId = 'retention-scheduler', ipAddress = '127.0.0.1'): {
  purgedCount: number;
  purgedDocumentIds: string[];
} {
  const vault = getSecurityVault();
  const now = Date.now();
  const purgedIds: string[] = [];

  for (const reqRecord of vault.recoveryRequests) {
    if (reqRecord.documentRecordId && !reqRecord.documentDeletedAt) {
      const retainTs = new Date(reqRecord.documentRetainUntil).getTime();
      if (!Number.isNaN(retainTs) && retainTs <= now) {
        const docId = reqRecord.documentRecordId;
        if (secureDeleteGovIdDocument(docId)) {
          purgedIds.push(docId);
          appendAuditLog({
            eventType: 'document_purged',
            actorId,
            actorRole: 'system',
            targetUserId: reqRecord.targetUserId,
            referenceNumber: reqRecord.referenceNumber,
            ipAddress,
            outcome: 'success',
            details: `Retention policy auto-purged encrypted ID document ${docId} after expiry (${reqRecord.documentRetainUntil}).`,
          });
        }
      }
    }
  }

  return { purgedCount: purgedIds.length, purgedDocumentIds: purgedIds };
}

export function mintSignedDocumentToken(params: {
  docId: string;
  viewerId: string;
  sessionId: string;
  ttlSeconds?: number;
}): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + (params.ttlSeconds ?? 120) * 1000;
  const payload = `${params.docId}.${params.viewerId}.${params.sessionId}.${expiresAt}`;
  const sig = crypto.createHmac('sha256', getHmacKey()).update(payload).digest('hex');
  return {
    token: Buffer.from(`${payload}.${sig}`, 'utf-8').toString('base64url'),
    expiresAt,
  };
}

export function verifySignedDocumentToken(
  token: string,
  expectedDocId: string
): { valid: boolean; viewerId?: string; sessionId?: string } {
  try {
    if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) return { valid: false };
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    if (Buffer.from(decoded, 'utf-8').toString('base64url') !== token) {
      return { valid: false };
    }
    const parts = decoded.split('.');
    if (parts.length !== 5) return { valid: false };
    const [docId, viewerId, sessionId, expiresStr, sig] = parts;
    if (docId !== expectedDocId) return { valid: false };
    if (!/^[0-9a-f]{64}$/i.test(sig)) return { valid: false };
    const expiresAt = Number(expiresStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return { valid: false };

    const expectedSig = crypto
      .createHmac('sha256', getHmacKey())
      .update(`${docId}.${viewerId}.${sessionId}.${expiresStr}`)
      .digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false };

    return { valid: true, viewerId, sessionId };
  } catch {
    return { valid: false };
  }
}

// =========================================================================
// IMAGE DIMENSION INSPECTION & STAGE A AUTOMATED SCREENING
// =========================================================================
function inspectImageDimensions(
  buffer: Buffer,
  mime: string
): { width: number; height: number } | null {
  try {
    if (mime === 'image/png' && buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
    if ((mime === 'image/jpeg' || mime === 'image/jpg') && buffer.length > 4) {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        if (marker === 0xd8 || marker === 0xd9) {
          offset += 2;
          continue;
        }
        const segLen = buffer.readUInt16BE(offset + 2);
        if (
          marker === 0xc0 ||
          marker === 0xc1 ||
          marker === 0xc2 ||
          marker === 0xc3
        ) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        if (segLen < 2) break;
        offset += 2 + segLen;
      }
    }
    if (mime === 'image/webp' && buffer.length >= 30) {
      const chunkHeader = buffer.subarray(12, 16).toString('ascii');
      if (chunkHeader === 'VP8 ' && buffer.length >= 30) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
      if (chunkHeader === 'VP8L' && buffer.length >= 25) {
        const b0 = buffer[21];
        const b1 = buffer[22];
        const b2 = buffer[23];
        const b3 = buffer[24];
        const width = 1 + (((b1 & 0x3f) << 8) | b0);
        const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        return { width, height };
      }
      if (chunkHeader === 'VP8X' && buffer.length >= 30) {
        const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
        const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
        return { width, height };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export async function runAutomatedIdScreening(params: {
  buffer: Buffer;
  mimeType: string;
  idType: GovIdType;
  legalFullName: string;
  dateOfBirth: string;
  matchedUser?: UserProfile;
  aiClient: GoogleGenAI | null;
}): Promise<ScreeningResult> {
  const dimensions = inspectImageDimensions(params.buffer, params.mimeType);
  const discrepancies: string[] = [];
  const flags: string[] = [];

  let readabilityScore = 82;
  if (params.buffer.length < 15 * 1024) {
    readabilityScore -= 30;
    flags.push('Small file size (<15 KB) — verify image is not overly compressed.');
  }
  if (dimensions) {
    if (dimensions.width < 400 || dimensions.height < 250) {
      readabilityScore -= 35;
      flags.push(`Low resolution (${dimensions.width}x${dimensions.height}px) — recommend higher-res capture.`);
    } else if (dimensions.width >= 800 && dimensions.height >= 500) {
      readabilityScore += 10;
    }
  } else {
    readabilityScore -= 12;
    flags.push('Could not parse standard raster frame header dimensions.');
  }

  readabilityScore = Math.max(15, Math.min(99, readabilityScore));
  const readabilityLabel: ScreeningResult['readabilityLabel'] =
    readabilityScore >= 75 ? 'Good' : readabilityScore >= 50 ? 'Fair' : 'Poor';

  if (!params.matchedUser) {
    discrepancies.push('Account identifier not automatically matched in directory; manual lookup required.');
    flags.push('Unmatched Sphere identifier');
  } else {
    const submittedTokens = normalizeNameTokens(params.legalFullName);
    const registeredTokens = normalizeNameTokens(params.matchedUser.name);
    const shared = submittedTokens.filter((t) => registeredTokens.includes(t));
    if (shared.length === 0) {
      discrepancies.push(
        `Submitted legal name ("${params.legalFullName}") shares no tokens with registered account name ("${params.matchedUser.name}").`
      );
      flags.push('Legal name mismatch');
    } else if (shared.length < Math.min(submittedTokens.length, registeredTokens.length)) {
      discrepancies.push(
        `Partial name match (${shared.length}/${registeredTokens.length} tokens matched); officer verification required.`
      );
      flags.push('Partial name match');
    }

    if (params.matchedUser.birthday && params.dateOfBirth !== params.matchedUser.birthday) {
      discrepancies.push('Submitted Date of Birth differs from account birthday record.');
      flags.push('DOB discrepancy');
    }
  }

  let aiScreeningStatus: ScreeningResult['aiScreeningStatus'] = 'skipped_no_api_key';
  let extractedSummary: ScreeningResult['extractedSummary'] = null;

  if (params.aiClient) {
    try {
      const resp = await params.aiClient.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          {
            inlineData: {
              mimeType: params.mimeType,
              data: params.buffer.toString('base64'),
            },
          },
          {
            text: `Perform an initial automated screening check on this uploaded ${params.idType} image for account recovery/verification. Compare legibility and apparent document type against declared type "${params.idType}". Do NOT make an approval decision; only report readability notes and field consistency hints for a human Verification Officer.`,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedDocType: { type: Type.STRING },
              legibilityNotes: { type: Type.STRING },
              nameMatchHint: { type: Type.STRING },
              dobMatchHint: { type: Type.STRING },
            },
            required: ['detectedDocType', 'legibilityNotes'],
          },
        },
      });
      const parsed = JSON.parse((resp.text || '{}').trim()) as ScreeningResult['extractedSummary'];
      extractedSummary = parsed || null;
      aiScreeningStatus = 'completed';
    } catch {
      aiScreeningStatus = 'failed';
      flags.push('Automated OCR pre-check unavailable; human Verification Officer review required.');
    }
  }

  return {
    passedInitialValidation: true,
    fileSizeBytes: params.buffer.length,
    mimeType: params.mimeType,
    dimensions,
    readabilityScore,
    readabilityLabel,
    sha256Prefix: sha256Hex(params.buffer).slice(0, 16),
    discrepancies,
    flags,
    extractedSummary,
    aiScreeningStatus,
    screenedAt: new Date().toISOString(),
  };
}

// =========================================================================
// RECOVERY TOKENS (EMAIL RESET, PHONE OTP, SEPARATE RECOVERY AUTH TOKEN)
// =========================================================================
export function issueEmailRecoveryToken(userId: string, email: string): {
  rawToken: string;
  expiresAt: number;
} {
  const vault = getSecurityVault();
  // Invalidate prior unused tokens for this user
  vault.emailResetTokens = vault.emailResetTokens.filter(
    (t) => t.userId !== userId || Boolean(t.usedAt)
  );
  const rawToken = `sphrst_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = Date.now() + 15 * 60 * 1000;
  vault.emailResetTokens.unshift({
    tokenHash: sha256Hex(rawToken),
    userId,
    email: email.toLowerCase(),
    expiresAt,
    createdAt: new Date().toISOString(),
  });
  saveSecurityVault(vault);
  return { rawToken, expiresAt };
}

export function consumeEmailRecoveryToken(rawToken: string): {
  ok: boolean;
  userId?: string;
  email?: string;
  error?: string;
} {
  const vault = getSecurityVault();
  const hash = sha256Hex(rawToken.trim());
  const rec = vault.emailResetTokens.find((t) => t.tokenHash === hash);
  if (!rec) {
    return { ok: false, error: 'Invalid or expired password recovery token.' };
  }
  if (rec.usedAt) {
    return { ok: false, error: 'This password recovery link has already been used.' };
  }
  if (Date.now() > rec.expiresAt) {
    return { ok: false, error: 'This password recovery token has expired. Request a new link.' };
  }
  rec.usedAt = Date.now();
  saveSecurityVault(vault);
  return { ok: true, userId: rec.userId, email: rec.email };
}

export function issuePhoneRecoveryOtp(userId: string, phoneE164: string): {
  rawOtp: string;
  expiresAt: number;
} {
  const vault = getSecurityVault();
  vault.phoneRecoveryOtps = vault.phoneRecoveryOtps.filter(
    (r) => r.phoneE164 !== phoneE164 || Boolean(r.usedAt)
  );
  const rawOtp = String(crypto.randomInt(100000, 999999));
  const expiresAt = Date.now() + 5 * 60 * 1000;
  vault.phoneRecoveryOtps.unshift({
    id: `potp-${Date.now()}`,
    phoneE164,
    userId,
    otpHash: sha256Hex(`${phoneE164}:${rawOtp}`),
    expiresAt,
    attempts: 0,
    maxAttempts: 5,
  });
  saveSecurityVault(vault);
  return { rawOtp, expiresAt };
}

export function verifyPhoneRecoveryOtp(
  phoneE164: string,
  candidateOtp: string,
  ipAddress: string
): { ok: boolean; userId?: string; locked?: boolean; error?: string } {
  const vault = getSecurityVault();
  const rec = vault.phoneRecoveryOtps.find(
    (r) => r.phoneE164 === phoneE164 && !r.usedAt
  );
  // Anti-enumeration: identical message whether phone doesn't exist, expired, or wrong OTP
  const genericError = 'Invalid or expired verification code.';
  if (!rec) {
    return { ok: false, error: genericError };
  }
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
    return { ok: false, locked: true, error: 'Too many verification attempts. Please wait before trying again.' };
  }
  if (Date.now() > rec.expiresAt) {
    return { ok: false, error: genericError };
  }
  rec.attempts += 1;
  if (rec.attempts > rec.maxAttempts) {
    rec.lockedUntil = Date.now() + 15 * 60 * 1000;
    saveSecurityVault(vault);
    recordSuspiciousAlert({
      severity: 'high',
      category: 'Phone OTP Brute-Force Attempt',
      summary: `Exceeded ${rec.maxAttempts} failed phone recovery OTP attempts.`,
      targetUserId: rec.userId,
      ipAddress,
    });
    return { ok: false, locked: true, error: 'Too many verification attempts. Please wait before trying again.' };
  }

  const candidateHash = sha256Hex(`${phoneE164}:${candidateOtp.trim()}`);
  const match = crypto.timingSafeEqual(
    Buffer.from(candidateHash, 'hex'),
    Buffer.from(rec.otpHash, 'hex')
  );
  if (!match) {
    saveSecurityVault(vault);
    return { ok: false, error: genericError };
  }

  rec.usedAt = Date.now();
  saveSecurityVault(vault);
  return { ok: true, userId: rec.userId };
}

export function issueRecoveryAuthToken(params: {
  referenceNumber: string;
  userId: string;
  issuedBy: string;
}): { rawToken: string; expiresAtIso: string } {
  const vault = getSecurityVault();
  const rawToken = `sphauth_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = Date.now() + 20 * 60 * 1000;
  vault.recoveryAuthTokens.unshift({
    tokenHash: sha256Hex(rawToken),
    referenceNumber: params.referenceNumber,
    userId: params.userId,
    expiresAt,
    issuedBy: params.issuedBy,
  });
  saveSecurityVault(vault);
  return { rawToken, expiresAtIso: new Date(expiresAt).toISOString() };
}

export function consumeRecoveryAuthToken(params: {
  rawToken: string;
  referenceNumber?: string;
}): { ok: boolean; userId?: string; referenceNumber?: string; error?: string } {
  const vault = getSecurityVault();
  const hash = sha256Hex(params.rawToken.trim());
  const rec = vault.recoveryAuthTokens.find((t) => t.tokenHash === hash);
  if (!rec) {
    return { ok: false, error: 'Invalid or expired recovery authorization token.' };
  }
  if (params.referenceNumber && rec.referenceNumber !== params.referenceNumber) {
    return { ok: false, error: 'Recovery authorization token does not match the specified reference number.' };
  }
  if (rec.usedAt) {
    return { ok: false, error: 'This recovery authorization token has already been used.' };
  }
  if (Date.now() > rec.expiresAt) {
    return { ok: false, error: 'This recovery authorization token has expired.' };
  }
  rec.usedAt = Date.now();
  saveSecurityVault(vault);
  return { ok: true, userId: rec.userId, referenceNumber: rec.referenceNumber };
}

export function generateReferenceNumber(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `REC-${year}-${suffix}`;
}

export function addReviewHistoryEntry(
  reqRecord: RecoveryRequestRecord,
  entry: Omit<RecoveryReviewHistoryEntry, 'id' | 'timestamp'>
): void {
  reqRecord.reviewHistory.unshift({
    id: `rh-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
}

export function createAppealRecord(params: {
  explanation: string;
  additionalDocumentId?: string;
}): RecoveryAppealRecord {
  return {
    id: `apl-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    submittedAt: new Date().toISOString(),
    explanation: params.explanation.trim().slice(0, 2000),
    additionalDocumentId: params.additionalDocumentId,
    status: 'pending',
  };
}
