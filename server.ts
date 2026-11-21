import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import http from 'http';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';
import {
  AdCampaign,
  AdObjective,
  AdStatus,
  AlbumItem,
  AnonymousPost,
  AnonymousTopic,
  DiscoveryCategory,
  DonationDrive,
  GroupItem,
  MarketplaceItem,
  MessageThread,
  NotificationItem,
  PageItem,
  PhotoItem,
  PrivacyLevel,
  ReactionType,
  SocialPost,
  SphereIdVerificationRequest,
  UserProfile,
} from './src/types/social';
import {
  canPostOnWall,
  canSatisfyPrivacy,
  canTagUser,
  canViewAlbum,
  canViewPhoto,
  canViewPost,
  checkSafeContent,
  generateAnonymousAlias,
} from './src/utils/discovery';
import {
  TOTAL_GLOBAL_DIRECTORY_COUNT,
  getVirtualUserById,
  queryGlobalDirectory,
  sampleGlobalMemberIds,
} from './src/utils/globalDirectory';
import { applyReactionRules, COMMENT_COOLDOWN_MS } from './src/utils/reactions';
import { getCategoryGuidelines } from './src/utils/communityRules';
import { ensureFriendLifeActivity, enrichUserLifeDetails } from './server/friendLifeGenerator';
import { getDb, sanitizeUser, sanitizeUsersForViewer, saveDb, UPLOADS_DIR } from './server/store';
import { createSecurityRouter } from './server/securityRoutes';
import {
  appendAuditLog,
  checkRateLimit,
  createActiveSession,
  getClientIp,
  recordFailedLoginActivity,
  recordSuspiciousAlert,
  resolveUserSecurityRoles,
  runRetentionPurge,
  setUserPasswordHash,
  verifyUserPassword,
} from './server/securityVault';

const PORT = Number(process.env.PORT) || 3000;
const app = express();
app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

// Static serving for generated seed media, public assets, and user uploads with browser caching
app.use(
  '/media-seed',
  express.static(path.resolve(process.cwd(), 'src/assets/images'), { maxAge: '7d' })
);
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1d' }));
app.use(
  '/assets',
  express.static(path.resolve(process.cwd(), 'public/assets'), { maxAge: '7d' })
);

// Gemini client for Universal Language Translation
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const ai = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

const translationCache = new Map<
  string,
  { translatedText: string; detectedLanguage: string; sameLanguage: boolean }
>();

const lastCommentAtByUser = new Map<string, number>();

// =========================================================================
// REAL-TIME WEBSOCKET SERVER (/ws)
// =========================================================================
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const socketUsers = new Map<WebSocket, string>();

function getOnlineUserIds(): string[] {
  const set = new Set<string>();
  for (const uid of socketUsers.values()) {
    if (uid) set.add(uid);
  }
  return Array.from(set);
}

function broadcastEvent(type: string, payload: unknown, excludeSocket?: WebSocket) {
  const message = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client !== excludeSocket && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function sendToUsers(userIds: string[], type: string, payload: unknown) {
  const targets = new Set(userIds);
  const message = JSON.stringify({ type, payload });
  for (const [client, uid] of socketUsers.entries()) {
    if (targets.has(uid) && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type === 'auth' && typeof msg.userId === 'string') {
        socketUsers.set(ws, msg.userId);
        broadcastEvent('presence', { onlineUserIds: getOnlineUserIds() });
      } else if (msg.type === 'typing' && msg.threadId && msg.userId) {
        const db = getDb();
        const thread = db.threads.find((t) => t.id === msg.threadId);
        if (thread) {
          sendToUsers(
            thread.participantIds.filter((id) => id !== msg.userId),
            'typing',
            {
              threadId: msg.threadId,
              userId: msg.userId,
              isTyping: Boolean(msg.isTyping),
            }
          );
        }
      } else if (
        typeof msg.type === 'string' &&
        [
          'call:invite',
          'call:accept',
          'call:decline',
          'call:end',
          'call:offer',
          'call:answer',
          'call:ice',
          'call:state',
        ].includes(msg.type)
      ) {
        const senderUid = socketUsers.get(ws) || String(msg.fromUserId || '');
        if (!senderUid) return;
        const db = getDb();
        let targets: string[] = [];
        if (msg.targetUserId) {
          targets = [String(msg.targetUserId)];
        } else if (msg.threadId) {
          const thread = db.threads.find((t) => t.id === msg.threadId);
          if (thread) {
            targets = thread.participantIds.filter((id) => id !== senderUid);
          }
        }
        if (targets.length > 0) {
          sendToUsers(targets, msg.type, {
            ...msg,
            fromUserId: senderUid,
          });
        }
      }
    } catch {
      // Ignore malformed frames
    }
  });

  ws.on('close', () => {
    socketUsers.delete(ws);
    broadcastEvent('presence', { onlineUserIds: getOnlineUserIds() });
  });
});

function buildFriendshipMap(db: ReturnType<typeof getDb>): Record<string, Set<string>> {
  const map: Record<string, Set<string>> = {};
  for (const [uid, list] of Object.entries(db.friendships)) {
    map[uid] = new Set(list);
  }
  return map;
}

function addNotification(
  db: ReturnType<typeof getDb>,
  notif: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>
) {
  const entry: NotificationItem = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    read: false,
    createdAt: 'Just now',
    ...notif,
  };
  db.notifications.unshift(entry);
  if (db.notifications.length > 80) {
    db.notifications = db.notifications.slice(0, 80);
  }
  sendToUsers([notif.recipientId], 'notification:new', entry);
}

function ensureUserInDb(db: ReturnType<typeof getDb>, userId: string): UserProfile | undefined {
  const existing = db.users.find((u) => u.id === userId);
  if (existing) return existing;
  if (userId.startsWith('virt-')) {
    const virtualUser = getVirtualUserById(userId);
    if (virtualUser) {
      db.users.push(virtualUser);
      db.friendships[userId] = db.friendships[userId] || [];
      db.outgoingRequests[userId] = db.outgoingRequests[userId] || [];
      return virtualUser;
    }
  }
  return undefined;
}

const ADMIN_EMAILS = new Set(['adrrycanal@gmail.com', 'adrian.villanueva@sphere.ph']);

const emailOtpStore = new Map<
  string,
  { code: string; expiresAt: number; attempts: number; verified: boolean }
>();

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

// =========================================================================
// MAGIC-BYTE UPLOAD VALIDATION
// =========================================================================
function normalizeMimeType(raw: string): string {
  return String(raw || '').split(';')[0].trim().toLowerCase();
}

function verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const mime = normalizeMimeType(mimeType);
  if (buffer.length < 4) return false;
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mime === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mime === 'application/pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (mime === 'video/mp4' || mime === 'audio/mp4' || mime === 'audio/x-m4a') {
    return buffer.length >= 8 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  if (mime === 'video/webm' || mime === 'audio/webm') {
    return (
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    );
  }
  if (mime === 'audio/ogg') {
    return buffer.subarray(0, 4).toString('ascii') === 'OggS';
  }
  if (mime === 'audio/wav' || mime === 'audio/wave' || mime === 'audio/x-wav') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WAVE'
    );
  }
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') {
    return (
      buffer.subarray(0, 3).toString('ascii') === 'ID3' ||
      (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
    );
  }
  return false;
}

const ALLOWED_UPLOAD_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'application/pdf',
]);

app.post('/api/upload', (req, res) => {
  const { fileName, mimeType, dataBase64 } = req.body || {};
  if (!fileName || !mimeType || !dataBase64) {
    return res.status(400).json({ error: 'Missing fileName, mimeType, or file data.' });
  }
  const safeCheck = checkSafeContent(String(fileName));
  if (!safeCheck.ok) {
    return res.status(400).json({ error: safeCheck.reason });
  }
  const normalizedMime = normalizeMimeType(String(mimeType));
  if (!ALLOWED_UPLOAD_MIMES.has(normalizedMime)) {
    return res.status(400).json({
      error: 'Unsupported file type. Allowed: JPEG, PNG, WebP, MP4, WebM, OGG, M4A, WAV, MP3, PDF.',
    });
  }

  const cleanedBase64 = String(dataBase64).replace(/^data:[^,]+;base64,/, '');
  const buffer = Buffer.from(cleanedBase64, 'base64');
  if (buffer.length > 15 * 1024 * 1024) {
    return res.status(400).json({ error: 'File exceeds the 15 MB upload limit.' });
  }
  if (!verifyMagicBytes(buffer, normalizedMime)) {
    return res.status(400).json({
      error: 'Upload failed magic-byte verification. File content does not match its declared type.',
    });
  }

  const ext = path.extname(String(fileName)).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
  const storedName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const fullPath = path.join(UPLOADS_DIR, storedName);
  fs.writeFileSync(fullPath, buffer);

  return res.status(201).json({
    url: `/uploads/${storedName}`,
    mimeType: normalizedMime,
    sizeBytes: buffer.length,
    name: String(fileName),
  });
});

