import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import type { GoogleGenAI } from '@google/genai';
import {
  GovIdType,
  NotificationItem,
  RecoveryRequestRecord,
  RecoveryStatus,
  SecurityRole,
  UserProfile,
} from '../src/types/social';
import { checkSafeContent } from '../src/utils/discovery';
import { getDb, saveDb } from './store';
import {
  ACTIVE_RECOVERY_STATUSES,
  ALLOWED_GOV_ID_TYPES,
  RA_10173_PRIVACY_NOTICE_VERSION,
  addReviewHistoryEntry,
  appendAuditLog,
  checkRateLimit,
  consumeEmailRecoveryToken,
  consumeRecoveryAuthToken,
  createActiveSession,
  createAppealRecord,
  decryptGovIdFromVault,
  encryptGovIdToVault,
  generateReferenceNumber,
  getClientIp,
  getOrInitUserSecurityConfig,
  getSecurityVault,
  getSessionFromRequest,
  hasAnySecurityRole,
  invalidateAllUserSessions,
  isSessionAdminMfaActive,
  issueCsrfToken,
  issueEmailRecoveryToken,
  issuePhoneRecoveryOtp,
  issueRecoveryAuthToken,
  markSessionAdminMfaVerified,
  mintSignedDocumentToken,
  recordSuspiciousAlert,
  resolveUserSecurityRoles,
  revokeSingleSession,
  runAutomatedIdScreening,
  runRetentionPurge,
  saveSecurityVault,
  secureDeleteGovIdDocument,
  setUserPasswordHash,
  updatePersonnelRoles,
  userHasPassword,
  verifyAuditLogChain,
  verifyCsrfToken,
  verifyPhoneRecoveryOtp,
  verifySignedDocumentToken,
  verifyTotpCode,
  verifyUserPassword,
} from './securityVault';

interface SecurityRouterDeps {
  ai: GoogleGenAI | null;
  validatePasswordComplexity: (password: string, personalTokens: string[]) => string | null;
  addNotification: (
    db: ReturnType<typeof getDb>,
    notif: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>
  ) => void;
}

interface AuthedRequest extends Request {
  authUser?: UserProfile;
  authSessionId?: string;
}

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function normalizeMime(raw: string): string {
  return String(raw || '').split(';')[0].trim().toLowerCase();
}