// =========================================================================
// UNIVERSAL LANGUAGE TRANSLATION (/api/translate)
// =========================================================================
app.post('/api/translate', async (req, res) => {
  const { text, targetLanguage } = req.body || {};
  const trimmed = String(text || '').trim();
  const target = String(targetLanguage || 'English').trim();

  if (!trimmed) {
    return res.status(400).json({ error: 'Text to translate is required.' });
  }

  const cacheKey = `${target}::${trimmed}`;
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  if (!ai) {
    return res.status(503).json({
      error: 'Translation service is unavailable because GEMINI_API_KEY is not configured.',
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Detect the source language of the following social media text and translate it naturally into ${target}. Preserve tone, hashtags, and @mentions.\n\nText:\n${trimmed}`,
      config: {
        systemInstruction:
          'You are Sphere Universal Language translator. Return accurate, respectful, natural translations.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedLanguage: { type: Type.STRING },
            translatedText: { type: Type.STRING },
            sameLanguage: { type: Type.BOOLEAN },
          },
          required: ['detectedLanguage', 'translatedText', 'sameLanguage'],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim()) as {
      detectedLanguage?: string;
      translatedText?: string;
      sameLanguage?: boolean;
    };

    const result = {
      detectedLanguage: parsed.detectedLanguage || 'Unknown',
      translatedText: parsed.translatedText || trimmed,
      sameLanguage: Boolean(parsed.sameLanguage),
    };
    translationCache.set(cacheKey, result);
    return res.json(result);
  } catch (err) {
    console.error('Translation error:', err);
    return res.status(500).json({ error: 'Unable to translate right now. Please try again.' });
  }
});

// =========================================================================
// AUTHENTICATION & 18+ LEGITIMACY GATE
// =========================================================================
function validatePasswordComplexity(password: string, personalTokens: string[]): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (/\s/.test(password)) return 'Password must not contain spaces.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character (e.g. ! @ # $ %).';
  }
  const lower = password.toLowerCase();
  for (const tok of personalTokens) {
    const clean = tok.trim().toLowerCase();
    if (clean.length >= 3 && lower.includes(clean)) {
      return 'Password cannot contain your name, handle, or email username.';
    }
  }
  return null;
}

function calculateAge(birthday: string): number {
  const dob = new Date(birthday);
  if (Number.isNaN(dob.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body || {};
  const ip = getClientIp(req);
  const idLower = String(identifier || '').trim().toLowerCase();

  const rl = checkRateLimit(`login:${ip}:${idLower}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    recordSuspiciousAlert({
      severity: 'high',
      category: 'Repeated Failed Login Attempts',
      summary: `Rate limit exceeded on login attempts for "${idLower}" from ${ip}.`,
      ipAddress: ip,
    });
    return res.status(429).json({
      error: 'Too many sign-in attempts. Please wait a few minutes or use Account Recovery.',
    });
  }

  const db = getDb();

  const user = db.users.find(
    (u) =>
      u.id.toLowerCase() === idLower ||
      u.handle.toLowerCase() === idLower ||
      u.handle.replace(/^@/, '').toLowerCase() === idLower ||
      (u.email || '').toLowerCase() === idLower ||
      (u.mobile || '').toLowerCase() === idLower
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials. Please check your details or recover your account.' });
  }
  if (!verifyUserPassword(user, String(password || ''))) {
    recordFailedLoginActivity(user.id, 'password', req, 'failed');
    return res.status(401).json({ error: 'Invalid credentials. Please check your details or recover your account.' });
  }

  const { rawToken } = createActiveSession({
    userId: user.id,
    req,
    method: 'password',
  });

  const sanitized = sanitizeUser(user, user.id, db);
  sanitized.securityRoles = resolveUserSecurityRoles(user);
  return res.json({ user: sanitized, sessionToken: rawToken });
});

app.post('/api/auth/register', (req, res) => {
  const {
    firstName,
    lastName,
    handle,
    email,
    mobile,
    password,
    birthday,
    gender,
    location,
    country,
    language,
    preferredLanguage,
    privacyConsent,
    guidelinesConsent,
  } = req.body || {};

  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ error: 'Real first and last name are required.' });
  }
  if (!privacyConsent) {
    return res.status(400).json({ error: 'Please acknowledge the Global Data Privacy Notice.' });
  }
  if (!guidelinesConsent) {
    return res.status(400).json({ error: 'Please agree to follow the Sphere Community Guidelines.' });
  }

  const age = calculateAge(String(birthday || ''));
  if (age < 18) {
    return res.status(400).json({
      error:
        'Members must be at least 18 years old to register on Sphere. Parents and guardians are advised to supervise minors.',
    });
  }

  const normalizedHandle = `@${String(handle || '').replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._]/g, '')}`;
  if (normalizedHandle.length < 4) {
    return res.status(400).json({ error: 'Handle must be at least 3 valid characters.' });
  }

  const db = getDb();
  if (db.users.some((u) => u.handle.toLowerCase() === normalizedHandle)) {
    return res.status(409).json({ error: 'That @handle is already taken.' });
  }
  if (db.users.some((u) => (u.email || '').toLowerCase() === String(email || '').trim().toLowerCase())) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const pwError = validatePasswordComplexity(String(password || ''), [
    String(firstName || ''),
    String(lastName || ''),
    normalizedHandle.replace(/^@/, ''),
    String(email || '').split('@')[0] || '',
  ]);
  if (pwError) {
    return res.status(400).json({ error: pwError });
  }

  const newId = `user-${Date.now()}`;
  const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`;
  const fullLocation = country ? `${String(location || '').trim()}, ${country}` : String(location || '').trim();

  const newUser: UserProfile = {
    id: newId,
    role: 'member',
    name: fullName,
    handle: normalizedHandle,
    avatarColor: '#4F46E5',
    status: 'Just joined Sphere. Looking to connect with genuine people.',
    location: fullLocation || 'Philippines',
    country: country || 'Philippines',
    language: language || 'English',
    preferredLanguage: preferredLanguage || 'English',
    autoTranslate: false,
    interests: ['Community', 'Local Stories'],
    hobbies: [],
    skills: [],
    goals: [],
    categories: ['Lifestyle'],
    quote: 'Real connections matter more than numbers.',
    bio: `New verified member from ${fullLocation || 'Sphere.'}.`,
    joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    friendCount: 0,
    photoCount: 0,
    groupCount: 0,
    friendship: 'none',
    mutualFriends: 0,
    privacy: 'public',
    taggingSettings: { enabled: true, whoCanTag: 'friends', requireApproval: true },
    wallSharingSettings: { enabled: true, whoCanPost: 'friends', requireApproval: true },
    popularitySettings: {
      hidePublicLikeCounts: false,
      hideFollowerCounts: false,
      disableProfileEngagementStats: false,
    },
    sphereIdCategory: 'unverified',
    locationDiscoveryEnabled: true,
    preferredScope: 'nearby',
    email: String(email).trim(),
    mobile: String(mobile).trim(),
    birthday: String(birthday),
    gender: String(gender || 'Prefer not to say'),
    verified: false,
  };

  setUserPasswordHash(newId, String(password));
  db.users.push(newUser);
  db.friendships[newId] = [];
  saveDb(db);

  const { rawToken } = createActiveSession({
    userId: newId,
    req,
    method: 'registration',
  });
  const sanitized = sanitizeUser(newUser, newId, db);
  sanitized.securityRoles = resolveUserSecurityRoles(newUser);
  return res.status(201).json({ user: sanitized, sessionToken: rawToken });
});

app.post('/api/auth/reset-password', (_req, res) => {
  return res.status(403).json({
    error:
      'Direct password reset without a verified token is disabled. Use Account Recovery (/api/recovery/email/request, phone OTP, or government ID verification).',
  });
});

app.post('/api/auth/email-otp/send', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  const transporter = getSmtpTransporter();
  if (!transporter) {
    return res.json({
      sent: false,
      smtpConfigured: false,
      message:
        'Direct SMTP mail server is not configured. Use Firebase Email Verification Link or Phone SMS OTP.',
    });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  emailOtpStore.set(email, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0,
    verified: false,
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Your Sphere. Verification Code',
      text: `Your 6-digit Sphere. verification code is ${code}. It expires in 5 minutes.`,
      html: `<div style="font-family:sans-serif;max-width:480px;padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#4F46E5;margin:0 0 12px;">Sphere. Verification</h2>
        <p style="color:#334155;font-size:14px;">Use the 6-digit code below to verify your email address:</p>
        <div style="font-size:28px;font-weight:700;letter-spacing:6px;color:#0F172A;background:#EEF2FF;padding:12px 18px;border-radius:8px;text-align:center;margin:16px 0;">${code}</div>
        <p style="color:#64748B;font-size:12px;">This code expires in 5 minutes. If you did not request this, safely ignore this message.</p>
      </div>`,
    });
    return res.json({ sent: true, smtpConfigured: true });
  } catch (err) {
    console.error('SMTP sendMail error:', err);
    return res.status(502).json({
      error: 'Unable to send OTP email via SMTP right now. Try Firebase Email Verification Link or Phone SMS OTP.',
    });
  }
});

app.post('/api/auth/email-otp/verify', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const entry = emailOtpStore.get(email);
  if (!entry) {
    return res.status(400).json({ error: 'No active OTP found for this email. Request a new code.' });
  }
  if (Date.now() > entry.expiresAt) {
    emailOtpStore.delete(email);
    return res.status(400).json({ error: 'OTP code expired. Please request a fresh code.' });
  }
  entry.attempts += 1;
  if (entry.attempts > 5) {
    emailOtpStore.delete(email);
    return res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
  }
  if (entry.code !== code) {
    return res.status(400).json({ error: 'Invalid 6-digit code. Please check your inbox and try again.' });
  }
  entry.verified = true;
  emailOtpStore.set(email, entry);
  return res.json({ verified: true });
});

app.post('/api/auth/firebase-session', (req, res) => {
  const {
    uid,
    email,
    phoneNumber,
    displayName,
    emailVerified,
    otpVerified,
    signupDetails,
  } = req.body || {};

  if (!uid || typeof uid !== 'string') {
    return res.status(400).json({ error: 'Firebase session UID is required.' });
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPhone = String(phoneNumber || '').replace(/[^0-9+]/g, '');
  const hasVerifiedOtp =
    Boolean(otpVerified) &&
    Boolean(normalizedEmail) &&
    emailOtpStore.get(normalizedEmail)?.verified === true;

  if (!emailVerified && !normalizedPhone && !hasVerifiedOtp) {
    return res.status(403).json({
      error: 'Please verify your email address or phone OTP before signing into Sphere.',
    });
  }

  const db = getDb();
  let user = db.users.find((u) => {
    if (u.firebaseUid && u.firebaseUid === uid) return true;
    if (normalizedEmail && (u.email || '').toLowerCase() === normalizedEmail) return true;
    if (u.id === 'adrian' && normalizedEmail && ADMIN_EMAILS.has(normalizedEmail)) return true;
    if (normalizedPhone && u.mobile) {
      const uDigits = u.mobile.replace(/[^0-9]/g, '').slice(-10);
      const pDigits = normalizedPhone.replace(/[^0-9]/g, '').slice(-10);
      if (uDigits.length >= 9 && uDigits === pDigits) return true;
    }
    return false;
  });

  if (user) {
    user.firebaseUid = uid;
    user.verified = true;
    if (normalizedEmail && !user.email) user.email = normalizedEmail;
    if (normalizedPhone && !user.mobile) user.mobile = normalizedPhone;
    if (normalizedEmail && ADMIN_EMAILS.has(normalizedEmail)) {
      user.role = 'admin';
    }
    saveDb(db);
    const { rawToken } = createActiveSession({
      userId: user.id,
      req,
      method: normalizedPhone ? 'firebase_phone_otp' : 'firebase_auth',
    });
    const sanitized = sanitizeUser(user, user.id, db);
    sanitized.securityRoles = resolveUserSecurityRoles(user);
    return res.json({ user: sanitized, sessionToken: rawToken });
  }

  if (!signupDetails) {
    return res.json({
      needsOnboarding: true,
      uid,
      email: normalizedEmail || undefined,
      phoneNumber: normalizedPhone || undefined,
      displayName: displayName || undefined,
    });
  }

  const firstName = String(signupDetails.firstName || '').trim();
  const lastName = String(signupDetails.lastName || '').trim();
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'Real first and last name are required.' });
  }
  if (!signupDetails.privacyConsent || !signupDetails.guidelinesConsent) {
    return res.status(400).json({
      error: 'Privacy consent and Sphere Community Guidelines agreement are required.',
    });
  }

  const age = calculateAge(String(signupDetails.birthday || ''));
  if (age < 18) {
    return res.status(400).json({
      error:
        'Members must be at least 18 years old to register on Sphere. Parents and guardians are advised to supervise minors.',
    });
  }

  const rawHandle = String(signupDetails.handle || `${firstName}${lastName}`)
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '');
  let normalizedHandle = `@${rawHandle || `member${Date.now().toString().slice(-4)}`}`;
  if (db.users.some((u) => u.handle.toLowerCase() === normalizedHandle)) {
    normalizedHandle = `${normalizedHandle}.${String(Date.now()).slice(-4)}`;
  }

  const country = String(signupDetails.country || 'Philippines').trim() || 'Philippines';
  const city = String(signupDetails.location || '').trim();
  const fullLocation = city && country && !city.toLowerCase().includes(country.toLowerCase())
    ? `${city}, ${country}`
    : city || country;

  const newId = `user-${Date.now()}`;
  const role = normalizedEmail && ADMIN_EMAILS.has(normalizedEmail) ? 'admin' : 'member';
  const newUser: UserProfile = {
    id: newId,
    firebaseUid: uid,
    role,
    name: `${firstName} ${lastName}`,
    handle: normalizedHandle,
    avatarColor: '#4F46E5',
    status: 'Just joined Sphere. Looking to connect with genuine people.',
    location: fullLocation,
    country,
    language: String(signupDetails.language || 'English').trim() || 'English',
    preferredLanguage: String(signupDetails.preferredLanguage || 'English').trim() || 'English',
    autoTranslate: true,
    interests: Array.isArray(signupDetails.interests) && signupDetails.interests.length > 0
      ? signupDetails.interests
      : ['Community', 'Local Stories'],
    hobbies: [],
    skills: [],
    goals: [],
    categories: ['Lifestyle'],
    quote: 'Real connections matter more than numbers.',
    bio: `Verified Sphere. member from ${fullLocation}.`,
    joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    friendCount: 0,
    photoCount: 0,
    groupCount: 0,
    friendship: 'none',
    mutualFriends: 0,
    privacy: 'public',
    taggingSettings: { enabled: true, whoCanTag: 'friends', requireApproval: true },
    wallSharingSettings: { enabled: true, whoCanPost: 'friends', requireApproval: true },
    popularitySettings: {
      hidePublicLikeCounts: false,
      hideFollowerCounts: false,
      disableProfileEngagementStats: false,
    },
    sphereIdCategory: 'unverified',
    locationDiscoveryEnabled: true,
    preferredScope: 'global',
    email: normalizedEmail || String(signupDetails.email || '').trim() || undefined,
    mobile: normalizedPhone || String(signupDetails.mobile || '').trim() || undefined,
    birthday: String(signupDetails.birthday || ''),
    gender: String(signupDetails.gender || 'Prefer not to say'),
    verified: true,
  };

  db.users.push(newUser);
  db.friendships[newId] = [];
  db.outgoingRequests[newId] = [];
  saveDb(db);

  const { rawToken } = createActiveSession({
    userId: newId,
    req,
    method: 'firebase_signup',
  });
  const sanitized = sanitizeUser(newUser, newId, db);
  sanitized.securityRoles = resolveUserSecurityRoles(newUser);
  return res.status(201).json({ user: sanitized, sessionToken: rawToken });
});

// =========================================================================
// 100,000+ GLOBAL IMAGINARY USERS DIRECTORY
// =========================================================================
app.get('/api/directory', (req, res) => {
  const viewerId = typeof req.query.viewerId === 'string' ? req.query.viewerId : '';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(48, Math.max(6, Number(req.query.limit) || 24));
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const country = typeof req.query.country === 'string' ? req.query.country : 'All';
  const category = (typeof req.query.category === 'string'
    ? req.query.category
    : 'All') as DiscoveryCategory | 'All';

  const db = getDb();
  const viewer = viewerId ? db.users.find((u) => u.id === viewerId) : undefined;
  const friendSet = new Set(viewerId ? db.friendships[viewerId] || [] : []);
  const outgoingSet = new Set(viewerId ? db.outgoingRequests[viewerId] || [] : []);

  const result = queryGlobalDirectory({
    viewer,
    page,
    limit,
    query: q,
    country,
    category,
    friendSet,
    outgoingSet,
  });

  return res.json(result);
});

app.get('/api/directory/:id', (req, res) => {
  const viewerId = typeof req.query.viewerId === 'string' ? req.query.viewerId : '';
  const { id } = req.params;
  const db = getDb();
  const existing = db.users.find((u) => u.id === id);
  if (existing) {
    if (enrichUserLifeDetails(existing)) saveDb(db);
    return res.json({ user: sanitizeUser(existing, viewerId || undefined, db) });
  }
  const virtualUser = getVirtualUserById(id);
  if (!virtualUser) {
    return res.status(404).json({ error: 'Global member not found.' });
  }
  enrichUserLifeDetails(virtualUser);
  return res.json({ user: virtualUser });
});

// =========================================================================
// BOOTSTRAP (STRICT LOGGED-OUT ZERO-ACCOUNT GATE + PRIVACY PER VIEWER)
// =========================================================================
app.get('/api/bootstrap', (req, res) => {
  const viewerId = typeof req.query.viewerId === 'string' ? req.query.viewerId.trim() : '';
  const db = getDb();

  // Strict logged-out / incognito boundary: expose zero accounts or personal data
  if (!viewerId) {
    return res.json({
      users: [],
      posts: [],
      photos: [],
      albums: [],
      marketplace: [],
      groups: [],
      pages: [],
      testimonials: [],
      threads: [],
      anonymousPosts: [],
      verificationRequests: [],
      adCampaigns: [],
      donationDrives: [],
      notifications: [],
      onlineUserIds: [],
      totalGlobalPopulation: TOTAL_GLOBAL_DIRECTORY_COUNT,
    });
  }

  const friendships = buildFriendshipMap(db);
  const sanitizedUsers = sanitizeUsersForViewer(db, viewerId, friendships);
  const viewer = sanitizedUsers.find((u) => u.id === viewerId);

  if (!viewer) {
    return res.json({
      users: [],
      posts: [],
      photos: [],
      albums: [],
      marketplace: [],
      groups: [],
      pages: [],
      testimonials: [],
      threads: [],
      anonymousPosts: [],
      verificationRequests: [],
      adCampaigns: [],
      donationDrives: [],
      notifications: [],
      onlineUserIds: [],
      totalGlobalPopulation: TOTAL_GLOBAL_DIRECTORY_COUNT,
    });
  }

  const visiblePosts = db.posts.filter((post) => canViewPost(viewerId, post, sanitizedUsers, friendships));
  const visiblePhotos = db.photos.filter((photo) => canViewPhoto(viewerId, photo, sanitizedUsers, friendships));
  const visibleAlbums = db.albums.filter((alb) => canViewAlbum(viewerId, alb, sanitizedUsers, friendships));
  const visibleMarketplace = db.marketplace.filter((item) =>
    canSatisfyPrivacy(item.privacy, viewerId, item.sellerId, sanitizedUsers, friendships)
  );

  const visibleGroups = db.groups.map((g) => ({
    ...g,
    joined: g.memberIds.includes(viewerId),
    totalMembers: Math.max(g.totalMembers, g.memberIds.length),
  }));

  const visiblePages = db.pages.map((p) => ({
    ...p,
    following: p.followerIds.includes(viewerId),
    totalFollowers: Math.max(p.totalFollowers, p.followerIds.length),
  }));

  const visibleThreads = db.threads.filter((t) => t.participantIds.includes(viewerId));

  const visibleAds = db.adCampaigns.filter((ad) => {
    if (ad.status === 'approved') return true;
    if (ad.advertiserId === viewerId) return true;
    if (viewer.role === 'admin') return true;
    return false;
  });

  const visibleVerifications =
    viewer.role === 'admin'
      ? db.verificationRequests
      : db.verificationRequests.filter((r) => r.applicantUserId === viewerId);

  const visibleNotifications = db.notifications.filter((n) => n.recipientId === viewerId);

  return res.json({
    users: sanitizedUsers,
    posts: visiblePosts,
    photos: visiblePhotos,
    albums: visibleAlbums,
    marketplace: visibleMarketplace,
    groups: visibleGroups,
    pages: visiblePages,
    testimonials: db.testimonials,
    threads: visibleThreads,
    anonymousPosts: db.anonymousPosts.filter((a) => !a.hidden),
    verificationRequests: visibleVerifications,
    adCampaigns: visibleAds,
    donationDrives: db.donationDrives,
    notifications: visibleNotifications,
    onlineUserIds: getOnlineUserIds(),
    totalGlobalPopulation: TOTAL_GLOBAL_DIRECTORY_COUNT,
  });
});

// =========================================================================
// USER PROFILE, PRIVACY SETTINGS & FRIENDSHIPS
// =========================================================================
app.get('/api/users/:id/activity', (req, res) => {
  const { id } = req.params;
  const viewerId = typeof req.query.viewerId === 'string' ? req.query.viewerId.trim() : '';
  const db = getDb();
  const user = ensureUserInDb(db, id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const activity = ensureFriendLifeActivity(db, user.id);
  if (activity.changed) {
    saveDb(db);
  }

  const friendships = buildFriendshipMap(db);
  const sanitizedUsers = sanitizeUsersForViewer(db, viewerId || undefined, friendships);
  const sanitizedTarget =
    sanitizedUsers.find((u) => u.id === user.id) || sanitizeUser(user, viewerId || undefined, db);

  const visiblePosts = viewerId
    ? activity.posts.filter((p) => canViewPost(viewerId, p, sanitizedUsers, friendships))
    : activity.posts.filter((p) => (p.privacy || 'public') === 'public');
  const visiblePhotos = viewerId
    ? activity.photos.filter((ph) => canViewPhoto(viewerId, ph, sanitizedUsers, friendships))
    : activity.photos.filter((ph) => (ph.privacy || 'public') === 'public');
  const visibleAlbums = viewerId
    ? activity.albums.filter((alb) => canViewAlbum(viewerId, alb, sanitizedUsers, friendships))
    : activity.albums.filter((alb) => (alb.privacy || 'public') === 'public');

  return res.json({
    user: sanitizedTarget,
    posts: visiblePosts,
    photos: visiblePhotos,
    albums: visibleAlbums,
    testimonials: activity.testimonials,
  });
});

app.patch('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const allowedFields: (keyof UserProfile)[] = [
    'name',
    'status',
    'location',
    'country',
    'language',
    'preferredLanguage',
    'autoTranslate',
    'interests',
    'hobbies',
    'skills',
    'goals',
    'categories',
    'quote',
    'bio',
    'avatar',
    'coverImage',
    'privacy',
    'taggingSettings',
    'wallSharingSettings',
    'popularitySettings',
    'locationDiscoveryEnabled',
    'preferredScope',
    'birthday',
    'occupation',
    'workplace',
    'education',
    'hometown',
    'relationshipStatus',
    'currentlyInto',
    'favoriteFood',
  ];

  for (const field of allowedFields) {
    if (req.body && field in req.body) {
      if (typeof req.body[field] === 'string') {
        const safe = checkSafeContent(req.body[field]);
        if (!safe.ok) return res.status(400).json({ error: safe.reason });
      }
      (user as unknown as Record<string, unknown>)[field] = req.body[field];
    }
  }

  saveDb(db);
  const sanitized = sanitizeUser(user, id, db);
  broadcastEvent('user:updated', sanitized);
  return res.json({ user: sanitized });
});

app.post('/api/users/:id/friend', (req, res) => {
  const targetId = req.params.id;
  const { viewerId, action } = req.body || {};
  if (!viewerId || viewerId === targetId) {
    return res.status(400).json({ error: 'Invalid friend request.' });
  }
  const db = getDb();
  const target = ensureUserInDb(db, targetId);
  const viewer = ensureUserInDb(db, String(viewerId));
  if (!target || !viewer) return res.status(404).json({ error: 'User not found.' });

  db.friendships[viewerId] = db.friendships[viewerId] || [];
  db.friendships[targetId] = db.friendships[targetId] || [];
  db.outgoingRequests[viewerId] = db.outgoingRequests[viewerId] || [];
  db.outgoingRequests[targetId] = db.outgoingRequests[targetId] || [];

  const isFriend = db.friendships[viewerId].includes(targetId);
  const incomingFromTarget = db.outgoingRequests[targetId].includes(viewerId);
  const outgoingToTarget = db.outgoingRequests[viewerId].includes(targetId);

  if (action === 'accept' || (incomingFromTarget && action !== 'decline')) {
    db.outgoingRequests[targetId] = db.outgoingRequests[targetId].filter((id) => id !== viewerId);
    if (!db.friendships[viewerId].includes(targetId)) db.friendships[viewerId].push(targetId);
    if (!db.friendships[targetId].includes(viewerId)) db.friendships[targetId].push(viewerId);
    addNotification(db, {
      recipientId: targetId,
      actorId: viewerId,
      type: 'friend_request',
      text: `${viewer.name} accepted your circle connection request.`,
    });
  } else if (action === 'decline') {
    db.outgoingRequests[targetId] = db.outgoingRequests[targetId].filter((id) => id !== viewerId);
  } else if (isFriend) {
    db.friendships[viewerId] = db.friendships[viewerId].filter((id) => id !== targetId);
    db.friendships[targetId] = db.friendships[targetId].filter((id) => id !== viewerId);
  } else if (outgoingToTarget) {
    db.outgoingRequests[viewerId] = db.outgoingRequests[viewerId].filter((id) => id !== targetId);
  } else {
    db.outgoingRequests[viewerId].push(targetId);
    addNotification(db, {
      recipientId: targetId,
      actorId: viewerId,
      type: 'friend_request',
      text: `${viewer.name} sent you a circle connection request.`,
    });
  }

  saveDb(db);
  const updatedTarget = sanitizeUser(target, viewerId, db);
  return res.json({ ok: true, friendship: updatedTarget.friendship });
});

app.post('/api/privacy/check', (req, res) => {
  const { actorId, targetId, action } = req.body || {};
  const db = getDb();
  const target = db.users.find((u) => u.id === targetId);
  if (!target) return res.status(404).json({ error: 'Target user not found.' });
  const friendships = buildFriendshipMap(db);

  if (action === 'wall_post') {
    const result = canPostOnWall(String(actorId), target, db.users, friendships);
    if (!result.allowed) return res.status(403).json(result);
    return res.json(result);
  }
  const result = canTagUser(String(actorId), target, db.users, friendships);
  if (!result.allowed) return res.status(403).json(result);
  return res.json(result);
});

// =========================================================================
// POSTS, LOOPS (MAX 3 MIN), REACTIONS (1 CHOICE, 3 SWITCHES), & WALL/TAG APPROVALS
// =========================================================================
app.post('/api/posts', (req, res) => {
  const {
    authorId,
    content,
    location,
    country,
    privacy,
    vibe,
    targetProfileId,
    taggedUserIds,
    groupId,
    pageId,
    postAsPage,
    photoSrc,
    photoCaption,
    albumId,
    video,
  } = req.body || {};

  const db = getDb();
  const author = db.users.find((u) => u.id === authorId);
  if (!author) return res.status(404).json({ error: 'Author not found.' });

  const safeCheck = checkSafeContent(`${content || ''} ${photoCaption || ''} ${video?.title || ''}`);
  if (!safeCheck.ok) {
    return res.status(400).json({ error: safeCheck.reason });
  }

  // Enforce max 3 minutes (180 seconds) for Loops (short videos)
  if (video && video.format === 'short' && typeof video.durationSeconds === 'number' && video.durationSeconds > 180) {
    return res.status(400).json({
      error: 'Loops (short videos) have a maximum duration of 3 minutes (180 seconds). Please upload as a regular Video instead.',
    });
  }

  const friendships = buildFriendshipMap(db);

  // Enforce MySpace Wall Sharing Privacy Controls on backend
  let wallApproved = true;
  if (targetProfileId && targetProfileId !== authorId) {
    const targetUser = ensureUserInDb(db, String(targetProfileId));
    if (!targetUser) return res.status(404).json({ error: 'Target profile not found.' });
    const wallCheck = canPostOnWall(authorId, targetUser, db.users, friendships);
    if (!wallCheck.allowed) {
      return res.status(403).json({ error: wallCheck.reason || 'Wall sharing is restricted by user privacy settings.' });
    }
    wallApproved = !wallCheck.requiresApproval;
  }

  // Enforce Profile Tagging Privacy Controls on backend
  const requestedTags: string[] = Array.isArray(taggedUserIds) ? taggedUserIds : [];
  const approvedTagUserIds: string[] = [];
  const pendingTagUserIds: string[] = [];

  for (const tid of requestedTags) {
    const target = db.users.find((u) => u.id === tid);
    if (!target) continue;
    const tagCheck = canTagUser(authorId, target, db.users, friendships);
    if (!tagCheck.allowed) {
      return res.status(403).json({ error: tagCheck.reason || `Tagging ${target.name} is restricted.` });
    }
    if (tagCheck.requiresApproval) {
      pendingTagUserIds.push(tid);
    } else {
      approvedTagUserIds.push(tid);
    }
  }

  let createdPhoto: PhotoItem | undefined;
  const postPrivacy: PrivacyLevel = privacy || author.privacy || 'public';

  if (photoSrc) {
    const targetAlbum = albumId ? db.albums.find((a) => a.id === albumId) : undefined;
    createdPhoto = {
      id: `ph-${Date.now()}`,
      ownerId: authorId,
      pageId: pageId || undefined,
      postAsPage: Boolean(postAsPage),
      groupId: groupId || undefined,
      albumId: targetAlbum?.id,
      mediaType: 'image',
      src: String(photoSrc),
      caption: String(photoCaption || content || '').trim(),
      location: String(location || author.location),
      album: targetAlbum?.name || 'Pulse Uploads',
      createdAt: 'Just now',
      likes: [],
      reactions: {},
      comments: [],
      privacy: postPrivacy,
    };
    db.photos.unshift(createdPhoto);
    author.photoCount += 1;
  }

  const newPost: SocialPost = {
    id: `post-${Date.now()}`,
    authorId,
    targetProfileId: targetProfileId || undefined,
    wallApproved,
    taggedUserIds: [...approvedTagUserIds, ...pendingTagUserIds],
    approvedTagUserIds,
    pendingTagUserIds,
    groupId: groupId || undefined,
    pageId: pageId || undefined,
    postAsPage: Boolean(postAsPage),
    content: String(content || '').trim(),
    location: location || author.location,
    country: country || author.country || 'Philippines',
    language: author.language?.split('&')[0]?.trim() || 'English',
    createdAt: 'Just now',
    likes: [],
    reactions: {},
    reactionTracker: { userReactions: {}, switchCounts: {} },
    comments: [],
    photoId: createdPhoto?.id,
    video: video || undefined,
    sharesCount: 0,
    privacy: postPrivacy,
    vibe: vibe || undefined,
  };

  db.posts.unshift(newPost);

  if (targetProfileId && targetProfileId !== authorId && !wallApproved) {
    addNotification(db, {
      recipientId: targetProfileId,
      actorId: authorId,
      type: 'wall_request',
      text: `${author.name} shared a post to your MySpace wall. Review to approve or hide.`,
      postId: newPost.id,
    });
  }

  for (const tid of pendingTagUserIds) {
    addNotification(db, {
      recipientId: tid,
      actorId: authorId,
      type: 'tag_request',
      text: `${author.name} tagged you in a post. Review before it appears on your MySpace.`,
      postId: newPost.id,
    });
  }

  saveDb(db);
  broadcastEvent('post:new', newPost);
  return res.status(201).json({
    post: newPost,
    photo: createdPhoto,
    message: !wallApproved
      ? 'Submitted for MySpace wall approval.'
      : pendingTagUserIds.length > 0
        ? 'Published! Pending tag approvals sent to tagged friends.'
        : undefined,
  });
});

app.delete('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  const userId = String(req.query.userId || '');
  const db = getDb();
  const post = db.posts.find((p) => p.id === id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.authorId !== userId && post.targetProfileId !== userId) {
    return res.status(403).json({ error: 'You can only delete your own posts or posts on your MySpace.' });
  }
  db.posts = db.posts.filter((p) => p.id !== id);
  saveDb(db);
  broadcastEvent('post:deleted', { postId: id });
  return res.json({ ok: true });
});

app.patch('/api/posts/:id/audience', (req, res) => {
  const { id } = req.params;
  const { userId, privacy } = req.body || {};
  const db = getDb();
  const post = db.posts.find((p) => p.id === id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.authorId !== userId) {
    return res.status(403).json({ error: 'Only the author can update post audience.' });
  }
  post.privacy = privacy;
  saveDb(db);
  return res.json({ post });
});

app.post('/api/posts/:id/react', (req, res) => {
  const { id } = req.params;
  const { userId, reactionType } = req.body || {};
  const db = getDb();
  const post = db.posts.find((p) => p.id === id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  const outcome = applyReactionRules({
    userId: String(userId),
    reactionType: reactionType as ReactionType,
    reactions: post.reactions,
    tracker: post.reactionTracker,
    likes: post.likes,
  });

  if (!outcome.ok) {
    return res.status(429).json({ error: outcome.error, switchesRemaining: outcome.switchesRemaining });
  }

  post.reactions = outcome.reactions;
  post.reactionTracker = outcome.tracker;
  post.likes = outcome.likes;
  saveDb(db);
  broadcastEvent('post:updated', post);
  return res.json({ post, switchesRemaining: outcome.switchesRemaining });
});

app.post('/api/posts/:id/comments', (req, res) => {
  const { id } = req.params;
  const { authorId, text } = req.body || {};
  const cleanText = String(text || '').trim();
  if (!cleanText) return res.status(400).json({ error: 'Comment cannot be empty.' });

  const safeCheck = checkSafeContent(cleanText);
  if (!safeCheck.ok) return res.status(400).json({ error: safeCheck.reason });

  // Anti-flood protection on comments
  const now = Date.now();
  const lastAt = lastCommentAtByUser.get(String(authorId)) || 0;
  if (now - lastAt < COMMENT_COOLDOWN_MS) {
    return res.status(429).json({
      error: 'Please wait a couple of seconds before posting another comment (anti-flood protection).',
    });
  }
  lastCommentAtByUser.set(String(authorId), now);

  const db = getDb();
  const post = db.posts.find((p) => p.id === id);
  const author = db.users.find((u) => u.id === authorId);
  if (!post || !author) return res.status(404).json({ error: 'Post or user not found.' });

  const comment = {
    id: `c-${Date.now()}`,
    authorId: String(authorId),
    text: cleanText,
    createdAt: 'Just now',
    likes: 0,
    language: author.language?.split('&')[0]?.trim() || 'English',
    reactions: {},
    reactionTracker: { userReactions: {}, switchCounts: {} },
  };
  post.comments.push(comment);
  saveDb(db);
  broadcastEvent('post:updated', post);
  return res.status(201).json({ comment, post });
});

app.post('/api/posts/:postId/comments/:commentId/react', (req, res) => {
  const { postId, commentId } = req.params;
  const { userId, reactionType } = req.body || {};
  const db = getDb();
  const post = db.posts.find((p) => p.id === postId);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const comment = post.comments.find((c) => c.id === commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found.' });

  const outcome = applyReactionRules({
    userId: String(userId),
    reactionType: reactionType as ReactionType,
    reactions: comment.reactions,
    tracker: comment.reactionTracker,
  });

  if (!outcome.ok) {
    return res.status(429).json({ error: outcome.error, switchesRemaining: outcome.switchesRemaining });
  }

  comment.reactions = outcome.reactions;
  comment.reactionTracker = outcome.tracker;
  comment.likes = outcome.likes.length;
  saveDb(db);
  broadcastEvent('post:updated', post);
  return res.json({ post, switchesRemaining: outcome.switchesRemaining });
});

app.post('/api/posts/:id/share', (req, res) => {
  const { id } = req.params;
  const { authorId, commentary, privacy } = req.body || {};
  const db = getDb();
  const original = db.posts.find((p) => p.id === id);
  const author = db.users.find((u) => u.id === authorId);
  if (!original || !author) return res.status(404).json({ error: 'Post not found.' });

  const safeCheck = checkSafeContent(String(commentary || ''));
  if (!safeCheck.ok) return res.status(400).json({ error: safeCheck.reason });

  original.sharesCount += 1;
  const sharedPost: SocialPost = {
    id: `post-${Date.now()}`,
    authorId: String(authorId),
    content: String(commentary || '').trim(),
    location: author.location,
    country: author.country || 'Philippines',
    language: author.language?.split('&')[0]?.trim() || 'English',
    createdAt: 'Just now',
    likes: [],
    reactions: {},
    reactionTracker: { userReactions: {}, switchCounts: {} },
    comments: [],
    sharedPostId: original.id,
    sharesCount: 0,
    privacy: (privacy as PrivacyLevel) || 'public',
  };
  db.posts.unshift(sharedPost);
  saveDb(db);
  broadcastEvent('post:new', sharedPost);
  return res.status(201).json({ post: sharedPost });
});

// Tagging & Wall-Sharing Approval Workflows
app.post('/api/posts/:id/tag-decision', (req, res) => {
  const { id } = req.params;
  const { userId, decision } = req.body || {};
  const db = getDb();
  const post = db.posts.find((p) => p.id === id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  post.pendingTagUserIds = (post.pendingTagUserIds || []).filter((uid) => uid !== userId);
  if (decision === 'approve') {
    post.approvedTagUserIds = Array.from(new Set([...(post.approvedTagUserIds || []), userId]));
  } else {
    post.taggedUserIds = (post.taggedUserIds || []).filter((uid) => uid !== userId);
  }
  saveDb(db);
  return res.json({ post });
});

app.post('/api/posts/:id/remove-tag', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body || {};
  const db = getDb();
  const post = db.posts.find((p) => p.id === id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  post.taggedUserIds = (post.taggedUserIds || []).filter((uid) => uid !== userId);
  post.approvedTagUserIds = (post.approvedTagUserIds || []).filter((uid) => uid !== userId);
  post.pendingTagUserIds = (post.pendingTagUserIds || []).filter((uid) => uid !== userId);
  saveDb(db);
  return res.json({ post });
});

app.post('/api/posts/:id/wall-decision', (req, res) => {
  const { id } = req.params;
  const { userId, decision } = req.body || {};
  const db = getDb();
  const post = db.posts.find((p) => p.id === id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.targetProfileId !== userId) {
    return res.status(403).json({ error: 'Only the MySpace owner can manage wall posts.' });
  }
  if (decision === 'approve') {
    post.wallApproved = true;
    saveDb(db);
    return res.json({ ok: true, post });
  }
  db.posts = db.posts.filter((p) => p.id !== id);
  saveDb(db);
  return res.json({ ok: true });
});

// =========================================================================
// FRAMES (ALBUMS) & IMAGES (PHOTOS)
// =========================================================================
app.post('/api/albums', (req, res) => {
  const { ownerId, name, description, privacy } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Frame name is required.' });
  const safe = checkSafeContent(`${name} ${description || ''}`);
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const db = getDb();
  const album: AlbumItem = {
    id: `alb-${Date.now()}`,
    ownerId: String(ownerId),
    name: String(name).trim(),
    description: String(description || '').trim(),
    privacy: privacy || 'public',
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  db.albums.unshift(album);
  saveDb(db);
  return res.status(201).json({ album });
});

app.patch('/api/albums/:id', (req, res) => {
  const { id } = req.params;
  const { userId, name, description, privacy, coverPhotoId, coverSrc } = req.body || {};
  const db = getDb();
  const album = db.albums.find((a) => a.id === id);
  if (!album) return res.status(404).json({ error: 'Frame not found.' });
  if (album.ownerId !== userId) return res.status(403).json({ error: 'Forbidden.' });

  if (name !== undefined) album.name = String(name).trim() || album.name;
  if (description !== undefined) album.description = String(description).trim();
  if (privacy !== undefined) album.privacy = privacy;
  if (coverPhotoId !== undefined) album.coverPhotoId = coverPhotoId;
  if (coverSrc !== undefined) album.coverSrc = coverSrc;
  album.updatedAt = new Date().toISOString().slice(0, 10);
  saveDb(db);
  return res.json({ album });
});

app.delete('/api/albums/:id', (req, res) => {
  const { id } = req.params;
  const userId = String(req.query.userId || '');
  const deleteMedia = req.query.deleteMedia === 'true';
  const db = getDb();
  const album = db.albums.find((a) => a.id === id);
  if (!album) return res.status(404).json({ error: 'Frame not found.' });
  if (album.ownerId !== userId) return res.status(403).json({ error: 'Forbidden.' });

  if (deleteMedia) {
    db.photos = db.photos.filter((p) => p.albumId !== id);
  } else {
    db.photos.forEach((p) => {
      if (p.albumId === id) {
        p.albumId = undefined;
        p.album = 'Unfiled Images';
      }
    });
  }
  db.albums = db.albums.filter((a) => a.id !== id);
  saveDb(db);
  return res.json({ ok: true });
});

app.post('/api/photos', (req, res) => {
  const { ownerId, albumId, privacy, location, items } = req.body || {};
  const db = getDb();
  const owner = db.users.find((u) => u.id === ownerId);
  if (!owner) return res.status(404).json({ error: 'User not found.' });

  const album = albumId ? db.albums.find((a) => a.id === albumId) : undefined;
  const created: PhotoItem[] = [];

  for (const item of Array.isArray(items) ? items : []) {
    const safe = checkSafeContent(String(item.caption || ''));
    if (!safe.ok) return res.status(400).json({ error: safe.reason });

    const photo: PhotoItem = {
      id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      ownerId: String(ownerId),
      albumId: album?.id,
      mediaType: item.mediaType || 'image',
      videoFormat: item.videoFormat,
      src: String(item.src),
      caption: String(item.caption || '').trim() || 'Shared on Sphere.',
      location: String(location || owner.location),
      album: album?.name || 'Images',
      createdAt: 'Just now',
      likes: [],
      reactions: {},
      comments: [],
      privacy: privacy || album?.privacy || 'public',
    };
    db.photos.unshift(photo);
    created.push(photo);
    if (album && !album.coverSrc && photo.mediaType === 'image') {
      album.coverPhotoId = photo.id;
      album.coverSrc = photo.src;
    }
  }
  owner.photoCount += created.length;
  saveDb(db);
  return res.status(201).json({ photos: created });
});

app.patch('/api/photos/:id', (req, res) => {
  const { id } = req.params;
  const { userId, caption, albumId, privacy } = req.body || {};
  const db = getDb();
  const photo = db.photos.find((p) => p.id === id);
  if (!photo) return res.status(404).json({ error: 'Image not found.' });
  if (photo.ownerId !== userId) return res.status(403).json({ error: 'Forbidden.' });

  if (caption !== undefined) {
    const safe = checkSafeContent(String(caption));
    if (!safe.ok) return res.status(400).json({ error: safe.reason });
    photo.caption = String(caption).trim();
  }
  if (albumId !== undefined) {
    photo.albumId = albumId || undefined;
    const alb = db.albums.find((a) => a.id === albumId);
    photo.album = alb ? alb.name : 'Unfiled Images';
  }
  if (privacy !== undefined) photo.privacy = privacy;
  saveDb(db);
  return res.json({ photo });
});

app.delete('/api/photos/:id', (req, res) => {
  const { id } = req.params;
  const userId = String(req.query.userId || '');
  const db = getDb();
  const photo = db.photos.find((p) => p.id === id);
  if (!photo) return res.status(404).json({ error: 'Image not found.' });
  if (photo.ownerId !== userId) return res.status(403).json({ error: 'Forbidden.' });
  db.photos = db.photos.filter((p) => p.id !== id);
  saveDb(db);
  return res.json({ ok: true });
});

app.post('/api/photos/:id/react', (req, res) => {
  const { id } = req.params;
  const { userId, reactionType } = req.body || {};
  const db = getDb();
  const photo = db.photos.find((p) => p.id === id);
  if (!photo) return res.status(404).json({ error: 'Image not found.' });

  const outcome = applyReactionRules({
    userId: String(userId),
    reactionType: reactionType as ReactionType,
    reactions: photo.reactions,
    tracker: photo.reactionTracker,
    likes: photo.likes,
  });
  if (!outcome.ok) {
    return res.status(429).json({ error: outcome.error, switchesRemaining: outcome.switchesRemaining });
  }
  photo.reactions = outcome.reactions;
  photo.reactionTracker = outcome.tracker;
  photo.likes = outcome.likes;
  saveDb(db);
  return res.json({ photo, switchesRemaining: outcome.switchesRemaining });
});

app.post('/api/photos/:id/comments', (req, res) => {
  const { id } = req.params;
  const { authorId, text } = req.body || {};
  const cleanText = String(text || '').trim();
  if (!cleanText) return res.status(400).json({ error: 'Comment required.' });
  const safe = checkSafeContent(cleanText);
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const now = Date.now();
  if (now - (lastCommentAtByUser.get(String(authorId)) || 0) < COMMENT_COOLDOWN_MS) {
    return res.status(429).json({ error: 'Please wait a moment before commenting again.' });
  }
  lastCommentAtByUser.set(String(authorId), now);

  const db = getDb();
  const photo = db.photos.find((p) => p.id === id);
  if (!photo) return res.status(404).json({ error: 'Image not found.' });

  photo.comments.push({
    id: `pc-${Date.now()}`,
    authorId: String(authorId),
    text: cleanText,
    createdAt: 'Just now',
    likes: 0,
    reactions: {},
    reactionTracker: { userReactions: {}, switchCounts: {} },
  });
  saveDb(db);
  return res.status(201).json({ photo });
});

// =========================================================================
// SHELVES (MARKETPLACE) WITH REACTION/COMMENT TOGGLE
// =========================================================================
app.post('/api/marketplace', (req, res) => {
  const {
    sellerId,
    title,
    price,
    category,
    condition,
    location,
    description,
    imageSrc,
    privacy,
    allowCommentsAndReactions,
    crossPostToFeed,
  } = req.body || {};

  const safe = checkSafeContent(`${title || ''} ${description || ''}`);
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const db = getDb();
  const seller = db.users.find((u) => u.id === sellerId);
  if (!seller) return res.status(404).json({ error: 'Seller not found.' });

  const item: MarketplaceItem = {
    id: `mkt-${Date.now()}`,
    sellerId: String(sellerId),
    title: String(title || '').trim(),
    price: Number(price || 0),
    currency: 'PHP',
    category: String(category || 'General'),
    condition: condition || 'Brand New',
    location: String(location || seller.location),
    description: String(description || '').trim(),
    imageSrc: imageSrc || undefined,
    createdAt: 'Just now',
    privacy: privacy || 'public',
    sold: false,
    allowCommentsAndReactions: Boolean(allowCommentsAndReactions),
    reactions: {},
    reactionTracker: { userReactions: {}, switchCounts: {} },
    comments: [],
  };

  db.marketplace.unshift(item);

  let post: SocialPost | undefined;
  if (crossPostToFeed) {
    post = {
      id: `post-${Date.now()}`,
      authorId: String(sellerId),
      content: `Listed on Sphere. Shelves: ${item.title} (₱${item.price.toLocaleString()}) — ${item.description}`,
      location: item.location,
      country: seller.country || 'Philippines',
      language: 'English',
      createdAt: 'Just now',
      likes: [],
      reactions: {},
      reactionTracker: { userReactions: {}, switchCounts: {} },
      comments: [],
      marketplaceItemId: item.id,
      sharesCount: 0,
      privacy: item.privacy,
    };
    db.posts.unshift(post);
  }

  saveDb(db);
  return res.status(201).json({ item, post });
});

app.post('/api/marketplace/:id/toggle-sold', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body || {};
  const db = getDb();
  const item = db.marketplace.find((m) => m.id === id);
  if (!item) return res.status(404).json({ error: 'Listing not found.' });
  if (item.sellerId !== userId) return res.status(403).json({ error: 'Only the seller can update this listing.' });
  item.sold = !item.sold;
  saveDb(db);
  return res.json({ item });
});

app.post('/api/marketplace/:id/react', (req, res) => {
  const { id } = req.params;
  const { userId, reactionType } = req.body || {};
  const db = getDb();
  const item = db.marketplace.find((m) => m.id === id);
  if (!item) return res.status(404).json({ error: 'Listing not found.' });
  if (item.allowCommentsAndReactions === false) {
    return res.status(403).json({ error: 'Reactions are disabled by the seller. Use Message Seller instead.' });
  }

  const outcome = applyReactionRules({
    userId: String(userId),
    reactionType: reactionType as ReactionType,
    reactions: item.reactions,
    tracker: item.reactionTracker,
  });
  if (!outcome.ok) {
    return res.status(429).json({ error: outcome.error, switchesRemaining: outcome.switchesRemaining });
  }
  item.reactions = outcome.reactions;
  item.reactionTracker = outcome.tracker;
  saveDb(db);
  return res.json({ item, switchesRemaining: outcome.switchesRemaining });
});

app.post('/api/marketplace/:id/comments', (req, res) => {
  const { id } = req.params;
  const { authorId, text } = req.body || {};
  const db = getDb();
  const item = db.marketplace.find((m) => m.id === id);
  if (!item) return res.status(404).json({ error: 'Listing not found.' });
  if (item.allowCommentsAndReactions === false) {
    return res.status(403).json({ error: 'Comments are disabled by the seller. Use Message Seller instead.' });
  }
  const cleanText = String(text || '').trim();
  if (!cleanText) return res.status(400).json({ error: 'Comment required.' });
  const safe = checkSafeContent(cleanText);
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  item.comments = item.comments || [];
  item.comments.push({
    id: `mc-${Date.now()}`,
    authorId: String(authorId),
    text: cleanText,
    createdAt: 'Just now',
    likes: 0,
    reactions: {},
    reactionTracker: { userReactions: {}, switchCounts: {} },
  });
  saveDb(db);
  return res.status(201).json({ item });
});

// =========================================================================
// PAGES, CIRCLES (GROUPS) & TESTIMONIALS
// =========================================================================
app.post('/api/pages', (req, res) => {
  const { ownerId, name, handle, category, location, description, rules, postingPolicy, guidelinesSummary } = req.body || {};
  const safe = checkSafeContent(`${name} ${description} ${postingPolicy || ''}`);
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const db = getDb();
  const cat = String(category || 'Community & Craft');
  const preset = getCategoryGuidelines(cat);
  const customRules = Array.isArray(rules)
    ? rules.map((r: unknown) => String(r).trim()).filter(Boolean).slice(0, 10)
    : [];

  const page: PageItem = {
    id: `page-${Date.now()}`,
    name: String(name || '').trim(),
    handle: `@${String(handle || name || '').replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9.]/g, '')}`,
    category: cat,
    description: String(description || '').trim(),
    location: String(location || 'Philippines'),
    ownerId: String(ownerId),
    accentColor: '#4F46E5',
    followerIds: [String(ownerId)],
    following: true,
    totalFollowers: 1,
    verified: false,
    sphereIdCategory: 'unverified',
    rules: customRules.length > 0 ? customRules : preset.rules,
    postingPolicy: String(postingPolicy || '').trim() || preset.postingPolicy,
    guidelinesSummary: String(guidelinesSummary || '').trim() || preset.guidelinesSummary,
  };
  db.pages.unshift(page);
  saveDb(db);
  return res.status(201).json({ page });
});

app.patch('/api/pages/:id/rules', (req, res) => {
  const { id } = req.params;
  const { userId, rules, postingPolicy, guidelinesSummary } = req.body || {};
  const db = getDb();
  const page = db.pages.find((p) => p.id === id);
  if (!page) return res.status(404).json({ error: 'Page not found.' });
  const actor = db.users.find((u) => u.id === userId);
  if (page.ownerId !== userId && actor?.role !== 'admin') {
    return res.status(403).json({ error: 'Only the Page owner can update Page rules and guidelines.' });
  }
  const safe = checkSafeContent(`${postingPolicy || ''} ${guidelinesSummary || ''} ${(Array.isArray(rules) ? rules : []).join(' ')}`);
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  if (Array.isArray(rules)) {
    const cleaned = rules.map((r: unknown) => String(r).trim()).filter(Boolean).slice(0, 10);
    if (cleaned.length > 0) page.rules = cleaned;
  }
  if (typeof postingPolicy === 'string' && postingPolicy.trim()) {
    page.postingPolicy = postingPolicy.trim().slice(0, 400);
  }
  if (typeof guidelinesSummary === 'string' && guidelinesSummary.trim()) {
    page.guidelinesSummary = guidelinesSummary.trim().slice(0, 1200);
  }
  saveDb(db);
  return res.json({ page });
});

app.post('/api/pages/:id/follow', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body || {};
  const db = getDb();
  const page = db.pages.find((p) => p.id === id);
  if (!page) return res.status(404).json({ error: 'Page not found.' });
  if (page.followerIds.includes(userId)) {
    page.followerIds = page.followerIds.filter((uid) => uid !== userId);
    page.totalFollowers = Math.max(0, page.totalFollowers - 1);
    page.following = false;
  } else {
    page.followerIds.push(userId);
    page.totalFollowers += 1;
    page.following = true;
  }
  saveDb(db);
  return res.json({ page });
});

app.post('/api/groups', (req, res) => {
  const { creatorId, name, category, location, description, privacy, rules, postingPolicy, guidelinesSummary } = req.body || {};
  const safe = checkSafeContent(`${name} ${description} ${postingPolicy || ''}`);
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const db = getDb();
  const cat = String(category || 'Community & Craft');
  const preset = getCategoryGuidelines(cat, true);
  const customRules = Array.isArray(rules)
    ? rules.map((r: unknown) => String(r).trim()).filter(Boolean).slice(0, 10)
    : [];

  const group: GroupItem = {
    id: `grp-${Date.now()}`,
    name: String(name || '').trim(),
    category: cat,
    description: String(description || '').trim(),
    location: String(location || 'Global'),
    privacy: privacy || 'public',
    creatorId: String(creatorId),
    accentColor: '#06B6D4',
    memberIds: [String(creatorId)],
    joined: true,
    totalMembers: 1,
    rules: customRules.length > 0 ? customRules : preset.rules,
    postingPolicy: String(postingPolicy || '').trim() || preset.postingPolicy,
    guidelinesSummary: String(guidelinesSummary || '').trim() || preset.guidelinesSummary,
  };
  db.groups.unshift(group);
  saveDb(db);
  return res.status(201).json({ group });
});

app.patch('/api/groups/:id/rules', (req, res) => {
  const { id } = req.params;
  const { userId, rules, postingPolicy, guidelinesSummary } = req.body || {};
  const db = getDb();
  const group = db.groups.find((g) => g.id === id);
  if (!group) return res.status(404).json({ error: 'Circle not found.' });
  const actor = db.users.find((u) => u.id === userId);
  if (group.creatorId !== userId && actor?.role !== 'admin') {
    return res.status(403).json({ error: 'Only the Circle creator can update Circle rules and guidelines.' });
  }
  const safe = checkSafeContent(`${postingPolicy || ''} ${guidelinesSummary || ''} ${(Array.isArray(rules) ? rules : []).join(' ')}`);
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  if (Array.isArray(rules)) {
    const cleaned = rules.map((r: unknown) => String(r).trim()).filter(Boolean).slice(0, 10);
    if (cleaned.length > 0) group.rules = cleaned;
  }
  if (typeof postingPolicy === 'string' && postingPolicy.trim()) {
    group.postingPolicy = postingPolicy.trim().slice(0, 400);
  }
  if (typeof guidelinesSummary === 'string' && guidelinesSummary.trim()) {
    group.guidelinesSummary = guidelinesSummary.trim().slice(0, 1200);
  }
  saveDb(db);
  return res.json({ group });
});

app.post('/api/groups/:id/join', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body || {};
  const db = getDb();
  const group = db.groups.find((g) => g.id === id);
  if (!group) return res.status(404).json({ error: 'Circle not found.' });
  if (group.memberIds.includes(userId)) {
    group.memberIds = group.memberIds.filter((uid) => uid !== userId);
    group.totalMembers = Math.max(0, group.totalMembers - 1);
    group.joined = false;
  } else {
    group.memberIds.push(userId);
    group.totalMembers += 1;
    group.joined = true;
  }
  saveDb(db);
  return res.json({ group });
});

app.post('/api/testimonials', (req, res) => {
  const { authorId, recipientId, quote } = req.body || {};
  const safe = checkSafeContent(String(quote || ''));
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const db = getDb();
  ensureUserInDb(db, String(recipientId));
  const testimonial = {
    id: `test-${Date.now()}`,
    authorId: String(authorId),
    recipientId: String(recipientId),
    quote: String(quote || '').trim(),
    createdAt: 'Just now',
  };
  db.testimonials.unshift(testimonial);
  saveDb(db);
  return res.status(201).json({ testimonial });
});

// =========================================================================
// MESSENGER THREADS & REAL-TIME WEBSOCKET RELAY
// =========================================================================
app.post('/api/messages/thread', (req, res) => {
  const { participantIds, title } = req.body || {};
  const ids: string[] = Array.from(new Set(Array.isArray(participantIds) ? participantIds : [])).sort();
  if (ids.length < 2) return res.status(400).json({ error: 'Need at least two participants.' });

  const db = getDb();
  for (const pid of ids) {
    ensureUserInDb(db, pid);
  }
  let existing = db.threads.find(
    (t) =>
      !t.isGroup &&
      t.participantIds.length === ids.length &&
      ids.every((id) => t.participantIds.includes(id))
  );
  if (!existing) {
    existing = {
      id: `thr-${Date.now()}`,
      participantIds: ids,
      title: title || undefined,
      unreadCount: 0,
      messages: [],
    };
    db.threads.unshift(existing);
    saveDb(db);
  }
  return res.json({ thread: existing });
});

app.post('/api/messages/group', (req, res) => {
  const {
    creatorId,
    title,
    participantIds,
    avatar,
    avatarColor,
    maxMembers,
    autoAddCount,
    autoAddCountry,
    autoAddCategory,
  } = req.body || {};

  const safeTitle = checkSafeContent(String(title || ''));
  if (!safeTitle.ok) return res.status(400).json({ error: safeTitle.reason });
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) return res.status(400).json({ error: 'Group name is required.' });

  const db = getDb();
  const creator = ensureUserInDb(db, String(creatorId || ''));
  if (!creator) return res.status(404).json({ error: 'Creator account not found.' });

  const capacity = Math.max(1000, Math.min(10000, Number(maxMembers) || 2000));
  const rawIds = Array.isArray(participantIds) ? participantIds.map(String) : [];
  const uniqueIds = new Set<string>([creator.id, ...rawIds]);

  const requestedBulk = Math.max(0, Math.min(capacity - uniqueIds.size, Number(autoAddCount) || 0));
  if (requestedBulk > 0) {
    const sampled = sampleGlobalMemberIds({
      count: requestedBulk,
      country: typeof autoAddCountry === 'string' ? autoAddCountry : 'All',
      category: (autoAddCategory as DiscoveryCategory | 'All') || 'All',
      excludeIds: uniqueIds,
    });
    for (const sid of sampled) uniqueIds.add(sid);
  }

  const finalIds = Array.from(uniqueIds).slice(0, capacity);
  const groupThread: MessageThread = {
    id: `grp-thr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    participantIds: finalIds,
    title: cleanTitle.slice(0, 80),
    isGroup: true,
    avatar: typeof avatar === 'string' && avatar.trim() ? avatar.trim() : undefined,
    avatarColor: typeof avatarColor === 'string' && avatarColor.trim() ? avatarColor.trim() : '#4F46E5',
    adminIds: [creator.id],
    maxMembers: capacity,
    unreadCount: 0,
    messages: [
      {
        id: `msg-${Date.now()}`,
        senderId: creator.id,
        text: `Created "${cleanTitle}" (${finalIds.length.toLocaleString()} members · Max capacity ${capacity.toLocaleString()}).`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: 'English',
        reactions: {},
        deliveredTo: [],
        readBy: [creator.id],
      },
    ],
  };

  db.threads.unshift(groupThread);
  saveDb(db);
  sendToUsers(finalIds, 'thread:updated', { thread: groupThread });
  return res.status(201).json({ thread: groupThread });
});

app.patch('/api/messages/:threadId/settings', (req, res) => {
  const { threadId } = req.params;
  const { userId, title, avatar, avatarColor } = req.body || {};
  const db = getDb();
  const thread = db.threads.find((t) => t.id === threadId);
  if (!thread) return res.status(404).json({ error: 'Group conversation not found.' });
  if (!thread.isGroup) {
    return res.status(400).json({ error: 'Settings can only be edited on group chats.' });
  }
  if (userId && !thread.participantIds.includes(String(userId))) {
    return res.status(403).json({ error: 'Only group members can update group settings.' });
  }

  if (typeof title === 'string' && title.trim()) {
    const safe = checkSafeContent(title.trim());
    if (!safe.ok) return res.status(400).json({ error: safe.reason });
    thread.title = title.trim().slice(0, 80);
  }
  if (avatar !== undefined) {
    thread.avatar = typeof avatar === 'string' && avatar.trim() ? avatar.trim() : undefined;
  }
  if (typeof avatarColor === 'string' && avatarColor.trim()) {
    thread.avatarColor = avatarColor.trim();
  }

  saveDb(db);
  sendToUsers(thread.participantIds, 'thread:updated', { thread });
  return res.json({ thread });
});

app.post('/api/messages/:threadId/members', (req, res) => {
  const { threadId } = req.params;
  const { memberIds, autoAddCount, autoAddCountry, autoAddCategory } = req.body || {};
  const db = getDb();
  const thread = db.threads.find((t) => t.id === threadId);
  if (!thread) return res.status(404).json({ error: 'Conversation not found.' });

  const capacity = Math.max(1000, thread.maxMembers || 2000);
  thread.maxMembers = capacity;
  thread.isGroup = true;
  const existingSet = new Set(thread.participantIds);

  if (Array.isArray(memberIds)) {
    for (const mid of memberIds) {
      if (existingSet.size >= capacity) break;
      existingSet.add(String(mid));
    }
  }

  const bulk = Math.max(0, Math.min(capacity - existingSet.size, Number(autoAddCount) || 0));
  if (bulk > 0) {
    const sampled = sampleGlobalMemberIds({
      count: bulk,
      country: typeof autoAddCountry === 'string' ? autoAddCountry : 'All',
      category: (autoAddCategory as DiscoveryCategory | 'All') || 'All',
      excludeIds: existingSet,
    });
    for (const sid of sampled) existingSet.add(sid);
  }

  thread.participantIds = Array.from(existingSet);
  saveDb(db);
  sendToUsers(thread.participantIds, 'thread:updated', { thread });
  return res.json({ thread });
});