function verifyImageMagicBytes(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mime === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

function normalizePhoneDigits(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function findUserByIdentifier(db: ReturnType<typeof getDb>, identifier: string): UserProfile | undefined {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return undefined;
  return db.users.find(
    (u) =>
      u.id.toLowerCase() === clean ||
      u.handle.toLowerCase() === clean ||
      u.handle.replace(/^@/, '').toLowerCase() === clean ||
      (u.email || '').toLowerCase() === clean
  );
}

function findUserByPhone(db: ReturnType<typeof getDb>, phone: string): UserProfile | undefined {
  const targetDigits = normalizePhoneDigits(phone).slice(-10);
  if (targetDigits.length < 9) return undefined;
  return db.users.find((u) => {
    if (!u.mobile) return false;
    return normalizePhoneDigits(u.mobile).slice(-10) === targetDigits;
  });
}

function getIdentityStatusForUser(userId: string): {
  status:
    | 'not_submitted'
    | 'pending_review'
    | 'under_verification'
    | 'additional_info_required'
    | 'verified'
    | 'rejected';
  latestRef?: string;
} {
  const vault = getSecurityVault();
  const mine = vault.recoveryRequests.filter((r) => r.targetUserId === userId);
  if (mine.length === 0) return { status: 'not_submitted' };
  const latest = mine[0];
  if (latest.status === 'approved' || latest.status === 'recovery_completed') {
    return { status: 'verified', latestRef: latest.referenceNumber };
  }
  if (latest.status === 'rejected') {
    return { status: 'rejected', latestRef: latest.referenceNumber };
  }
  if (latest.status === 'additional_info_required') {
    return { status: 'additional_info_required', latestRef: latest.referenceNumber };
  }
  if (latest.status === 'under_verification' || latest.status === 'appeal_under_review') {
    return { status: 'under_verification', latestRef: latest.referenceNumber };
  }
  return { status: 'pending_review', latestRef: latest.referenceNumber };
}

function sanitizeRecoveryForOfficer(reqRecord: RecoveryRequestRecord) {
  return {
    ...reqRecord,
    documentDeleted: Boolean(reqRecord.documentDeletedAt),
    hasDocument: Boolean(reqRecord.documentRecordId && !reqRecord.documentDeletedAt),
  };
}

export function createSecurityRouter(deps: SecurityRouterDeps) {
  const router = express.Router();

  const requireCsrf = (req: Request, res: Response, next: NextFunction) => {
    const token =
      typeof req.headers['x-csrf-token'] === 'string'
        ? req.headers['x-csrf-token']
        : typeof req.body?.csrfToken === 'string'
          ? req.body.csrfToken
          : undefined;
    if (!verifyCsrfToken(token)) {
      return res.status(403).json({
        error: 'Invalid or missing CSRF security token. Please refresh and try again.',
      });
    }
    return next();
  };

  const requireSession = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const sess = getSessionFromRequest(req);
    if (!sess) {
      return res.status(401).json({
        error: 'Authentication session required or expired. Please sign in again.',
      });
    }
    const db = getDb();
    const user = db.users.find((u) => u.id === sess.userId);
    if (!user) {
      return res.status(401).json({ error: 'Authenticated account not found.' });
    }
    req.authUser = user;
    req.authSessionId = sess.id;
    return next();
  };

  const requireRoles =
    (allowedRoles: SecurityRole[], resourceLabel: string) =>
    (req: AuthedRequest, res: Response, next: NextFunction) => {
      if (!req.authUser) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      if (!hasAnySecurityRole(req.authUser, allowedRoles)) {
        const ipAddress = getClientIp(req);
        const actorRoles = resolveUserSecurityRoles(req.authUser);
        appendAuditLog({
          eventType: 'suspicious_activity_alert',
          actorId: req.authUser.id,
          actorRole: actorRoles.join(','),
          ipAddress,
          outcome: 'blocked',
          details: `Unauthorized access blocked on ${resourceLabel}. Required roles: [${allowedRoles.join(', ')}].`,
        });
        recordSuspiciousAlert({
          severity: 'high',
          category: 'Unauthorized Privileged Access Attempt',
          summary: `${req.authUser.handle} (${actorRoles.join(', ')}) attempted unauthorized access to ${resourceLabel}.`,
          targetUserId: req.authUser.id,
          ipAddress,
        });
        return res.status(403).json({
          error: `Access denied. Insufficient role permissions for ${resourceLabel}.`,
        });
      }
      return next();
    };

  // =========================================================================
  // CSRF TOKEN ENDPOINT
  // =========================================================================
  router.get('/security/csrf', (_req, res) => {
    return res.json({ csrfToken: issueCsrfToken() });
  });

  // =========================================================================
  // ACCOUNT RECOVERY CENTER — OPTION A: REGISTERED EMAIL
  // =========================================================================
  router.post('/recovery/email/request', requireCsrf, async (req, res) => {
    const ip = getClientIp(req);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const rlIp = checkRateLimit(`rec-email-ip:${ip}`, 8, 15 * 60 * 1000);
    const rlTarget = checkRateLimit(`rec-email-id:${email}`, 5, 15 * 60 * 1000);

    if (!rlIp.allowed || !rlTarget.allowed) {
      recordSuspiciousAlert({
        severity: 'medium',
        category: 'Email Recovery Rate Limit Exceeded',
        summary: `Rate limit triggered for email password recovery from ${ip}.`,
        ipAddress: ip,
      });
      return res.status(429).json({
        error: 'Too many recovery requests. Please wait a few minutes before retrying.',
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address format.' });
    }

    const db = getDb();
    const user = db.users.find((u) => (u.email || '').toLowerCase() === email);
    let deliveryChannel: 'smtp' | 'standard' = 'standard';

    if (user) {
      const { rawToken } = issueEmailRecoveryToken(user.id, email);
      appendAuditLog({
        eventType: 'password_reset_request',
        actorId: user.id,
        actorRole: resolveUserSecurityRoles(user).join(','),
        targetUserId: user.id,
        ipAddress: ip,
        outcome: 'success',
        details: `Issued single-use expiring email password reset token for ${user.handle}.`,
      });

      const transporter = getSmtpTransporter();
      if (transporter) {
        try {
          const baseUrl = process.env.APP_URL || 'http://localhost:3000';
          const resetUrl = `${baseUrl}/?recoveryToken=${encodeURIComponent(rawToken)}`;
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: 'Sphere. Account Recovery — Single-Use Password Reset Link',
            text: `Use this single-use Sphere. password reset token within 15 minutes:\nToken: ${rawToken}\nLink: ${resetUrl}\n\nIf you did not request this, secure your account immediately.`,
            html: `<div style="font-family:sans-serif;max-width:520px;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
              <h2 style="color:#4F46E5;margin:0 0 12px;">Sphere. Account Recovery</h2>
              <p style="font-size:14px;color:#334155;">A password reset was requested for your Sphere. account. This link and token expire in <strong>15 minutes</strong> and can only be used once.</p>
              <p style="margin:16px 0;"><a href="${resetUrl}" style="background:#4F46E5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a></p>
              <p style="font-size:12px;color:#475569;">Single-use token: <code>${rawToken}</code></p>
            </div>`,
          });
          deliveryChannel = 'smtp';
        } catch (err) {
          console.error('Recovery email delivery error:', err);
        }
      }
    } else {
      appendAuditLog({
        eventType: 'password_reset_request',
        actorId: 'anonymous',
        actorRole: 'anonymous',
        ipAddress: ip,
        outcome: 'success',
        details: 'Email password reset requested; anti-enumeration neutral response issued.',
      });
    }

    // Strict anti-enumeration: identical response whether account exists or not
    return res.json({
      ok: true,
      deliveryChannel,
      message:
        'If an account is registered with that email address, single-use password reset instructions valid for 15 minutes have been issued.',
    });
  });

  router.post('/recovery/email/confirm', requireCsrf, (req, res) => {
    const ip = getClientIp(req);
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Recovery token and new password are required.' });
    }

    const db = getDb();
    const consumed = consumeEmailRecoveryToken(String(token));
    if (!consumed.ok || !consumed.userId) {
      appendAuditLog({
        eventType: 'password_change',
        actorId: 'anonymous',
        actorRole: 'anonymous',
        ipAddress: ip,
        outcome: 'failure',
        details: `Failed email recovery confirm: ${consumed.error}`,
      });
      return res.status(400).json({ error: consumed.error || 'Invalid or expired reset token.' });
    }

    const user = db.users.find((u) => u.id === consumed.userId);
    if (!user) {
      return res.status(404).json({ error: 'Account no longer exists.' });
    }

    const pwErr = deps.validatePasswordComplexity(String(newPassword), [
      user.name,
      user.handle.replace(/^@/, ''),
      (user.email || '').split('@')[0] || '',
    ]);
    if (pwErr) return res.status(400).json({ error: pwErr });

    setUserPasswordHash(user.id, String(newPassword));
    delete user.password;
    const revokedSessions = invalidateAllUserSessions(user.id);
    deps.addNotification(db, {
      recipientId: user.id,
      actorId: user.id,
      type: 'password_changed',
      text: `Your Sphere. password was changed via registered email recovery. ${revokedSessions} active session(s) were signed out.`,
    });
    saveDb(db);

    appendAuditLog({
      eventType: 'password_change',
      actorId: user.id,
      actorRole: resolveUserSecurityRoles(user).join(','),
      targetUserId: user.id,
      ipAddress: ip,
      outcome: 'success',
      details: `Password updated via single-use email recovery token; revoked ${revokedSessions} active sessions.`,
    });

    return res.json({
      ok: true,
      revokedSessions,
      message: 'Your password has been updated and prior active sessions have been invalidated.',
    });
  });

  // =========================================================================
  // ACCOUNT RECOVERY CENTER — OPTION B: REGISTERED PHONE OTP
  // =========================================================================
  router.post('/recovery/phone/request', requireCsrf, async (req, res) => {
    const ip = getClientIp(req);
    const phone = String(req.body?.phone || '').trim();
    const cleanDigits = normalizePhoneDigits(phone);

    const rlIp = checkRateLimit(`rec-phone-ip:${ip}`, 6, 15 * 60 * 1000);
    const rlPhone = checkRateLimit(`rec-phone-num:${cleanDigits.slice(-10)}`, 4, 15 * 60 * 1000);
    if (!rlIp.allowed || !rlPhone.allowed) {
      recordSuspiciousAlert({
        severity: 'medium',
        category: 'Phone OTP Recovery Rate Limit',
        summary: `Rate limit triggered for phone OTP recovery from ${ip}.`,
        ipAddress: ip,
      });
      return res.status(429).json({
        error: 'Too many verification code requests. Please wait before trying again.',
      });
    }

    if (cleanDigits.length < 9 || cleanDigits.length > 15) {
      return res.status(400).json({ error: 'Please enter a valid phone number.' });
    }

    const db = getDb();
    const user = findUserByPhone(db, phone);

    if (user) {
      const { rawOtp } = issuePhoneRecoveryOtp(user.id, cleanDigits.slice(-10));
      appendAuditLog({
        eventType: 'otp_attempt',
        actorId: user.id,
        actorRole: resolveUserSecurityRoles(user).join(','),
        targetUserId: user.id,
        ipAddress: ip,
        outcome: 'success',
        details: `Issued 5-minute phone recovery OTP for ${user.handle}.`,
      });

      // Optional SMS webhook delivery if configured
      const smsWebhook = process.env.SMS_WEBHOOK_URL?.trim();
      if (smsWebhook) {
        void fetch(smsWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: phone,
            message: `Your Sphere. recovery verification code is ${rawOtp}. Expires in 5 minutes.`,
          }),
        }).catch(() => {});
      }
    } else {
      appendAuditLog({
        eventType: 'otp_attempt',
        actorId: 'anonymous',
        actorRole: 'anonymous',
        ipAddress: ip,
        outcome: 'success',
        details: 'Phone recovery OTP requested; anti-enumeration neutral response sent.',
      });
    }

    // Strict anti-enumeration: never confirm or deny account existence
    return res.json({
      ok: true,
      expiresInSeconds: 300,
      message:
        'If an account matches that registered phone number, a 6-digit verification code valid for 5 minutes has been issued.',
    });
  });

  router.post('/recovery/phone/verify', requireCsrf, (req, res) => {
    const ip = getClientIp(req);
    const phone = String(req.body?.phone || '').trim();
    const code = String(req.body?.code || '').trim();
    const cleanDigits = normalizePhoneDigits(phone).slice(-10);

    const rl = checkRateLimit(`rec-phone-verify:${ip}`, 10, 10 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'Too many verification attempts from this network. Please wait.',
      });
    }

    const result = verifyPhoneRecoveryOtp(cleanDigits, code, ip);
    if (!result.ok || !result.userId) {
      appendAuditLog({
        eventType: 'otp_attempt',
        actorId: result.userId || 'anonymous',
        actorRole: 'anonymous',
        ipAddress: ip,
        outcome: result.locked ? 'blocked' : 'failure',
        details: result.locked ? 'Phone OTP attempt limit exceeded.' : 'Invalid or expired phone OTP check.',
      });
      return res.status(result.locked ? 429 : 400).json({
        error: result.error || 'Invalid or expired verification code.',
      });
    }

    const ref = generateReferenceNumber();
    const { rawToken, expiresAtIso } = issueRecoveryAuthToken({
      referenceNumber: ref,
      userId: result.userId,
      issuedBy: 'phone_otp_recovery',
    });

    appendAuditLog({
      eventType: 'otp_attempt',
      actorId: result.userId,
      actorRole: 'regular_user',
      targetUserId: result.userId,
      referenceNumber: ref,
      ipAddress: ip,
      outcome: 'success',
      details: 'Phone recovery OTP verified; issued separate single-use recovery authorization token.',
    });

    return res.json({
      ok: true,
      referenceNumber: ref,
      recoveryAuthToken: rawToken,
      expiresAt: expiresAtIso,
    });
  });

  // =========================================================================
  // ACCOUNT RECOVERY CENTER — OPTION C: GOVERNMENT ID & HYBRID VERIFICATION
  // =========================================================================
  router.post('/recovery/gov-id/submit', requireCsrf, async (req: AuthedRequest, res) => {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`rec-gov-id:${ip}`, 5, 30 * 60 * 1000);
    if (!rl.allowed) {
      recordSuspiciousAlert({
        severity: 'medium',
        category: 'Excessive Gov ID Recovery Submissions',
        summary: `Rate limit triggered for government ID uploads from ${ip}.`,
        ipAddress: ip,
      });
      return res.status(429).json({
        error: 'Too many ID verification submissions. Please wait before trying again.',
      });
    }

    const {
      targetHandleOrId,
      purpose,
      legalFullName,
      dateOfBirth,
      idType,
      ownershipContext,
      privacyConsentAccepted,
      fileName,
      mimeType,
      dataBase64,
    } = req.body || {};

    if (!privacyConsentAccepted) {
      return res.status(400).json({
        error:
          'You must read and acknowledge the RA 10173 Data Privacy Notice before submitting a government ID.',
      });
    }

    const cleanIdType = String(idType || '') as GovIdType;
    if (!ALLOWED_GOV_ID_TYPES.includes(cleanIdType)) {
      return res.status(400).json({
        error: `Unsupported government ID type. Accepted: ${ALLOWED_GOV_ID_TYPES.join(', ')}.`,
      });
    }

    const cleanLegalName = String(legalFullName || '').trim();
    const cleanDob = String(dateOfBirth || '').trim();
    const cleanTarget = String(targetHandleOrId || '').trim();
    const cleanContext = String(ownershipContext || '').trim();

    if (!cleanLegalName || cleanLegalName.length < 3 || !cleanDob || !cleanTarget) {
      return res.status(400).json({
        error: 'Sphere username/ID, full legal name, and date of birth are required.',
      });
    }

    const safeText = checkSafeContent(`${cleanLegalName} ${cleanTarget} ${cleanContext}`);
    if (!safeText.ok) return res.status(400).json({ error: safeText.reason });

    const normalizedMime = normalizeMime(String(mimeType || ''));
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(normalizedMime)) {
      return res.status(400).json({
        error: 'Government ID upload must be a JPEG, PNG, or WebP image.',
      });
    }

    const cleanedB64 = String(dataBase64 || '').replace(/^data:[^,]+;base64,/, '');
    if (!cleanedB64) {
      return res.status(400).json({ error: 'Government ID image file is required.' });
    }
    const buffer = Buffer.from(cleanedB64, 'base64');

    if (buffer.length < 1024) {
      return res.status(400).json({
        error: 'Uploaded image is too small (< 1 KB). Please upload a clear, full-resolution ID image.',
      });
    }
    if (buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ error: 'Government ID image exceeds the 8 MB limit.' });
    }
    if (!verifyImageMagicBytes(buffer, normalizedMime)) {
      return res.status(400).json({
        error: 'File content failed magic-byte validation and does not match its declared image type.',
      });
    }

    const db = getDb();
    const session = getSessionFromRequest(req);
    const matchedUser =
      findUserByIdentifier(db, cleanTarget) ||
      (session ? db.users.find((u) => u.id === session.userId) : undefined);

    // Prevent duplicate active requests for the same account/identifier
    const vault = getSecurityVault();
    const duplicate = vault.recoveryRequests.find((r) => {
      if (!ACTIVE_RECOVERY_STATUSES.includes(r.status)) return false;
      if (matchedUser && r.targetUserId === matchedUser.id) return true;
      return r.targetHandleOrId.toLowerCase() === cleanTarget.toLowerCase();
    });
    if (duplicate) {
      return res.status(409).json({
        error: `An active verification/recovery request (${duplicate.referenceNumber}) already exists for this account. Check its status or submit updates there.`,
        existingReferenceNumber: duplicate.referenceNumber,
      });
    }

    const screening = await runAutomatedIdScreening({
      buffer,
      mimeType: normalizedMime,
      idType: cleanIdType,
      legalFullName: cleanLegalName,
      dateOfBirth: cleanDob,
      matchedUser,
      aiClient: deps.ai,
    });

    const reqId = `rec-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const referenceNumber = generateReferenceNumber();
    const retainUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const docMeta = encryptGovIdToVault({
      requestId: reqId,
      fileName: String(fileName || 'gov-id.jpg'),
      mimeType: normalizedMime,
      buffer,
      retainUntil,
    });

    const reqPurpose: RecoveryRequestRecord['purpose'] =
      purpose === 'hybrid_identity_verification' ? 'hybrid_identity_verification' : 'account_recovery';

    // Route flagged requests directly to Under Verification queue; never auto-approve!
    const initialStatus: RecoveryStatus =
      screening.discrepancies.length > 0 || screening.readabilityLabel === 'Poor'
        ? 'under_verification'
        : 'pending_review';

    const nowIso = new Date().toISOString();
    const record: RecoveryRequestRecord = {
      id: reqId,
      referenceNumber,
      targetUserId: matchedUser?.id,
      targetHandleOrId: cleanTarget,
      method: 'government_id',
      purpose: reqPurpose,
      legalFullName: cleanLegalName,
      dateOfBirth: cleanDob,
      idType: cleanIdType,
      ownershipContext: cleanContext || 'Requested through Sphere Account Recovery Center.',
      privacyConsentAccepted: true,
      privacyNoticeVersion: RA_10173_PRIVACY_NOTICE_VERSION,
      status: initialStatus,
      escalatedToSeniorReviewer: screening.discrepancies.length >= 2,
      documentRecordId: docMeta.id,
      documentRetainUntil: retainUntil,
      screening,
      reviewHistory: [
        {
          id: `rh-init-${Date.now()}`,
          actorId: matchedUser?.id || 'applicant',
          actorName: matchedUser?.name || cleanLegalName,
          actorRole: 'regular_user',
          action: 'Submitted encrypted Government ID & passed Stage A automated screening',
          note:
            screening.discrepancies.length > 0
              ? `Flagged for manual officer review: ${screening.discrepancies.join('; ')}`
              : 'No automated discrepancies flagged; awaiting human Verification Officer review.',
          timestamp: nowIso,
        },
      ],
      appeals: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const currentVault = getSecurityVault();
    currentVault.recoveryRequests.unshift(record);
    saveSecurityVault(currentVault);

    appendAuditLog({
      eventType: 'recovery_request_submission',
      actorId: matchedUser?.id || 'applicant',
      actorRole: 'regular_user',
      targetUserId: matchedUser?.id,
      referenceNumber,
      ipAddress: ip,
      outcome: screening.discrepancies.length > 0 ? 'flagged' : 'success',
      details: `Submitted ${cleanIdType} (${reqPurpose}); AES-256-GCM encrypted in vault; routed to ${initialStatus}.`,
    });

    if (matchedUser) {
      deps.addNotification(db, {
        recipientId: matchedUser.id,
        actorId: matchedUser.id,
        type: 'recovery_update',
        text: `Identity verification / recovery request ${referenceNumber} was submitted (${initialStatus.replace(/_/g, ' ')}).`,
      });
      saveDb(db);
    }

    return res.status(201).json({
      ok: true,
      referenceNumber,
      status: record.status,
      screening: {
        readabilityLabel: screening.readabilityLabel,
        readabilityScore: screening.readabilityScore,
        discrepancies: screening.discrepancies,
        flags: screening.flags,
        aiScreeningStatus: screening.aiScreeningStatus,
      },
      retainUntil,
      privacyNoticeVersion: RA_10173_PRIVACY_NOTICE_VERSION,
    });
  });

  // Safe Status Lookup by Reference Number (masks PII)
  router.get('/recovery/status', (req, res) => {
    const referenceNumber = String(req.query.referenceNumber || '').trim().toUpperCase();
    if (!referenceNumber) {
      return res.status(400).json({ error: 'Recovery reference number is required.' });
    }
    const vault = getSecurityVault();
    const record = vault.recoveryRequests.find(
      (r) => r.referenceNumber.toUpperCase() === referenceNumber
    );
    if (!record) {
      return res.status(404).json({
        error: 'No recovery request found with that reference number.',
      });
    }

    return res.json({
      referenceNumber: record.referenceNumber,
      purpose: record.purpose,
      idType: record.idType,
      status: record.status,
      requestedAdditionalInfo: record.requestedAdditionalInfo,
      rejectionReason: record.rejectionReason,
      escalatedToSeniorReviewer: Boolean(record.escalatedToSeniorReviewer),
      screeningSummary: {
        readabilityLabel: record.screening.readabilityLabel,
        readabilityScore: record.screening.readabilityScore,
        flagsCount: record.screening.flags.length,
        aiScreeningStatus: record.screening.aiScreeningStatus,
      },
      documentDeletedAt: record.documentDeletedAt,
      documentRetainUntil: record.documentRetainUntil,
      appeals: record.appeals.map((a) => ({
        id: a.id,
        submittedAt: a.submittedAt,
        status: a.status,
        decisionNote: a.decisionNote,
        handledAt: a.handledAt,
      })),
      timeline: record.reviewHistory.map((h) => ({
        action: h.action,
        actorRole: h.actorRole,
        timestamp: h.timestamp,
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  });

  // Submit Additional Info when requested by Verification Officer
  router.post('/recovery/:referenceNumber/additional-info', requireCsrf, async (req, res) => {
    const ref = String(req.params.referenceNumber || '').trim().toUpperCase();
    const { responseText, fileName, mimeType, dataBase64 } = req.body || {};
    const vault = getSecurityVault();
    const record = vault.recoveryRequests.find((r) => r.referenceNumber.toUpperCase() === ref);
    if (!record) return res.status(404).json({ error: 'Recovery request not found.' });
    if (record.status !== 'additional_info_required') {
      return res.status(400).json({
        error: 'This request is not currently awaiting additional information.',
      });
    }
    if (!String(responseText || '').trim()) {
      return res.status(400).json({ error: 'Please provide the requested details.' });
    }

    if (dataBase64 && mimeType) {
      const normalizedMime = normalizeMime(String(mimeType));
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(normalizedMime)) {
        return res.status(400).json({ error: 'Replacement ID image must be JPEG, PNG, or WebP.' });
      }
      const buffer = Buffer.from(String(dataBase64).replace(/^data:[^,]+;base64,/, ''), 'base64');
      if (buffer.length < 1024 || buffer.length > 8 * 1024 * 1024 || !verifyImageMagicBytes(buffer, normalizedMime)) {
        return res.status(400).json({ error: 'Replacement ID image failed validation.' });
      }
      if (record.documentRecordId) {
        secureDeleteGovIdDocument(record.documentRecordId);
      }
      const meta = encryptGovIdToVault({
        requestId: record.id,
        fileName: String(fileName || 'updated-id.jpg'),
        mimeType: normalizedMime,
        buffer,
        retainUntil: record.documentRetainUntil,
      });
      record.documentRecordId = meta.id;
      record.documentDeletedAt = undefined;
    }

    record.additionalInfoResponse = String(responseText).trim().slice(0, 2000);
    record.status = 'under_verification';
    record.updatedAt = new Date().toISOString();
    addReviewHistoryEntry(record, {
      actorId: record.targetUserId || 'applicant',
      actorName: record.legalFullName,
      actorRole: 'regular_user',
      action: 'Provided additional verification information',
      note: record.additionalInfoResponse,
    });
    saveSecurityVault(vault);

    appendAuditLog({
      eventType: 'recovery_request_submission',
      actorId: record.targetUserId || 'applicant',
      actorRole: 'regular_user',
      targetUserId: record.targetUserId,
      referenceNumber: record.referenceNumber,
      ipAddress: getClientIp(req),
      outcome: 'success',
      details: 'Applicant submitted requested additional verification information.',
    });

    return res.json({ ok: true, status: record.status });
  });

  // Submit Appeal for Rejected Request
  router.post('/recovery/:referenceNumber/appeal', requireCsrf, (req, res) => {
    const ref = String(req.params.referenceNumber || '').trim().toUpperCase();
    const { explanation, fileName, mimeType, dataBase64 } = req.body || {};
    const vault = getSecurityVault();
    const record = vault.recoveryRequests.find((r) => r.referenceNumber.toUpperCase() === ref);
    if (!record) return res.status(404).json({ error: 'Recovery request not found.' });
    if (record.status !== 'rejected') {
      return res.status(400).json({
        error: 'Appeals can only be submitted on rejected verification/recovery requests.',
      });
    }
    const cleanExp = String(explanation || '').trim();
    if (cleanExp.length < 15) {
      return res.status(400).json({
        error: 'Please provide a clear explanation (at least 15 characters) for your appeal.',
      });
    }

    let additionalDocId: string | undefined;
    if (dataBase64 && mimeType) {
      const normalizedMime = normalizeMime(String(mimeType));
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(normalizedMime)) {
        return res.status(400).json({ error: 'Supporting ID image must be JPEG, PNG, or WebP.' });
      }
      const buffer = Buffer.from(String(dataBase64).replace(/^data:[^,]+;base64,/, ''), 'base64');
      if (buffer.length < 1024 || buffer.length > 8 * 1024 * 1024 || !verifyImageMagicBytes(buffer, normalizedMime)) {
        return res.status(400).json({ error: 'Supporting ID image failed validation.' });
      }
      const meta = encryptGovIdToVault({
        requestId: record.id,
        fileName: String(fileName || 'appeal-id.jpg'),
        mimeType: normalizedMime,
        buffer,
        retainUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
      additionalDocId = meta.id;
    }

    const appeal = createAppealRecord({
      explanation: cleanExp,
      additionalDocumentId: additionalDocId,
    });
    record.appeals.unshift(appeal);
    record.status = 'appeal_under_review';
    record.escalatedToSeniorReviewer = true;
    record.updatedAt = new Date().toISOString();
    addReviewHistoryEntry(record, {
      actorId: record.targetUserId || 'applicant',
      actorName: record.legalFullName,
      actorRole: 'regular_user',
      action: 'Submitted Appeal to Senior Reviewer',
      note: cleanExp,
    });
    saveSecurityVault(vault);

    appendAuditLog({
      eventType: 'appeal_submission',
      actorId: record.targetUserId || 'applicant',
      actorRole: 'regular_user',
      targetUserId: record.targetUserId,
      referenceNumber: record.referenceNumber,
      ipAddress: getClientIp(req),
      outcome: 'success',
      details: `Submitted recovery appeal (${appeal.id}); escalated to Senior Reviewer.`,
    });

    return res.status(201).json({ ok: true, status: record.status, appeal });
  });

  // Separate Recovery Authorization Completion Flow (never leaks old password)
  router.post('/recovery/complete', requireCsrf, (req, res) => {
    const ip = getClientIp(req);
    const { referenceNumber, recoveryAuthToken, newPassword, newEmail, newPhone } = req.body || {};
    if (!recoveryAuthToken || !newPassword) {
      return res.status(400).json({
        error: 'Recovery authorization token and new password are required.',
      });
    }

    const consumed = consumeRecoveryAuthToken({
      rawToken: String(recoveryAuthToken),
      referenceNumber: referenceNumber ? String(referenceNumber).trim().toUpperCase() : undefined,
    });
    if (!consumed.ok || !consumed.userId) {
      appendAuditLog({
        eventType: 'password_change',
        actorId: 'anonymous',
        actorRole: 'anonymous',
        referenceNumber: referenceNumber ? String(referenceNumber) : undefined,
        ipAddress: ip,
        outcome: 'failure',
        details: `Recovery completion rejected: ${consumed.error}`,
      });
      return res.status(400).json({ error: consumed.error || 'Invalid recovery authorization token.' });
    }

    const db = getDb();
    const user = db.users.find((u) => u.id === consumed.userId);
    if (!user) return res.status(404).json({ error: 'Target account not found.' });

    const pwErr = deps.validatePasswordComplexity(String(newPassword), [
      user.name,
      user.handle.replace(/^@/, ''),
      (user.email || '').split('@')[0] || '',
    ]);
    if (pwErr) return res.status(400).json({ error: pwErr });

    setUserPasswordHash(user.id, String(newPassword));
    delete user.password;

    const updatedContacts: string[] = [];
    if (newEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(newEmail).trim())) {
      user.email = String(newEmail).trim().toLowerCase();
      updatedContacts.push('email');
    }
    if (newPhone && normalizePhoneDigits(String(newPhone)).length >= 9) {
      user.mobile = String(newPhone).trim();
      updatedContacts.push('phone');
    }

    // Invalidate ALL active sessions across all devices
    const invalidatedCount = invalidateAllUserSessions(user.id);

    const vault = getSecurityVault();
    if (consumed.referenceNumber) {
      const rec = vault.recoveryRequests.find(
        (r) => r.referenceNumber === consumed.referenceNumber
      );
      if (rec) {
        rec.status = 'recovery_completed';
        rec.recoveryCompletedAt = new Date().toISOString();
        rec.updatedAt = rec.recoveryCompletedAt;
        // Shrink post-recovery retention to 7 days
        rec.documentRetainUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        addReviewHistoryEntry(rec, {
          actorId: user.id,
          actorName: user.name,
          actorRole: 'regular_user',
          action: 'Completed Account Recovery & Reset Credentials',
          note: `Invalidated ${invalidatedCount} prior sessions.${
            updatedContacts.length ? ` Updated ${updatedContacts.join(', ')}.` : ''
          }`,
        });
        saveSecurityVault(vault);
      }
    }

    deps.addNotification(db, {
      recipientId: user.id,
      actorId: user.id,
      type: 'password_changed',
      text: `Account recovery completed for ${consumed.referenceNumber || 'your account'}. Password reset and ${invalidatedCount} prior session(s) signed out.`,
    });
    saveDb(db);

    appendAuditLog({
      eventType: 'password_change',
      actorId: user.id,
      actorRole: resolveUserSecurityRoles(user).join(','),
      targetUserId: user.id,
      referenceNumber: consumed.referenceNumber,
      ipAddress: ip,
      outcome: 'success',
      details: `Account recovery finalized cleanly; invalidated ${invalidatedCount} prior sessions.`,
    });

    const { rawToken: newSessionToken } = createActiveSession({
      userId: user.id,
      req,
      method: 'account_recovery',
    });

    return res.json({
      ok: true,
      invalidatedSessions: invalidatedCount,
      sessionToken: newSessionToken,
      status: 'recovery_completed',
      message: 'Account recovery complete! Your new password is active and prior devices have been signed out.',
    });
  });

  // =========================================================================
  // ACCOUNT SECURITY SETTINGS (AUTHENTICATED USER)
  // =========================================================================
  router.get('/security/me', requireSession, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const vault = getSecurityVault();
    const cfg = getOrInitUserSecurityConfig(user.id);
    const idStatus = getIdentityStatusForUser(user.id);
    const roles = resolveUserSecurityRoles(user);
    const currentSess = getSessionFromRequest(req);

    const activeSessions = vault.sessions
      .filter((s) => s.userId === user.id && !s.revoked && new Date(s.expiresAt).getTime() > Date.now())
      .map(({ tokenHash: _th, adminMfaVerifiedAt: _mfa, ...s }) => ({
        ...s,
        current: s.id === req.authSessionId,
      }));

    const loginActivity = vault.loginActivity.filter((l) => l.userId === user.id).slice(0, 20);
    const myRequests = vault.recoveryRequests
      .filter((r) => r.targetUserId === user.id)
      .map((r) => ({
        id: r.id,
        referenceNumber: r.referenceNumber,
        purpose: r.purpose,
        idType: r.idType,
        status: r.status,
        requestedAdditionalInfo: r.requestedAdditionalInfo,
        rejectionReason: r.rejectionReason,
        documentRetainUntil: r.documentRetainUntil,
        documentDeletedAt: r.documentDeletedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

    return res.json({
      summary: {
        hasPasswordSet: userHasPassword(user),
        registeredEmail: user.email,
        emailVerified: Boolean(user.verified && user.email),
        registeredPhone: user.mobile,
        phoneVerified: Boolean(user.verified && user.mobile),
        mfaEnabled: cfg.mfaEnabled,
        mfaMethod: cfg.mfaMethod,
        recoveryEmailBackup: cfg.recoveryEmailBackup,
        securityRoles: roles,
        adminMfaVerified: isSessionAdminMfaActive(currentSess),
        identityVerificationStatus: idStatus.status,
        latestIdentityRequestRef: idStatus.latestRef,
        securityNotificationsEnabled: cfg.securityNotificationsEnabled,
      },
      sessions: activeSessions,
      loginActivity,
      identityRequests: myRequests,
    });
  });

  router.post('/security/change-password', requireCsrf, requireSession, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const ip = getClientIp(req);
    const { currentPassword, newPassword } = req.body || {};

    if (userHasPassword(user) && !verifyUserPassword(user, String(currentPassword || ''))) {
      appendAuditLog({
        eventType: 'password_change',
        actorId: user.id,
        actorRole: resolveUserSecurityRoles(user).join(','),
        targetUserId: user.id,
        ipAddress: ip,
        outcome: 'failure',
        details: 'Password change rejected due to incorrect current password.',
      });
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const pwErr = deps.validatePasswordComplexity(String(newPassword || ''), [
      user.name,
      user.handle.replace(/^@/, ''),
      (user.email || '').split('@')[0] || '',
    ]);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const db = getDb();
    const targetUser = db.users.find((u) => u.id === user.id)!;
    setUserPasswordHash(user.id, String(newPassword));
    delete targetUser.password;

    const revoked = invalidateAllUserSessions(user.id, req.authSessionId);
    deps.addNotification(db, {
      recipientId: user.id,
      actorId: user.id,
      type: 'password_changed',
      text: `Your password was changed. ${revoked} other device session(s) were logged out for safety.`,
    });
    saveDb(db);

    appendAuditLog({
      eventType: 'password_change',
      actorId: user.id,
      actorRole: resolveUserSecurityRoles(user).join(','),
      targetUserId: user.id,
      ipAddress: ip,
      outcome: 'success',
      details: `User changed password and invalidated ${revoked} other sessions.`,
    });

    return res.json({
      ok: true,
      revokedOtherSessions: revoked,
      message: 'Password updated and other active sessions signed out.',
    });
  });

  router.patch('/security/contact', requireCsrf, requireSession, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const ip = getClientIp(req);
    const { email, mobile, recoveryEmailBackup, securityNotificationsEnabled } = req.body || {};
    const db = getDb();
    const target = db.users.find((u) => u.id === user.id)!;
    const vault = getSecurityVault();
    const cfg = getOrInitUserSecurityConfig(user.id);
    const changedFields: string[] = [];

    if (typeof email === 'string' && email.trim() && email.trim().toLowerCase() !== (target.email || '').toLowerCase()) {
      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (db.users.some((u) => u.id !== target.id && (u.email || '').toLowerCase() === cleanEmail)) {
        return res.status(409).json({ error: 'That email address is already registered to another account.' });
      }
      target.email = cleanEmail;
      changedFields.push('email');
    }

    if (typeof mobile === 'string' && mobile.trim() !== (target.mobile || '')) {
      const cleanDigits = normalizePhoneDigits(mobile);
      if (cleanDigits.length < 9 || cleanDigits.length > 15) {
        return res.status(400).json({ error: 'Please enter a valid 9–15 digit phone number.' });
      }
      target.mobile = mobile.trim();
      changedFields.push('phone');
    }

    if (typeof recoveryEmailBackup === 'string') {
      const cleanBackup = recoveryEmailBackup.trim().toLowerCase();
      if (cleanBackup && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanBackup)) {
        return res.status(400).json({ error: 'Backup recovery email is invalid.' });
      }
      cfg.recoveryEmailBackup = cleanBackup || undefined;
      target.recoveryEmailBackup = cleanBackup || undefined;
      changedFields.push('backup_recovery_email');
    }

    if (typeof securityNotificationsEnabled === 'boolean') {
      cfg.securityNotificationsEnabled = securityNotificationsEnabled;
      target.securityNotificationsEnabled = securityNotificationsEnabled;
      changedFields.push('security_notifications');
    }

    saveSecurityVault(vault);
    if (changedFields.some((f) => f === 'email' || f === 'phone')) {
      deps.addNotification(db, {
        recipientId: target.id,
        actorId: target.id,
        type: 'security_alert',
        text: `Your registered recovery contact settings (${changedFields.join(', ')}) were updated.`,
      });
    }
    saveDb(db);

    appendAuditLog({
      eventType: 'contact_updated',
      actorId: target.id,
      actorRole: resolveUserSecurityRoles(target).join(','),
      targetUserId: target.id,
      ipAddress: ip,
      outcome: 'success',
      details: `Updated security/contact fields: ${changedFields.join(', ') || 'none'}.`,
    });

    return res.json({ ok: true, changedFields });
  });

  router.post('/security/sessions/:id/revoke', requireCsrf, requireSession, (req: AuthedRequest, res) => {
    const ok = revokeSingleSession(req.authUser!.id, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Session not found.' });
    appendAuditLog({
      eventType: 'session_revoked',
      actorId: req.authUser!.id,
      actorRole: resolveUserSecurityRoles(req.authUser!).join(','),
      targetUserId: req.authUser!.id,
      ipAddress: getClientIp(req),
      outcome: 'success',
      details: `Revoked session ${req.params.id}.`,
    });
    return res.json({ ok: true });
  });

  router.post('/security/sessions/revoke-others', requireCsrf, requireSession, (req: AuthedRequest, res) => {
    const count = invalidateAllUserSessions(req.authUser!.id, req.authSessionId);
    appendAuditLog({
      eventType: 'session_revoked',
      actorId: req.authUser!.id,
      actorRole: resolveUserSecurityRoles(req.authUser!).join(','),
      targetUserId: req.authUser!.id,
      ipAddress: getClientIp(req),
      outcome: 'success',
      details: `Logged out ${count} other active device session(s).`,
    });
    return res.json({ ok: true, revokedCount: count });
  });

  // TOTP / MFA Setup & Admin MFA Unlock
  router.get('/security/mfa/setup', requireSession, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const cfg = getOrInitUserSecurityConfig(user.id);
    const secret = cfg.totpSecretBase32!;
    const issuer = 'Sphere.';
    const label = encodeURIComponent(`${issuer}:${user.email || user.handle}`);
    const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
    return res.json({
      mfaEnabled: cfg.mfaEnabled,
      mfaMethod: cfg.mfaMethod,
      totpSecret: secret,
      otpauthUrl,
    });
  });

  router.post('/security/mfa/toggle', requireCsrf, requireSession, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const ip = getClientIp(req);
    const { enable, code } = req.body || {};
    const cfg = getOrInitUserSecurityConfig(user.id);
    const vault = getSecurityVault();

    if (!verifyTotpCode(cfg.totpSecretBase32!, String(code || ''))) {
      return res.status(400).json({
        error: 'Invalid 6-digit authenticator code. Verify the code from your authenticator app.',
      });
    }

    cfg.mfaEnabled = Boolean(enable);
    const db = getDb();
    const target = db.users.find((u) => u.id === user.id);
    if (target) {
      target.mfaEnabled = cfg.mfaEnabled;
      deps.addNotification(db, {
        recipientId: target.id,
        actorId: target.id,
        type: 'security_alert',
        text: `Two-factor authentication (TOTP MFA) was ${cfg.mfaEnabled ? 'enabled' : 'disabled'} on your account.`,
      });
      saveDb(db);
    }
    saveSecurityVault(vault);

    appendAuditLog({
      eventType: 'mfa_updated',
      actorId: user.id,
      actorRole: resolveUserSecurityRoles(user).join(','),
      targetUserId: user.id,
      ipAddress: ip,
      outcome: 'success',
      details: `User ${cfg.mfaEnabled ? 'enabled' : 'disabled'} TOTP two-factor authentication.`,
    });

    return res.json({ ok: true, mfaEnabled: cfg.mfaEnabled });
  });

  router.post('/security/mfa/admin-verify', requireCsrf, requireSession, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const ip = getClientIp(req);
    const rl = checkRateLimit(`admin-mfa:${user.id}:${ip}`, 8, 10 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({ error: 'Too many MFA verification attempts. Please wait.' });
    }
    const sess = getSessionFromRequest(req);
    if (!sess) return res.status(401).json({ error: 'Active session required.' });

    const cfg = getOrInitUserSecurityConfig(user.id);
    const code = String(req.body?.code || '').trim();
    if (!verifyTotpCode(cfg.totpSecretBase32!, code)) {
      appendAuditLog({
        eventType: 'suspicious_activity_alert',
        actorId: user.id,
        actorRole: resolveUserSecurityRoles(user).join(','),
        ipAddress: ip,
        outcome: 'failure',
        details: 'Administrative MFA verification failed due to invalid TOTP code.',
      });
      return res.status(401).json({
        error: 'Invalid 6-digit MFA code. Enroll your TOTP key in Account Security Settings if needed.',
      });
    }

    markSessionAdminMfaVerified(sess);
    appendAuditLog({
      eventType: 'mfa_updated',
      actorId: user.id,
      actorRole: resolveUserSecurityRoles(user).join(','),
      ipAddress: ip,
      outcome: 'success',
      details: 'Administrative MFA verified for restricted dashboard session (30m window).',
    });

    return res.json({ ok: true, adminMfaVerified: true });
  });

  // =========================================================================
  // VERIFICATION OFFICER & SENIOR REVIEWER DASHBOARD (STRICT RBAC)
  // Notice: platform_admin alone is EXCLUDED unless explicitly holding officer/senior role!
  // =========================================================================
  router.get(
    '/recovery/queue',
    requireSession,
    requireRoles(['verification_officer', 'senior_reviewer'], 'Identity Verification Queue'),
    (req: AuthedRequest, res) => {
      const statusFilter = String(req.query.status || 'all');
      const refQuery = String(req.query.q || '').trim().toLowerCase();
      const vault = getSecurityVault();

      let list = vault.recoveryRequests.map(sanitizeRecoveryForOfficer);
      if (statusFilter !== 'all') {
        list = list.filter((r) => r.status === statusFilter);
      }
      if (refQuery) {
        list = list.filter(
          (r) =>
            r.referenceNumber.toLowerCase().includes(refQuery) ||
            r.targetHandleOrId.toLowerCase().includes(refQuery) ||
            r.legalFullName.toLowerCase().includes(refQuery)
        );
      }

      const all = vault.recoveryRequests;
      const stats = {
        total: all.length,
        pending_review: all.filter((r) => r.status === 'pending_review').length,
        under_verification: all.filter((r) => r.status === 'under_verification').length,
        additional_info_required: all.filter((r) => r.status === 'additional_info_required').length,
        approved: all.filter((r) => r.status === 'approved').length,
        rejected: all.filter((r) => r.status === 'rejected').length,
        appeal_under_review: all.filter((r) => r.status === 'appeal_under_review').length,
        recovery_completed: all.filter((r) => r.status === 'recovery_completed').length,
      };

      const sess = getSessionFromRequest(req);
      return res.json({
        stats,
        adminMfaVerified: isSessionAdminMfaActive(sess),
        requests: list,
      });
    }
  );

  // Mint short-lived signed ID preview URL (requires officer/senior role + active admin MFA)
  router.post(
    '/recovery/:referenceNumber/sign-document',
    requireCsrf,
    requireSession,
    requireRoles(['verification_officer', 'senior_reviewer'], 'Encrypted Government ID Document'),
    (req: AuthedRequest, res) => {
      const user = req.authUser!;
      const ip = getClientIp(req);
      const sess = getSessionFromRequest(req);
      if (!sess || !isSessionAdminMfaActive(sess)) {
        return res.status(403).json({
          requiresAdminMfa: true,
          error: 'Administrative MFA verification is required before viewing encrypted government IDs.',
        });
      }

      const ref = String(req.params.referenceNumber || '').trim().toUpperCase();
      const vault = getSecurityVault();
      const record = vault.recoveryRequests.find((r) => r.referenceNumber.toUpperCase() === ref);
      if (!record) return res.status(404).json({ error: 'Recovery request not found.' });

      const targetDocId =
        typeof req.body?.documentId === 'string' && req.body.documentId
          ? req.body.documentId
          : record.documentRecordId;

      if (!targetDocId || record.documentDeletedAt) {
        return res.status(410).json({ error: 'Government ID document is no longer available or has been purged.' });
      }

      // Ensure document belongs to this request
      const belongsToRequest =
        targetDocId === record.documentRecordId ||
        record.appeals.some((a) => a.additionalDocumentId === targetDocId);
      if (!belongsToRequest) {
        return res.status(403).json({ error: 'Document does not belong to this recovery request.' });
      }

      const { token, expiresAt } = mintSignedDocumentToken({
        docId: targetDocId,
        viewerId: user.id,
        sessionId: sess.id,
        ttlSeconds: 120,
      });

      appendAuditLog({
        eventType: 'id_document_view',
        actorId: user.id,
        actorRole: resolveUserSecurityRoles(user).join(','),
        targetUserId: record.targetUserId,
        referenceNumber: record.referenceNumber,
        ipAddress: ip,
        outcome: 'success',
        details: `Issued 120s signed preview URL for encrypted Gov ID document ${targetDocId}.`,
      });

      return res.json({
        signedUrl: `/api/recovery/documents/${encodeURIComponent(targetDocId)}?token=${encodeURIComponent(token)}`,
        expiresAt,
      });
    }
  );

  // Serve decrypted Gov ID binary ONLY with valid short-lived HMAC token + authorized session
  router.get('/recovery/documents/:docId', (req, res) => {
    const docId = String(req.params.docId || '').trim();
    const token = String(req.query.token || '').trim();
    const ip = getClientIp(req);

    const tokenCheck = verifySignedDocumentToken(token, docId);
    if (!tokenCheck.valid || !tokenCheck.viewerId) {
      appendAuditLog({
        eventType: 'id_document_view',
        actorId: 'unverified',
        actorRole: 'unknown',
        ipAddress: ip,
        outcome: 'blocked',
        details: `Blocked access to encrypted Gov ID document ${docId}: invalid or expired signed token.`,
      });
      return res.status(403).json({ error: 'Invalid or expired signed document token.' });
    }

    // Also validate active officer/senior role for token viewer
    const db = getDb();
    const viewer = db.users.find((u) => u.id === tokenCheck.viewerId);
    if (!viewer || !hasAnySecurityRole(viewer, ['verification_officer', 'senior_reviewer'])) {
      return res.status(403).json({ error: 'Viewer lacks authorization for Gov ID inspection.' });
    }

    const decrypted = decryptGovIdFromVault(docId);
    if (!decrypted) {
      return res.status(404).json({ error: 'Encrypted document not found or already purged.' });
    }

    appendAuditLog({
      eventType: 'id_document_view',
      actorId: viewer.id,
      actorRole: resolveUserSecurityRoles(viewer).join(','),
      ipAddress: ip,
      outcome: 'success',
      details: `Decrypted and streamed Gov ID preview ${docId} to authorized reviewer ${viewer.handle}.`,
    });

    res.setHeader('Content-Type', decrypted.meta.mimeType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(decrypted.buffer);
  });

  // Reviewer Decision Endpoint (Approve / Reject with mandatory reason / Request Additional Info / Escalate)
  router.post(
    '/recovery/:referenceNumber/decision',
    requireCsrf,
    requireSession,
    requireRoles(['verification_officer', 'senior_reviewer'], 'Identity Verification Decision'),
    (req: AuthedRequest, res) => {
      const reviewer = req.authUser!;
      const reviewerRoles = resolveUserSecurityRoles(reviewer);
      const isSenior = reviewerRoles.includes('senior_reviewer');
      const ip = getClientIp(req);

      const ref = String(req.params.referenceNumber || '').trim().toUpperCase();
      const { action, reason, note, requestedInfo } = req.body || {};
      const vault = getSecurityVault();
      const record = vault.recoveryRequests.find((r) => r.referenceNumber.toUpperCase() === ref);
      if (!record) return res.status(404).json({ error: 'Recovery request not found.' });

      // Appeals and escalated cases require Senior Reviewer authority
      if (
        (record.status === 'appeal_under_review' || record.escalatedToSeniorReviewer) &&
        !isSenior &&
        (action === 'approve' || action === 'reject')
      ) {
        return res.status(403).json({
          error: 'Escalated requests and appeals can only be decided by a Senior Reviewer.',
        });
      }

      const nowIso = new Date().toISOString();
      let issuedRecoveryAuthToken: string | undefined;
      let recoveryAuthExpiresAt: string | undefined;

      if (action === 'start_verification') {
        record.status = 'under_verification';
        record.assignedOfficerId = reviewer.id;
        addReviewHistoryEntry(record, {
          actorId: reviewer.id,
          actorName: reviewer.name,
          actorRole: isSenior ? 'senior_reviewer' : 'verification_officer',
          action: 'Marked Under Verification',
          note: note ? String(note) : 'Assigned to officer for manual review.',
        });
      } else if (action === 'escalate') {
        record.escalatedToSeniorReviewer = true;
        record.status = 'under_verification';
        addReviewHistoryEntry(record, {
          actorId: reviewer.id,
          actorName: reviewer.name,
          actorRole: isSenior ? 'senior_reviewer' : 'verification_officer',
          action: 'Escalated to Senior Reviewer',
          note: note ? String(note) : 'Escalated for senior identity verification inspection.',
        });
      } else if (action === 'request_info') {
        const cleanInfo = String(requestedInfo || '').trim();
        if (!cleanInfo) {
          return res.status(400).json({ error: 'Please specify what additional information is required.' });
        }
        record.status = 'additional_info_required';
        record.requestedAdditionalInfo = cleanInfo;
        addReviewHistoryEntry(record, {
          actorId: reviewer.id,
          actorName: reviewer.name,
          actorRole: isSenior ? 'senior_reviewer' : 'verification_officer',
          action: 'Requested Additional Information',
          note: cleanInfo,
        });
      } else if (action === 'reject') {
        const cleanReason = String(reason || '').trim();
        if (!cleanReason) {
          return res.status(400).json({ error: 'A rejection reason is mandatory.' });
        }
        record.status = 'rejected';
        record.rejectionReason = cleanReason;
        // Retain 14 days for appeal window
        record.documentRetainUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        if (record.appeals.length > 0 && record.appeals[0].status === 'pending') {
          record.appeals[0].status = 'rejected';
          record.appeals[0].handledById = reviewer.id;
          record.appeals[0].handledByName = reviewer.name;
          record.appeals[0].handledAt = nowIso;
          record.appeals[0].decisionNote = cleanReason;
        }
        addReviewHistoryEntry(record, {
          actorId: reviewer.id,
          actorName: reviewer.name,
          actorRole: isSenior ? 'senior_reviewer' : 'verification_officer',
          action: 'Rejected Request',
          reason: cleanReason,
          note: note ? String(note) : undefined,
        });
      } else if (action === 'approve') {
        const db = getDb();
        // Resolve target user if not yet matched
        const targetUser =
          (record.targetUserId ? db.users.find((u) => u.id === record.targetUserId) : undefined) ||
          findUserByIdentifier(db, record.targetHandleOrId);
        if (!targetUser) {
          return res.status(400).json({
            error: 'Cannot approve: no matching Sphere account was found for this identifier.',
          });
        }
        record.targetUserId = targetUser.id;
        record.status = 'approved';

        if (record.appeals.length > 0 && record.appeals[0].status === 'pending') {
          record.appeals[0].status = 'approved';
          record.appeals[0].handledById = reviewer.id;
          record.appeals[0].handledByName = reviewer.name;
          record.appeals[0].handledAt = nowIso;
          record.appeals[0].decisionNote = note ? String(note) : 'Appeal approved by Senior Reviewer.';
        }

        if (record.purpose === 'hybrid_identity_verification') {
          targetUser.verified = true;
          if (targetUser.sphereIdCategory === 'unverified') {
            targetUser.sphereIdCategory = 'verified_individual';
          }
          // Shrink document retention window to 7 days after approval
          record.documentRetainUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          saveDb(db);
        } else {
          // Separate Recovery Authorization Process: does NOT auto-reset account
          const authIssued = issueRecoveryAuthToken({
            referenceNumber: record.referenceNumber,
            userId: targetUser.id,
            issuedBy: reviewer.id,
          });
          issuedRecoveryAuthToken = authIssued.rawToken;
          recoveryAuthExpiresAt = authIssued.expiresAtIso;
          record.recoveryAuthIssuedAt = nowIso;
          record.recoveryAuthExpiresAt = authIssued.expiresAtIso;
        }

        addReviewHistoryEntry(record, {
          actorId: reviewer.id,
          actorName: reviewer.name,
          actorRole: isSenior ? 'senior_reviewer' : 'verification_officer',
          action:
            record.purpose === 'hybrid_identity_verification'
              ? 'Approved Hybrid Identity Verification'
              : 'Approved Identity — Issued Separate Recovery Authorization Token',
          note: note ? String(note) : undefined,
        });
      } else {
        return res.status(400).json({ error: 'Invalid review action.' });
      }

      record.updatedAt = nowIso;
      saveSecurityVault(vault);

      if (record.targetUserId) {
        const db = getDb();
        deps.addNotification(db, {
          recipientId: record.targetUserId,
          actorId: reviewer.id,
          type: 'recovery_update',
          text: `Your verification/recovery request ${record.referenceNumber} status changed to "${record.status.replace(/_/g, ' ')}".`,
        });
        saveDb(db);
      }

      appendAuditLog({
        eventType: 'verification_decision',
        actorId: reviewer.id,
        actorRole: reviewerRoles.join(','),
        targetUserId: record.targetUserId,
        referenceNumber: record.referenceNumber,
        ipAddress: ip,
        outcome: 'success',
        details: `Reviewer decision "${action}" -> status "${record.status}".${reason ? ` Reason: ${reason}` : ''}`,
      });

      return res.json({
        ok: true,
        request: sanitizeRecoveryForOfficer(record),
        recoveryAuthToken: issuedRecoveryAuthToken,
        recoveryAuthExpiresAt,
      });
    }
  );

  // =========================================================================
  // SECURITY ADMINISTRATOR & PLATFORM ADMINISTRATOR ENDPOINTS
  // =========================================================================
  router.get(
    '/security/admin/audit-logs',
    requireSession,
    requireRoles(['security_admin'], 'Security Audit Logs'),
    (req, res) => {
      const eventType = String(req.query.eventType || 'all');
      const vault = getSecurityVault();
      const logs =
        eventType === 'all'
          ? vault.auditLogs
          : vault.auditLogs.filter((l) => l.eventType === eventType);
      const chainIntegrity = verifyAuditLogChain();
      return res.json({
        chainIntegrity,
        logs: logs.slice(0, 200),
      });
    }
  );

  router.get(
    '/security/admin/alerts',
    requireSession,
    requireRoles(['security_admin'], 'Suspicious Activity Alerts'),
    (_req, res) => {
      const vault = getSecurityVault();
      return res.json({ alerts: vault.alerts });
    }
  );

  router.patch(
    '/security/admin/alerts/:id',
    requireCsrf,
    requireSession,
    requireRoles(['security_admin'], 'Suspicious Activity Alert Investigation'),
    (req: AuthedRequest, res) => {
      const vault = getSecurityVault();
      const alert = vault.alerts.find((a) => a.id === req.params.id);
      if (!alert) return res.status(404).json({ error: 'Alert not found.' });

      const { status, resolutionNote } = req.body || {};
      if (status && ['open', 'investigating', 'resolved'].includes(String(status))) {
        alert.status = status;
      }
      if (typeof resolutionNote === 'string') {
        alert.resolutionNote = resolutionNote.trim().slice(0, 500);
      }
      alert.investigatedBy = req.authUser!.id;
      saveSecurityVault(vault);

      appendAuditLog({
        eventType: 'suspicious_activity_alert',
        actorId: req.authUser!.id,
        actorRole: resolveUserSecurityRoles(req.authUser!).join(','),
        targetUserId: alert.targetUserId,
        ipAddress: getClientIp(req),
        outcome: 'success',
        details: `Updated suspicious alert ${alert.id} status to "${alert.status}".`,
      });

      return res.json({ ok: true, alert });
    }
  );

  router.post(
    '/security/admin/retention-purge',
    requireCsrf,
    requireSession,
    requireRoles(['security_admin', 'platform_admin'], 'ID Document Retention Purge'),
    (req: AuthedRequest, res) => {
      const ip = getClientIp(req);
      const { purgeClosedNow } = req.body || {};
      if (purgeClosedNow) {
        const vault = getSecurityVault();
        const nowIso = new Date().toISOString();
        for (const r of vault.recoveryRequests) {
          if (
            (r.status === 'recovery_completed' || r.status === 'rejected' || r.status === 'approved') &&
            r.documentRecordId &&
            !r.documentDeletedAt
          ) {
            r.documentRetainUntil = nowIso;
          }
        }
        saveSecurityVault(vault);
      }

      const result = runRetentionPurge(req.authUser!.id, ip);
      return res.json({ ok: true, ...result });
    }
  );

  router.get(
    '/security/admin/roles',
    requireSession,
    requireRoles(['platform_admin', 'security_admin'], 'Personnel Roles Roster'),
    (req, res) => {
      const q = String(req.query.q || '').trim().toLowerCase();
      const db = getDb();
      const vault = getSecurityVault();

      const matched = db.users
        .filter((u) => {
          const roles = resolveUserSecurityRoles(u);
          const hasStaff = roles.some((r) => r !== 'regular_user');
          if (!q) return hasStaff || u.role === 'admin' || u.id === 'cherry' || u.id === 'marco-tech' || u.id === 'clarisse-sw';
          return (
            u.name.toLowerCase().includes(q) ||
            u.handle.toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
          );
        })
        .slice(0, 40)
        .map((u) => ({
          id: u.id,
          name: u.name,
          handle: u.handle,
          email: u.email,
          avatar: u.avatar,
          avatarColor: u.avatarColor,
          securityRoles: resolveUserSecurityRoles(u),
          mfaEnabled: Boolean(vault.userConfigs[u.id]?.mfaEnabled),
        }));

      return res.json({ personnel: matched });
    }
  );

  router.post(
    '/security/admin/roles',
    requireCsrf,
    requireSession,
    requireRoles(['platform_admin'], 'Personnel Role Assignment'),
    (req: AuthedRequest, res) => {
      const { targetUserId, roles } = req.body || {};
      if (!targetUserId || !Array.isArray(roles)) {
        return res.status(400).json({ error: 'targetUserId and roles[] are required.' });
      }
      const db = getDb();
      const targetUser = db.users.find((u) => u.id === targetUserId);
      if (!targetUser) return res.status(404).json({ error: 'Target user not found.' });

      const updated = updatePersonnelRoles(
        req.authUser!,
        targetUser,
        roles as SecurityRole[],
        getClientIp(req)
      );
      saveDb(db);

      return res.json({
        ok: true,
        targetUserId: targetUser.id,
        securityRoles: updated,
      });
    }
  );

  return router;
}