app.get('/api/messages/:threadId/members', (req, res) => {
  const { threadId } = req.params;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 40));
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const db = getDb();
  const thread = db.threads.find((t) => t.id === threadId);
  if (!thread) return res.status(404).json({ error: 'Conversation not found.' });

  const userMap = new Map(db.users.map((u) => [u.id, u]));
  const onlineSet = new Set(getOnlineUserIds());
  const resolved: Array<{
    id: string;
    name: string;
    handle: string;
    location: string;
    avatar?: string;
    avatarColor: string;
    online: boolean;
    isAdmin: boolean;
  }> = [];

  for (const pid of thread.participantIds) {
    const profile = userMap.get(pid) || getVirtualUserById(pid);
    if (!profile) continue;
    if (
      q &&
      !profile.name.toLowerCase().includes(q) &&
      !profile.handle.toLowerCase().includes(q) &&
      !profile.location.toLowerCase().includes(q)
    ) {
      continue;
    }
    resolved.push({
      id: profile.id,
      name: profile.name,
      handle: profile.handle,
      location: profile.location,
      avatar: profile.avatar,
      avatarColor: profile.avatarColor,
      online: onlineSet.has(profile.id),
      isAdmin: (thread.adminIds || []).includes(profile.id),
    });
  }

  const start = (page - 1) * limit;
  return res.json({
    totalMembers: thread.participantIds.length,
    matchedCount: resolved.length,
    maxMembers: Math.max(1000, thread.maxMembers || 2000),
    page,
    limit,
    members: resolved.slice(start, start + limit),
  });
});

app.post('/api/messages/:threadId/send', (req, res) => {
  const { threadId } = req.params;
  const { senderId, text, sharedPostId, attachments } = req.body || {};
  const safe = checkSafeContent(String(text || ''));
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const db = getDb();
  const thread = db.threads.find((t) => t.id === threadId);
  const sender = db.users.find((u) => u.id === senderId);
  if (!thread || !sender) return res.status(404).json({ error: 'Conversation not found.' });

  const online = new Set(getOnlineUserIds());
  const deliveredTo = thread.participantIds.filter((id) => id !== senderId && online.has(id));

  const message = {
    id: `msg-${Date.now()}`,
    senderId: String(senderId),
    text: String(text || '').trim(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    sharedPostId: sharedPostId || undefined,
    language: sender.language?.split('&')[0]?.trim() || 'English',
    attachments: Array.isArray(attachments) ? attachments : undefined,
    reactions: {},
    deliveredTo,
    readBy: [],
  };

  thread.messages.push(message);
  thread.unreadCount += 1;
  saveDb(db);

  sendToUsers(thread.participantIds, 'message:new', {
    threadId: thread.id,
    senderId: message.senderId,
    message,
  });
  return res.status(201).json({ thread });
});

app.post('/api/messages/:threadId/read', (req, res) => {
  const { threadId } = req.params;
  const { userId } = req.body || {};
  const db = getDb();
  const thread = db.threads.find((t) => t.id === threadId);
  if (!thread) return res.status(404).json({ error: 'Conversation not found.' });

  thread.unreadCount = 0;
  for (const m of thread.messages) {
    if (m.senderId !== userId) {
      m.readBy = Array.from(new Set([...(m.readBy || []), String(userId)]));
      m.deliveredTo = Array.from(new Set([...(m.deliveredTo || []), String(userId)]));
    }
  }
  saveDb(db);
  sendToUsers(thread.participantIds, 'message:read', { threadId, userId, thread });
  return res.json({ thread });
});

app.post('/api/messages/:threadId/react', (req, res) => {
  const { threadId } = req.params;
  const { messageId, userId, emoji } = req.body || {};
  const db = getDb();
  const thread = db.threads.find((t) => t.id === threadId);
  if (!thread) return res.status(404).json({ error: 'Conversation not found.' });
  const msg = thread.messages.find((m) => m.id === messageId);
  if (!msg) return res.status(404).json({ error: 'Message not found.' });

  msg.reactions = msg.reactions || {};
  if (msg.reactions[userId] === emoji) {
    delete msg.reactions[userId];
  } else {
    msg.reactions[userId] = String(emoji);
  }
  saveDb(db);
  sendToUsers(thread.participantIds, 'message:react', { threadId, thread });
  return res.json({ thread });
});

// =========================================================================
// ANIMATED GIF SEARCH & RENDERER (/api/gifs/*)
// =========================================================================
interface CuratedGifSpec {
  id: string;
  slug: string;
  title: string;
  category: string;
  tags: string[];
  bg1: string;
  bg2: string;
  accent: string;
  emoji: string;
  caption: string;
  motion: 'bounce' | 'pulse' | 'spin' | 'wave';
}

const CURATED_GIFS: CuratedGifSpec[] = [
  { id: 'gif-party', slug: 'party', title: 'Party Time Confetti', category: 'Celebration', tags: ['party', 'celebrate', 'congrats', 'happy', 'fiesta'], bg1: '#4F46E5', bg2: '#EC4899', accent: '#FACC15', emoji: '🎉', caption: 'LET’S GO!', motion: 'bounce' },
  { id: 'gif-fire', slug: 'fire', title: 'On Fire Lit', category: 'Reactions', tags: ['fire', 'lit', 'hot', 'awesome', 'solid'], bg1: '#EA580C', bg2: '#DC2626', accent: '#FDE047', emoji: '🔥', caption: 'SO SOLID!', motion: 'pulse' },
  { id: 'gif-heart', slug: 'heart', title: 'Sending Big Love', category: 'Reactions', tags: ['love', 'heart', 'hug', 'sweet', 'mahal'], bg1: '#DB2777', bg2: '#9333EA', accent: '#FDA4AF', emoji: '💖', caption: 'BIG LOVE', motion: 'pulse' },
  { id: 'gif-laugh', slug: 'laugh', title: 'Crying Laughing', category: 'Reactions', tags: ['laugh', 'lol', 'haha', 'funny', 'tawa'], bg1: '#D97706', bg2: '#F59E0B', accent: '#FEF08A', emoji: '😂', caption: 'HAHAHA!', motion: 'bounce' },
  { id: 'gif-clap', slug: 'clap', title: 'Round of Applause', category: 'Celebration', tags: ['clap', 'applause', 'bravo', 'galing', 'cheers'], bg1: '#0D9488', bg2: '#0284C7', accent: '#99F6E4', emoji: '👏', caption: 'GALING!', motion: 'wave' },
  { id: 'gif-cool', slug: 'cool', title: 'Cool Shades Vibe', category: 'Reactions', tags: ['cool', 'chill', 'sunglasses', 'deal', 'pogi'], bg1: '#1E293B', bg2: '#4F46E5', accent: '#22D3EE', emoji: '😎', caption: 'CHILL VIBES', motion: 'wave' },
  { id: 'gif-rocket', slug: 'rocket', title: 'Launch To The Moon', category: 'Tech & Gaming', tags: ['rocket', 'launch', 'ship', 'moon', 'deploy'], bg1: '#0F172A', bg2: '#0369A1', accent: '#38BDF8', emoji: '🚀', caption: 'SHIP IT!', motion: 'bounce' },
  { id: 'gif-gg', slug: 'gg', title: 'GGWP Victory', category: 'Tech & Gaming', tags: ['gg', 'gaming', 'win', 'trophy', 'clutch'], bg1: '#4338CA', bg2: '#06B6D4', accent: '#FDE047', emoji: '🏆', caption: 'GGWP!', motion: 'pulse' },
  { id: 'gif-coffee', slug: 'coffee', title: 'Tara Kape Break', category: 'Pinoy Vibes', tags: ['coffee', 'kape', 'morning', 'tara', 'cafe'], bg1: '#78350F', bg2: '#B45309', accent: '#FDE68A', emoji: '☕', caption: 'TARA KAPE!', motion: 'wave' },
  { id: 'gif-wave', slug: 'wave', title: 'Hello Friend Wave', category: 'Pinoy Vibes', tags: ['hello', 'hi', 'wave', 'kumusta', 'hey'], bg1: '#0891B2', bg2: '#4F46E5', accent: '#A5F3FC', emoji: '👋', caption: 'KUMUSTA!', motion: 'wave' },
  { id: 'gif-mindblown', slug: 'mindblown', title: 'Mind Blown Shock', category: 'Reactions', tags: ['mind', 'blown', 'wow', 'shock', 'grabe'], bg1: '#7C3AED', bg2: '#F43F5E', accent: '#FDE047', emoji: '🤯', caption: 'MIND BLOWN!', motion: 'pulse' },
  { id: 'gif-thumbsup', slug: 'thumbsup', title: '100% Approved', category: 'Reactions', tags: ['ok', 'yes', 'thumbs', 'approve', 'good'], bg1: '#059669', bg2: '#10B981', accent: '#D1FAE5', emoji: '👍', caption: 'APPROVED!', motion: 'bounce' },
  { id: 'gif-music', slug: 'music', title: 'Vibe Check Beats', category: 'Trending', tags: ['music', 'dance', 'beats', 'jam', 'tugtog'], bg1: '#6D28D9', bg2: '#06B6D4', accent: '#F472B6', emoji: '🎧', caption: 'VIBE CHECK', motion: 'pulse' },
  { id: 'gif-moto', slug: 'moto', title: 'Full Throttle Ride', category: 'Pinoy Vibes', tags: ['moto', 'ride', 'motorcycle', 'ridesafe', 'bike'], bg1: '#1E293B', bg2: '#B91C1C', accent: '#22D3EE', emoji: '🏍️', caption: 'RIDE SAFE!', motion: 'bounce' },
  { id: 'gif-code', slug: 'code', title: 'Coding In Flow', category: 'Tech & Gaming', tags: ['code', 'dev', 'computer', 'pc', 'build'], bg1: '#090D16', bg2: '#1E3A8A', accent: '#34D399', emoji: '💻', caption: 'IN THE ZONE', motion: 'wave' },
  { id: 'gif-sparkle', slug: 'sparkle', title: 'Labo Sparkle Star', category: 'Trending', tags: ['star', 'sparkle', 'magic', 'shine', 'art'], bg1: '#312E81', bg2: '#7E22CE', accent: '#FDE047', emoji: '✨', caption: 'ICONIC!', motion: 'spin' },
];

app.get('/api/gifs/render/:slug', (req, res) => {
  const cleanSlug = req.params.slug.replace(/\.svg$/i, '');
  const spec = CURATED_GIFS.find((g) => g.slug === cleanSlug) || CURATED_GIFS[0];
  const anim =
    spec.motion === 'bounce'
      ? `<animateTransform attributeName="transform" type="translate" values="0 4; 0 -10; 0 4" dur="0.9s" repeatCount="indefinite" />`
      : spec.motion === 'pulse'
        ? `<animateTransform attributeName="transform" type="scale" values="1; 1.18; 1" dur="0.85s" repeatCount="indefinite" additive="sum" />`
        : spec.motion === 'spin'
          ? `<animateTransform attributeName="transform" type="rotate" values="-12; 12; -12" dur="1.2s" repeatCount="indefinite" />`
          : `<animateTransform attributeName="transform" type="rotate" values="-14; 14; -14" dur="0.7s" repeatCount="indefinite" />`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${spec.bg1}" />
      <stop offset="100%" stop-color="${spec.bg2}" />
    </linearGradient>
  </defs>
  <rect width="320" height="200" rx="20" fill="url(#bg)" />
  <circle cx="48" cy="40" r="22" fill="${spec.accent}" opacity="0.18">
    <animate attributeName="r" values="16;28;16" dur="2.1s" repeatCount="indefinite" />
  </circle>
  <circle cx="272" cy="155" r="26" fill="${spec.accent}" opacity="0.18">
    <animate attributeName="r" values="20;34;20" dur="1.7s" repeatCount="indefinite" />
  </circle>
  <circle cx="268" cy="42" r="7" fill="#fff" opacity="0.5">
    <animate attributeName="opacity" values="0.2;0.9;0.2" dur="1.2s" repeatCount="indefinite" />
  </circle>
  <rect x="14" y="14" width="38" height="20" rx="10" fill="rgba(15,23,42,0.55)" />
  <text x="33" y="28" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" font-weight="800" fill="#fff">GIF</text>
  <g transform="translate(160, 92)">
    <g>
      ${anim}
      <text x="0" y="14" text-anchor="middle" font-size="68">${spec.emoji}</text>
    </g>
  </g>
  <text x="160" y="172" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="900" letter-spacing="1.5" fill="#fff">
    ${spec.caption}
    <animate attributeName="opacity" values="0.85;1;0.85" dur="1.1s" repeatCount="indefinite" />
  </text>
</svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(svg);
});

app.get('/api/gifs/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : 'All';

  // Optional live GIPHY search when GIPHY_API_KEY is configured in environment
  const giphyKey = process.env.GIPHY_API_KEY?.trim();
  const externalResults: Array<{ id: string; title: string; url: string; previewUrl: string; category: string }> = [];
  if (giphyKey) {
    try {
      const endpoint = q
        ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(giphyKey)}&q=${encodeURIComponent(q)}&limit=12&rating=pg`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(giphyKey)}&limit=12&rating=pg`;
      const resp = await fetch(endpoint);
      if (resp.ok) {
        const json = (await resp.json()) as {
          data?: Array<{
            id: string;
            title?: string;
            images?: { fixed_height?: { url?: string }; fixed_height_small?: { url?: string } };
          }>;
        };
        for (const item of json.data || []) {
          const url = item.images?.fixed_height?.url;
          if (!url) continue;
          externalResults.push({
            id: `giphy-${item.id}`,
            title: item.title || 'GIF',
            url,
            previewUrl: item.images?.fixed_height_small?.url || url,
            category: 'Trending',
          });
        }
      }
    } catch {
      // Fall back cleanly to built-in animated GIF catalog
    }
  }

  const localFiltered = CURATED_GIFS.filter((g) => {
    if (category && category !== 'All' && category !== 'Trending' && g.category !== category) {
      return false;
    }
    if (!q) return true;
    return (
      g.title.toLowerCase().includes(q) ||
      g.caption.toLowerCase().includes(q) ||
      g.category.toLowerCase().includes(q) ||
      g.tags.some((t) => t.includes(q))
    );
  }).map((g) => ({
    id: g.id,
    title: g.title,
    url: `/api/gifs/render/${g.slug}.svg`,
    previewUrl: `/api/gifs/render/${g.slug}.svg`,
    category: g.category,
  }));

  return res.json({
    items: [...externalResults, ...localFiltered],
    categories: ['All', 'Trending', 'Reactions', 'Celebration', 'Tech & Gaming', 'Pinoy Vibes'],
  });
});

// =========================================================================
// ON LIVE (LIVESTREAMING)
// =========================================================================
app.post('/api/livestreams/start', (req, res) => {
  const { authorId, title, privacy, location } = req.body || {};
  const safe = checkSafeContent(String(title || ''));
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const db = getDb();
  const author = db.users.find((u) => u.id === authorId);
  if (!author) return res.status(404).json({ error: 'Broadcaster not found.' });

  const streamId = `live-${Date.now()}`;
  const post: SocialPost = {
    id: `post-${streamId}`,
    authorId: String(authorId),
    content: `On Live now: ${String(title || 'Live Sphere Broadcast')}`,
    location: location || author.location,
    country: author.country || 'Philippines',
    language: 'English',
    createdAt: 'Live now',
    likes: [],
    reactions: {},
    reactionTracker: { userReactions: {}, switchCounts: {} },
    comments: [],
    sharesCount: 0,
    privacy: privacy || 'public',
    liveStream: {
      id: streamId,
      title: String(title || 'Live Sphere Broadcast').trim(),
      isLive: true,
      viewerCount: Math.max(1, getOnlineUserIds().length),
      durationLabel: '00:00',
      coverImage: author.coverImage,
      chatMessages: [],
    },
  };
  db.posts.unshift(post);
  saveDb(db);
  broadcastEvent('post:new', post);
  return res.status(201).json({ post });
});

app.post('/api/livestreams/:streamId/chat', (req, res) => {
  const { streamId } = req.params;
  const { authorId, text } = req.body || {};
  const safe = checkSafeContent(String(text || ''));
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const db = getDb();
  const post = db.posts.find((p) => p.liveStream?.id === streamId);
  if (!post || !post.liveStream) return res.status(404).json({ error: 'Livestream not found.' });

  const chatMessage = {
    id: `lc-${Date.now()}`,
    authorId: String(authorId),
    text: String(text || '').trim(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
  post.liveStream.chatMessages.push(chatMessage);
  saveDb(db);
  broadcastEvent('livestream:chat', { streamId, chatMessage, post });
  return res.status(201).json({ chatMessage, post });
});

app.post('/api/livestreams/:streamId/end', (req, res) => {
  const { streamId } = req.params;
  const { authorId, durationLabel } = req.body || {};
  const db = getDb();
  const post = db.posts.find((p) => p.liveStream?.id === streamId);
  if (!post || !post.liveStream) return res.status(404).json({ error: 'Livestream not found.' });
  if (post.authorId !== authorId) return res.status(403).json({ error: 'Only the broadcaster can end the stream.' });

  post.liveStream.isLive = false;
  post.liveStream.durationLabel = String(durationLabel || '01:00');
  post.createdAt = 'Stream Replay';
  saveDb(db);
  broadcastEvent('post:updated', post);
  return res.json({ post });
});

// =========================================================================
// PAID ADVERTISING / PROMOTED POSTS (ADMIN MODERATION + REAL TRACKING)
// =========================================================================
app.post('/api/ads', (req, res) => {
  const {
    advertiserId,
    postId,
    title,
    objective,
    destinationUrl,
    targetCountries,
    targetLocations,
    targetInterests,
    targetAgeMin,
    targetAgeMax,
    dailyBudgetPhp,
    durationDays,
  } = req.body || {};

  const safe = checkSafeContent(`${title || ''}`);
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const db = getDb();
  const post = db.posts.find((p) => p.id === postId);
  if (!post) return res.status(404).json({ error: 'Selected post not found.' });
  if (post.authorId !== advertiserId) {
    return res.status(403).json({ error: 'You can only boost your own posts.' });
  }

  const budget = Math.max(100, Number(dailyBudgetPhp || 200));
  const days = Math.max(1, Math.min(30, Number(durationDays || 7)));
  const estMin = Math.round(budget * days * 0.55);
  const estMax = Math.round(budget * days * 1.35);

  const campaign: AdCampaign = {
    id: `ad-${Date.now()}`,
    advertiserId: String(advertiserId),
    postId: String(postId),
    title: String(title || 'Promoted Sphere Post').trim(),
    objective: (objective as AdObjective) || 'reach',
    destinationUrl: destinationUrl ? String(destinationUrl).trim() : undefined,
    targetCountries: Array.isArray(targetCountries) ? targetCountries : ['Philippines'],
    targetLocations: Array.isArray(targetLocations) ? targetLocations : [],
    targetInterests: Array.isArray(targetInterests) ? targetInterests : [],
    targetAgeMin: Math.max(18, Number(targetAgeMin || 18)),
    targetAgeMax: Math.min(85, Number(targetAgeMax || 65)),
    dailyBudgetPhp: budget,
    durationDays: days,
    estimatedReachMin: estMin,
    estimatedReachMax: estMax,
    status: 'pending_review',
    billingStatus: 'awaiting_payment_setup',
    impressions: 0,
    uniqueViewerIds: [],
    clicks: 0,
    engagements: 0,
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
  };

  db.adCampaigns.unshift(campaign);
  saveDb(db);
  return res.status(201).json({ campaign });
});

app.post('/api/ads/:id/moderate', (req, res) => {
  const { id } = req.params;
  const { reviewerId, status, moderationNote } = req.body || {};
  const db = getDb();
  const reviewer = db.users.find((u) => u.id === reviewerId);
  if (!reviewer || reviewer.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required to moderate ad campaigns.' });
  }
  const campaign = db.adCampaigns.find((a) => a.id === id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });

  campaign.status = status as AdStatus;
  campaign.moderationNote = moderationNote ? String(moderationNote) : undefined;
  campaign.updatedAt = new Date().toISOString().slice(0, 10);

  addNotification(db, {
    recipientId: campaign.advertiserId,
    actorId: reviewerId,
    type: 'ad_status',
    text: `Your ad campaign "${campaign.title}" was marked as ${status}.`,
  });

  saveDb(db);
  return res.json({ campaign });
});

app.post('/api/ads/:id/track', (req, res) => {
  const { id } = req.params;
  const { viewerId, event } = req.body || {};
  const db = getDb();
  const campaign = db.adCampaigns.find((a) => a.id === id);
  if (!campaign || campaign.status !== 'approved') {
    return res.status(404).json({ error: 'Active campaign not found.' });
  }
  if (event === 'impression') {
    campaign.impressions += 1;
    if (viewerId && !campaign.uniqueViewerIds.includes(viewerId)) {
      campaign.uniqueViewerIds.push(String(viewerId));
    }
  } else if (event === 'click') {
    campaign.clicks += 1;
  } else if (event === 'engagement') {
    campaign.engagements += 1;
  }
  saveDb(db);
  return res.json({ campaign });
});

// =========================================================================
// VERIFIED GOVERNMENT-REGISTERED AID DRIVES (DONATIONS)
// =========================================================================
app.post('/api/donations', (req, res) => {
  const { organizerId, title, description, location, category, goalAmountPhp } = req.body || {};
  const db = getDb();
  const organizer = db.users.find((u) => u.id === organizerId);
  if (!organizer) return res.status(404).json({ error: 'Organizer not found.' });

  if (organizer.sphereIdCategory !== 'verified_organization' || !organizer.govRegNumber) {
    return res.status(403).json({
      error:
        'Only Sphere ID Verified Government-Registered Organizations (with verified agency & registration number) can launch Aid Drives.',
    });
  }

  const safe = checkSafeContent(`${title} ${description}`);
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const drive: DonationDrive = {
    id: `drive-${Date.now()}`,
    organizerId: organizer.id,
    organizerName: organizer.name,
    govAgency: organizer.govAgency || 'Registered Government Agency',
    govRegNumber: organizer.govRegNumber,
    title: String(title || '').trim(),
    description: String(description || '').trim(),
    location: String(location || organizer.location),
    category: category || 'Disaster Relief',
    goalAmountPhp: Math.max(1000, Number(goalAmountPhp || 10000)),
    raisedAmountPhp: 0,
    verifiedGov: true,
    status: 'active',
    pledges: [],
    createdAt: new Date().toISOString().slice(0, 10),
  };

  db.donationDrives.unshift(drive);
  saveDb(db);
  broadcastEvent('donation:created', drive);
  return res.status(201).json({ drive });
});

app.post('/api/donations/:driveId/pledge', (req, res) => {
  const { driveId } = req.params;
  const { donorId, amountPhp, note } = req.body || {};
  const db = getDb();
  const drive = db.donationDrives.find((d) => d.id === driveId);
  const donor = db.users.find((u) => u.id === donorId);
  if (!drive || !donor) return res.status(404).json({ error: 'Aid Drive or user not found.' });

  const amount = Math.max(50, Number(amountPhp || 100));
  const safe = checkSafeContent(String(note || ''));
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  drive.pledges.unshift({
    id: `plg-${Date.now()}`,
    donorId: donor.id,
    donorName: donor.name,
    amountPhp: amount,
    note: String(note || 'Supporting this drive').trim(),
    createdAt: 'Just now',
  });
  drive.raisedAmountPhp += amount;

  addNotification(db, {
    recipientId: drive.organizerId,
    actorId: donor.id,
    type: 'donation',
    text: `${donor.name} pledged ₱${amount.toLocaleString()} to "${drive.title}".`,
  });

  saveDb(db);
  broadcastEvent('donation:updated', drive);
  return res.status(201).json({ drive });
});

// =========================================================================
// SPHERE ID VERIFICATION & ANONYMOUS SAFE TOPICS
// =========================================================================
app.post('/api/verification-requests', (req, res) => {
  const {
    applicantUserId,
    category,
    entityName,
    country,
    publicLink,
    govAgency,
    govRegNumber,
    notes,
    documentSummary,
  } = req.body || {};

  if (category === 'verified_organization' && (!govAgency?.trim() || !govRegNumber?.trim())) {
    return res.status(400).json({
      error: 'Government registering agency and registration number are required for Verified Organizations.',
    });
  }

  const db = getDb();
  const applicant = db.users.find((u) => u.id === applicantUserId);
  if (!applicant) return res.status(404).json({ error: 'Applicant not found.' });

  const request: SphereIdVerificationRequest = {
    id: `ver-${Date.now()}`,
    applicantUserId: applicant.id,
    applicantName: applicant.name,
    category,
    entityName: String(entityName || applicant.name).trim(),
    country: String(country || applicant.country || 'Philippines'),
    publicLink: String(publicLink || '').trim(),
    govAgency: govAgency ? String(govAgency).trim() : undefined,
    govRegNumber: govRegNumber ? String(govRegNumber).trim() : undefined,
    notes: String(notes || '').trim(),
    documentSummary,
    status: 'pending',
    submittedAt: new Date().toISOString().slice(0, 10),
  };

  db.verificationRequests.unshift(request);
  saveDb(db);
  return res.status(201).json({ request });
});

app.post('/api/verification-requests/:id/review', (req, res) => {
  const { id } = req.params;
  const { reviewerId, decision, reviewNote } = req.body || {};
  const db = getDb();
  const reviewer = db.users.find((u) => u.id === reviewerId);
  if (!reviewer || reviewer.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required.' });
  }
  const request = db.verificationRequests.find((r) => r.id === id);
  if (!request) return res.status(404).json({ error: 'Verification request not found.' });

  request.status = decision;
  request.reviewedAt = new Date().toISOString().slice(0, 10);
  request.reviewNote = String(reviewNote || '');

  const applicant = db.users.find((u) => u.id === request.applicantUserId);
  if (applicant && decision === 'approved') {
    applicant.sphereIdCategory = request.category;
    applicant.verified = true;
    if (request.govAgency) applicant.govAgency = request.govAgency;
    if (request.govRegNumber) applicant.govRegNumber = request.govRegNumber;
  }
  saveDb(db);
  return res.json({
    request,
    user: applicant ? sanitizeUser(applicant, applicant.id, db) : undefined,
  });
});

app.post('/api/anonymous', (req, res) => {
  const { authorId, topic, title, content } = req.body || {};
  const safe = checkSafeContent(`${title} ${content}`);
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const db = getDb();
  const author = db.users.find((u) => u.id === authorId);
  if (!author) return res.status(404).json({ error: 'User not found.' });

  const post: AnonymousPost = {
    id: `anon-${Date.now()}`,
    topic: (topic as AnonymousTopic) || 'General Discussions',
    alias: generateAnonymousAlias(`${authorId}-${Date.now()}`),
    authorId: String(authorId),
    title: String(title || '').trim(),
    content: String(content || '').trim(),
    createdAt: 'Just now',
    language: author.language?.split('&')[0]?.trim() || 'English',
    supportiveVotes: [],
    replies: [],
    reports: [],
  };
  db.anonymousPosts.unshift(post);
  saveDb(db);
  return res.status(201).json({ post });
});

app.post('/api/anonymous/:id/reply', (req, res) => {
  const { id } = req.params;
  const { authorId, text } = req.body || {};
  const safe = checkSafeContent(String(text || ''));
  if (!safe.ok) return res.status(400).json({ error: safe.reason });

  const db = getDb();
  const post = db.anonymousPosts.find((p) => p.id === id);
  if (!post) return res.status(404).json({ error: 'Topic not found.' });

  post.replies.push({
    id: `ar-${Date.now()}`,
    alias: generateAnonymousAlias(`${authorId}-${post.id}`),
    authorId: String(authorId),
    text: String(text || '').trim(),
    createdAt: 'Just now',
    language: 'English',
    supportiveVotes: [],
  });
  saveDb(db);
  return res.status(201).json({ post });
});

app.post('/api/anonymous/:id/vote', (req, res) => {
  const { id } = req.params;
  const { userId, replyId } = req.body || {};
  const db = getDb();
  const post = db.anonymousPosts.find((p) => p.id === id);
  if (!post) return res.status(404).json({ error: 'Topic not found.' });

  if (replyId) {
    const reply = post.replies.find((r) => r.id === replyId);
    if (reply) {
      reply.supportiveVotes = reply.supportiveVotes.includes(userId)
        ? reply.supportiveVotes.filter((u) => u !== userId)
        : [...reply.supportiveVotes, String(userId)];
    }
  } else {
    post.supportiveVotes = post.supportiveVotes.includes(userId)
      ? post.supportiveVotes.filter((u) => u !== userId)
      : [...post.supportiveVotes, String(userId)];
  }
  saveDb(db);
  return res.json({ post });
});

app.post('/api/anonymous/:id/report', (req, res) => {
  const { id } = req.params;
  const { reporterId, reason } = req.body || {};
  const db = getDb();
  const post = db.anonymousPosts.find((p) => p.id === id);
  if (!post) return res.status(404).json({ error: 'Topic not found.' });

  post.reports.push({
    id: `rep-${Date.now()}`,
    reporterId: String(reporterId),
    reason: String(reason || 'Community guideline review'),
    createdAt: 'Just now',
  });
  if (post.reports.length >= 3) post.hidden = true;
  saveDb(db);
  return res.json({ post });
});

app.post('/api/notifications/read', (req, res) => {
  const { userId } = req.body || {};
  const db = getDb();
  db.notifications.forEach((n) => {
    if (n.recipientId === userId) n.read = true;
  });
  saveDb(db);
  return res.json({ ok: true });
});

app.use(
  '/api',
  createSecurityRouter({
    ai,
    validatePasswordComplexity,
    addNotification,
  })
);

// =========================================================================
// VITE DEV MIDDLEWARE / PRODUCTION STATIC DIST
// =========================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), { maxAge: '1y', immutable: true })
    );
    app.use(
      express.static(distPath, {
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sphere. server running on http://0.0.0.0:${PORT}`);
    setImmediate(() => {
      try {
        getDb();
        runRetentionPurge('startup-retention', '127.0.0.1');
        setInterval(() => {
          try {
            runRetentionPurge('scheduled-retention', '127.0.0.1');
          } catch (err) {
            console.warn('Retention purge warning:', err);
          }
        }, 60 * 60 * 1000);
        void appendAuditLog;
      } catch (err) {
        console.warn('Database warmup warning:', err);
      }
    });
  });
}

startServer();
