import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ConfirmationResult,
  RecaptchaVerifier,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  createPhoneRecaptcha,
  isFirebaseUserVerified,
  refreshCurrentFirebaseUser,
  registerFirebaseEmailUser,
  resendVerificationEmailForCurrentUser,
  sendFirebasePasswordReset,
  sendFirebasePhoneOtp,
  signInFirebaseEmail,
  signInWithGooglePopup,
  signOutFirebase,
} from '../firebase';
import { UserProfile } from '../types/social';
import {
  apiLogin,
  apiSendEmailOtp,
  apiSyncFirebaseSession,
  apiVerifyEmailOtp,
} from '../utils/api';
import { GLOBAL_PRIVACY_FRAMEWORKS, getPrivacyFrameworkForCountry } from '../utils/discovery';

const FIREBASE_PROJECT_ID = firebaseConfig.projectId || 'gen-lang-client-0363394582';
const FIREBASE_PROVIDERS_URL = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`;
const FIREBASE_SETTINGS_URL = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`;

const DIAL_CODES = [
  { label: '+63 (PH)', code: '+63' },
  { label: '+1 (US/CA)', code: '+1' },
  { label: '+44 (UK)', code: '+44' },
  { label: '+81 (JP)', code: '+81' },
  { label: '+82 (KR)', code: '+82' },
  { label: '+65 (SG)', code: '+65' },
  { label: '+61 (AU)', code: '+61' },
  { label: '+49 (DE)', code: '+49' },
  { label: '+34 (ES)', code: '+34' },
  { label: '+33 (FR)', code: '+33' },
  { label: '+91 (IN)', code: '+91' },
  { label: '+55 (BR)', code: '+55' },
  { label: '+52 (MX)', code: '+52' },
  { label: '+234 (NG)', code: '+234' },
  { label: '+27 (ZA)', code: '+27' },
];

function formatE164Phone(dialCode: string, localNumber: string): string {
  const cleaned = localNumber.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  const digits = cleaned.replace(/^0+/, '');
  return `${dialCode}${digits}`;
}

function formatFirebaseError(err: unknown, providerHint?: string): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  if (raw.includes('auth/operation-not-allowed')) {
    const label = providerHint ? ` (${providerHint})` : '';
    return `The selected sign-in provider${label} is not yet enabled in Firebase Console -> Authentication -> Sign-in method (Project: ${FIREBASE_PROJECT_ID}).`;
  }
  if (raw.includes('auth/unauthorized-domain')) {
    return `Domain (${window.location.hostname}) is not authorized in Firebase Console -> Authentication -> Settings -> Authorized domains (Project: ${FIREBASE_PROJECT_ID}).`;
  }
  if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (raw.includes('auth/user-not-found')) {
    return 'No verified account exists for this email. Please create an account first.';
  }
  if (raw.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (raw.includes('auth/invalid-phone-number')) {
    return 'Please enter a valid international phone number (e.g. +63 9171234567).';
  }
  if (raw.includes('auth/invalid-verification-code')) {
    return 'The 6-digit SMS verification code is incorrect. Please check and try again.';
  }
  if (raw.includes('auth/code-expired')) {
    return 'Verification code expired. Please request a new SMS code.';
  }
  if (raw.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (raw.includes('auth/popup-closed-by-user')) {
    return 'Sign-in window closed before completing.';
  }
  return raw || 'Authentication failed. Please try again.';
}

function evaluatePasswordRules(password: string, tokens: string[]) {
  const lower = password.toLowerCase();
  const hasPersonal = tokens.some((t) => t.trim().length >= 3 && lower.includes(t.trim().toLowerCase()));
  const rules = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase & lowercase letters', ok: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'At least one number (0–9)', ok: /[0-9]/.test(password) },
    { label: 'At least one special character (!@#$%...)', ok: /[^A-Za-z0-9]/.test(password) },
    { label: 'No spaces', ok: password.length > 0 && !/\s/.test(password) },
    { label: 'No name, @handle, or email username', ok: password.length > 0 && !hasPersonal },
  ];
  const passed = rules.filter((r) => r.ok).length;
  const strengthLabel =
    passed <= 2 ? 'Weak' : passed <= 4 ? 'Fair' : passed === 5 ? 'Strong' : 'Very Strong';
  return { rules, passed, allPassed: passed === rules.length, strengthLabel };
}

function calculateAgeCheck(birthday: string): boolean {
  const d = new Date(birthday);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 18;
}

interface PendingOnboardingState {
  uid: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
}

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: UserProfile) => void;
  onSwitchToSignUp: () => void;
  onOpenRecovery?: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({
  open,
  onClose,
  onAuthenticated,
  onSwitchToSignUp,
  onOpenRecovery,
}) => {
  const [authTab, setAuthTab] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  // Phone OTP sign-in state
  const [dialCode, setDialCode] = useState('+63');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);
  const [phoneOtp, setPhoneOtp] = useState('');
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // Unverified Firebase Email prompt
  const [awaitingEmailCheck, setAwaitingEmailCheck] = useState(false);

  // New user authenticated via Google/Phone who still needs Sphere profile onboarding
  const [onboarding, setOnboarding] = useState<PendingOnboardingState | null>(null);
  const [obFirstName, setObFirstName] = useState('');
  const [obLastName, setObLastName] = useState('');
  const [obHandle, setObHandle] = useState('');
  const [obBirthday, setObBirthday] = useState('1998-06-15');
  const [obCountry, setObCountry] = useState('Philippines');
  const [obLocation, setObLocation] = useState('Labo, Camarines Norte');
  const [obPrivacy, setObPrivacy] = useState(false);
  const [obGuidelines, setObGuidelines] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    };
  }, [open, authTab]);

  if (!open) return null;

  const finalizeFirebaseUser = async (fbUser: FirebaseUser) => {
    const res = await apiSyncFirebaseSession({
      uid: fbUser.uid,
      email: fbUser.email,
      phoneNumber: fbUser.phoneNumber,
      displayName: fbUser.displayName,
      emailVerified: fbUser.emailVerified,
    });
    if (res.needsOnboarding) {
      const parts = (fbUser.displayName || '').trim().split(/\s+/);
      setObFirstName(parts[0] || '');
      setObLastName(parts.slice(1).join(' ') || '');
      setObHandle(
        (fbUser.email?.split('@')[0] || parts.join('') || 'member')
          .toLowerCase()
          .replace(/[^a-z0-9._]/g, '')
      );
      setOnboarding({
        uid: fbUser.uid,
        email: fbUser.email || undefined,
        phoneNumber: fbUser.phoneNumber || undefined,
        displayName: fbUser.displayName || undefined,
      });
      return;
    }
    if (res.user) {
      onAuthenticated(res.user);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const fbUser = await signInFirebaseEmail(email.trim(), password);
      if (!isFirebaseUserVerified(fbUser)) {
        setAwaitingEmailCheck(true);
        setInfo(`Please verify your email (${fbUser.email}) using the link we sent to your inbox.`);
        return;
      }
      await finalizeFirebaseUser(fbUser);
    } catch (fbErr) {
      // Fall back to Sphere's server scrypt auth (supports accounts recovered via Sphere Recovery Center)
      try {
        const res = await apiLogin(email.trim(), password);
        if (res.user) {
          onAuthenticated(res.user);
          return;
        }
      } catch {
        // Ignore fallback failure and surface original error
      }
      setError(formatFirebaseError(fbErr, 'Email/Password'));
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setError(null);
    setBusy(true);
    try {
      await resendVerificationEmailForCurrentUser();
      setInfo('Fresh verification link sent! Check your inbox or spam folder, then click Check Verification.');
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCheckEmailVerification = async () => {
    setError(null);
    setBusy(true);
    try {
      const updated = await refreshCurrentFirebaseUser();
      if (updated && isFirebaseUserVerified(updated)) {
        setAwaitingEmailCheck(false);
        await finalizeFirebaseUser(updated);
      } else {
        setError('Email not verified yet. Please click the verification link in your inbox first.');
      }
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await sendFirebasePasswordReset(email.trim());
      setInfo(`Password reset link sent to ${email.trim()}. Check your inbox to set a new password.`);
      setForgotMode(false);
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const e164 = formatE164Phone(dialCode, phoneLocal);
    if (!/^\+\d{10,15}$/.test(e164)) {
      setError('Enter a valid phone number (10–15 digits including country code).');
      return;
    }
    setBusy(true);
    try {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
      const verifier = createPhoneRecaptcha('sphere-signin-recaptcha');
      recaptchaRef.current = verifier;
      const confirmation = await sendFirebasePhoneOtp(e164, verifier);
      setPhoneConfirmation(confirmation);
      setInfo(`Real 6-digit SMS OTP sent to ${e164}.`);
    } catch (err) {
      setError(formatFirebaseError(err, 'Phone'));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneConfirmation) return;
    setError(null);
    setBusy(true);
    try {
      const cred = await phoneConfirmation.confirm(phoneOtp.trim());
      await finalizeFirebaseUser(cred.user);
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const fbUser = await signInWithGooglePopup();
      await finalizeFirebaseUser(fbUser);
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboarding) return;
    setError(null);
    if (!obFirstName.trim() || !obLastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (!calculateAgeCheck(obBirthday)) {
      setError('Members must be at least 18 years old.');
      return;
    }
    if (!obPrivacy || !obGuidelines) {
      setError('Please accept the Global Data Privacy Notice and Community Guidelines.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiSyncFirebaseSession({
        uid: onboarding.uid,
        email: onboarding.email,
        phoneNumber: onboarding.phoneNumber,
        displayName: onboarding.displayName,
        emailVerified: Boolean(onboarding.email),
        signupDetails: {
          firstName: obFirstName.trim(),
          lastName: obLastName.trim(),
          handle: obHandle.trim() || `${obFirstName}${obLastName}`,
          birthday: obBirthday,
          gender: 'Prefer not to say',
          location: obLocation.trim(),
          country: obCountry,
          language: 'English',
          preferredLanguage: 'English',
          email: onboarding.email,
          mobile: onboarding.phoneNumber,
          privacyConsent: obPrivacy,
          guidelinesConsent: obGuidelines,
        },
      });
      if (res.user) onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] flex flex-col bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 bg-[var(--sp-primary)] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#A5F3FC]" />
            <h2 className="font-display text-lg font-bold">
              {onboarding
                ? 'Complete Your Sphere. Profile'
                : forgotMode
                  ? 'Reset Password via Email'
                  : 'Sign in to Sphere.'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {info && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
              {info}
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300 space-y-2">
              <div>{error}</div>
              {error.includes('Firebase Console') && (
                <div className="pt-1 border-t border-red-500/20 flex flex-wrap gap-2 text-[11px]">
                  <a
                    href={FIREBASE_PROVIDERS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline text-[var(--sp-primary-text)]"
                  >
                    Open Sign-in Providers ({FIREBASE_PROJECT_ID})
                  </a>
                  <span>·</span>
                  <a
                    href={FIREBASE_SETTINGS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline text-[var(--sp-primary-text)]"
                  >
                    Authorized Domains
                  </a>
                </div>
              )}
            </div>
          )}

          {onboarding ? (
            <form onSubmit={handleCompleteOnboarding} className="space-y-3">
              <p className="text-xs text-[var(--sp-muted)]">
                Welcome! Add your real name, 18+ birthdate, and city so neighbors can connect with you.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={obFirstName}
                  onChange={(e) => setObFirstName(e.target.value)}
                  placeholder="First name"
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <input
                  type="text"
                  required
                  value={obLastName}
                  onChange={(e) => setObLastName(e.target.value)}
                  placeholder="Last name"
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={obHandle}
                  onChange={(e) => setObHandle(e.target.value)}
                  placeholder="@handle"
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <input
                  type="date"
                  required
                  value={obBirthday}
                  onChange={(e) => setObBirthday(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={obCountry}
                  onChange={(e) => setObCountry(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                >
                  {GLOBAL_PRIVACY_FRAMEWORKS.map((f) => (
                    <option key={f.country} value={f.country}>
                      {f.country}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={obLocation}
                  onChange={(e) => setObLocation(e.target.value)}
                  placeholder="City / Town"
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-[var(--sp-ink-2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={obPrivacy}
                  onChange={(e) => setObPrivacy(e.target.checked)}
                  className="mt-0.5 accent-[#4F46E5]"
                />
                <span>I acknowledge the Global Data Privacy Notice.</span>
              </label>
              <label className="flex items-start gap-2 text-xs text-[var(--sp-ink-2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={obGuidelines}
                  onChange={(e) => setObGuidelines(e.target.checked)}
                  className="mt-0.5 accent-[#4F46E5]"
                />
                <span>I confirm I am 18+ and agree to Sphere Community Guidelines.</span>
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-lg bg-[var(--sp-primary)] text-white text-sm font-semibold cursor-pointer"
              >
                {busy ? 'Creating Profile...' : 'Enter Sphere.'}
              </button>
            </form>
          ) : awaitingEmailCheck ? (
            <div className="space-y-3 text-center">
              <Mail className="w-8 h-8 text-[#06B6D4] mx-auto" />
              <div className="text-sm font-bold text-[var(--sp-ink)]">Email Verification Required</div>
              <p className="text-xs text-[var(--sp-muted)]">
                Open your email inbox, click the verification link sent by Sphere., then press Check Verification below.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCheckEmailVerification}
                  className="w-full py-2.5 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{busy ? 'Checking...' : 'Check Verification Status'}</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleResendVerification}
                  className="w-full py-2 rounded-lg border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-ink)] cursor-pointer"
                >
                  Resend Verification Email
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOutFirebase();
                    setAwaitingEmailCheck(false);
                  }}
                  className="text-xs text-[var(--sp-muted)] hover:underline cursor-pointer"
                >
                  Use another account
                </button>
              </div>
            </div>
          ) : forgotMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                  Registered Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForgotMode(false)}
                  className="flex-1 py-2 rounded-lg border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-ink)] cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold cursor-pointer"
                >
                  {busy ? 'Sending...' : 'Send Reset Email'}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Auth Mode Selector: Email vs Phone SMS OTP */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)]">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('email');
                    setError(null);
                    setInfo(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    authTab === 'email'
                      ? 'bg-[var(--sp-primary)] text-white'
                      : 'text-[var(--sp-ink-2)]'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email &amp; Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('phone');
                    setError(null);
                    setInfo(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    authTab === 'phone'
                      ? 'bg-[#06B6D4] text-slate-950'
                      : 'text-[var(--sp-ink-2)]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Phone SMS OTP</span>
                </button>
              </div>

              {authTab === 'email' ? (
                <form onSubmit={handleEmailSignIn} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)] focus:outline-none focus:border-[var(--sp-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-3 pr-10 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)] focus:outline-none focus:border-[var(--sp-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--sp-muted)] hover:text-[var(--sp-ink)] cursor-pointer"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenRecovery) {
                          onClose();
                          onOpenRecovery();
                        } else {
                          setForgotMode(true);
                          setError(null);
                        }
                      }}
                      className="text-[var(--sp-primary-text)] hover:underline font-semibold cursor-pointer"
                    >
                      Forgot password? Recover account
                    </button>
                    <button
                      type="button"
                      onClick={onSwitchToSignUp}
                      className="text-[var(--sp-accent-text)] hover:underline font-semibold cursor-pointer"
                    >
                      Create new account
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {busy ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
              ) : !phoneConfirmation ? (
                <form onSubmit={handleSendPhoneOtp} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                      Mobile Phone Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={dialCode}
                        onChange={(e) => setDialCode(e.target.value)}
                        className="px-2.5 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      >
                        {DIAL_CODES.map((d) => (
                          <option key={d.code} value={d.code}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        required
                        value={phoneLocal}
                        onChange={(e) => setPhoneLocal(e.target.value)}
                        placeholder="9171234567"
                        className="flex-1 px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      />
                    </div>
                  </div>

                  <div id="sphere-signin-recaptcha" className="min-h-[78px]" />

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 text-sm font-bold cursor-pointer disabled:opacity-60"
                  >
                    {busy ? 'Sending SMS OTP...' : 'Send Real SMS OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyPhoneOtp} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                      Enter 6-Digit SMS OTP
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={phoneOtp}
                      onChange={(e) => setPhoneOtp(e.target.value)}
                      placeholder="123456"
                      className="w-full px-3 py-2.5 text-center font-mono-code text-lg tracking-widest rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneConfirmation(null);
                        setPhoneOtp('');
                      }}
                      className="flex-1 py-2 rounded-lg border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-ink)] cursor-pointer"
                    >
                      Change Number
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="flex-1 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold cursor-pointer"
                    >
                      {busy ? 'Verifying...' : 'Verify & Sign In'}
                    </button>
                  </div>
                </form>
              )}

              <div className="pt-3 border-t border-[var(--sp-border-subtle)] space-y-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 px-4 rounded-lg border border-[var(--sp-border)] bg-[var(--sp-surface-alt)] hover:border-[var(--sp-primary)] text-xs font-bold text-[var(--sp-ink)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue with Google</span>
                </button>
                {onOpenRecovery && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenRecovery();
                    }}
                    className="w-full py-2 px-4 rounded-lg border border-[var(--sp-border)] text-xs font-bold text-[var(--sp-primary-text)] hover:bg-[var(--sp-primary-soft)] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Open Account Recovery Center (Email, Phone, or Gov ID)</span>
                  </button>
                )}
                <div className="text-center text-[11px] text-[var(--sp-muted)]">
                  New to Sphere.?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToSignUp}
                    className="text-[var(--sp-primary-text)] font-bold hover:underline cursor-pointer"
                  >
                    Sign up &amp; verify your details first
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface SignUpModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: UserProfile) => void;
  onOpenGuidelines: () => void;
}

export const SignUpModal: React.FC<SignUpModalProps> = ({
  open,
  onClose,
  onAuthenticated,
  onOpenGuidelines,
}) => {
  const [step, setStep] = useState<'details' | 'verify'>('details');
  const [verifyMethod, setVerifyMethod] = useState<'phone' | 'email'>('phone');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [dialCode, setDialCode] = useState('+63');
  const [mobileLocal, setMobileLocal] = useState('');
  const [birthday, setBirthday] = useState('1998-06-15');
  const [gender, setGender] = useState('Prefer not to say');
  const [location, setLocation] = useState('Labo, Camarines Norte');
  const [country, setCountry] = useState('Philippines');
  const [language, setLanguage] = useState('Tagalog & English');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [guidelinesConsent, setGuidelinesConsent] = useState(false);

  // Verification states
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);
  const [smsOtpInput, setSmsOtpInput] = useState('');
  const [smtpOtpAvailable, setSmtpOtpAvailable] = useState(false);
  const [emailOtpInput, setEmailOtpInput] = useState('');
  const signupRecaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const [googleOnboarding, setGoogleOnboarding] = useState<PendingOnboardingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (signupRecaptchaRef.current) {
        signupRecaptchaRef.current.clear();
        signupRecaptchaRef.current = null;
      }
    };
  }, [open, step, verifyMethod]);

  const pwEval = useMemo(
    () =>
      evaluatePasswordRules(password, [
        firstName,
        lastName,
        handle.replace(/^@/, ''),
        email.split('@')[0] || '',
      ]),
    [password, firstName, lastName, handle, email]
  );

  const privacyFramework = useMemo(() => getPrivacyFrameworkForCountry(country), [country]);

  if (!open) return null;

  const is18Plus = calculateAgeCheck(birthday);
  const fullPhoneE164 = formatE164Phone(dialCode, mobileLocal);

  const buildSignupDetails = () => ({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    handle: handle.trim(),
    birthday,
    gender,
    location: location.trim(),
    country,
    language: language.trim() || 'English',
    preferredLanguage,
    email: email.trim() || undefined,
    mobile: mobileLocal.trim() ? fullPhoneE164 : undefined,
    privacyConsent,
    guidelinesConsent,
  });

  const handleProceedToVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Real first and last name are required for account legitimacy.');
      return;
    }
    if (!is18Plus) {
      setError(
        'You must be at least 18 years old to join Sphere. Parents and guardians are advised to supervise minors.'
      );
      return;
    }
    if (!privacyConsent) {
      setError('Please acknowledge the Global Data Privacy Notice.');
      return;
    }
    if (!guidelinesConsent) {
      setError('Please agree to follow the Sphere Community Guidelines.');
      return;
    }

    if (verifyMethod === 'phone') {
      if (!/^\+\d{10,15}$/.test(fullPhoneE164)) {
        setError('Please enter a valid 10–15 digit phone number including country code.');
        return;
      }
      setPhoneConfirmation(null);
      setSmsOtpInput('');
      setStep('verify');
      return;
    }

    // Email verification method: validate email + strong password & trigger real verification email
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!pwEval.allPassed) {
      setError('Please satisfy all 6 password complexity rules.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await registerFirebaseEmailUser(email.trim(), password, `${firstName.trim()} ${lastName.trim()}`);
      const otpProbe = await apiSendEmailOtp(email.trim()).catch(() => ({
        sent: false,
        smtpConfigured: false,
      }));
      setSmtpOtpAvailable(Boolean(otpProbe.sent && otpProbe.smtpConfigured));
      setInfo(
        otpProbe.sent
          ? `Real verification link AND 6-digit OTP email sent to ${email.trim()}.`
          : `Real verification link sent to ${email.trim()}. Please open your inbox and verify.`
      );
      setStep('verify');
    } catch (err) {
      setError(formatFirebaseError(err, 'Email/Password'));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const fbUser = await signInWithGooglePopup();
      const res = await apiSyncFirebaseSession({
        uid: fbUser.uid,
        email: fbUser.email,
        phoneNumber: fbUser.phoneNumber,
        displayName: fbUser.displayName,
        emailVerified: fbUser.emailVerified,
      });
      if (res.needsOnboarding) {
        const parts = (fbUser.displayName || '').trim().split(/\s+/);
        if (!firstName.trim() && parts[0]) setFirstName(parts[0]);
        if (!lastName.trim() && parts.length > 1) setLastName(parts.slice(1).join(' '));
        if (!handle.trim()) {
          setHandle(
            (fbUser.email?.split('@')[0] || parts.join('') || 'member')
              .toLowerCase()
              .replace(/[^a-z0-9._]/g, '')
          );
        }
        if (!email.trim() && fbUser.email) setEmail(fbUser.email);
        setGoogleOnboarding({
          uid: fbUser.uid,
          email: fbUser.email || undefined,
          phoneNumber: fbUser.phoneNumber || undefined,
          displayName: fbUser.displayName || undefined,
        });
        setInfo('Google account verified! Complete your Sphere. profile details below to finish joining.');
        return;
      }
      if (res.user) onAuthenticated(res.user);
    } catch (err) {
      setError(formatFirebaseError(err, 'Google'));
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteGoogleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleOnboarding) return;
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('Real first and last name are required for account legitimacy.');
      return;
    }
    if (!is18Plus) {
      setError('You must be at least 18 years old to join Sphere.');
      return;
    }
    if (!privacyConsent || !guidelinesConsent) {
      setError('Please accept the Global Data Privacy Notice and Community Guidelines.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiSyncFirebaseSession({
        uid: googleOnboarding.uid,
        email: googleOnboarding.email || email.trim() || undefined,
        phoneNumber: googleOnboarding.phoneNumber,
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        emailVerified: Boolean(googleOnboarding.email),
        signupDetails: buildSignupDetails(),
      });
      if (res.user) onAuthenticated(res.user);
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerSignupSms = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (signupRecaptchaRef.current) {
        signupRecaptchaRef.current.clear();
        signupRecaptchaRef.current = null;
      }
      const verifier = createPhoneRecaptcha('sphere-signup-recaptcha');
      signupRecaptchaRef.current = verifier;
      const confirmation = await sendFirebasePhoneOtp(fullPhoneE164, verifier);
      setPhoneConfirmation(confirmation);
      setInfo(`Real 6-digit SMS OTP sent to ${fullPhoneE164}. Check your messages!`);
    } catch (err) {
      setError(formatFirebaseError(err, 'Phone'));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifySignupPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneConfirmation) return;
    setError(null);
    setBusy(true);
    try {
      const cred = await phoneConfirmation.confirm(smsOtpInput.trim());
      const res = await apiSyncFirebaseSession({
        uid: cred.user.uid,
        phoneNumber: cred.user.phoneNumber || fullPhoneE164,
        email: email.trim() || undefined,
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        emailVerified: false,
        signupDetails: buildSignupDetails(),
      });
      if (res.user) onAuthenticated(res.user);
    } catch (err) {
      setError(formatFirebaseError(err, 'Phone'));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifySignupEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      let verifiedViaOtp = false;
      if (smtpOtpAvailable && emailOtpInput.trim().length === 6) {
        const otpRes = await apiVerifyEmailOtp(email.trim(), emailOtpInput.trim());
        verifiedViaOtp = otpRes.verified;
      }

      const refreshed = await refreshCurrentFirebaseUser();
      if (!refreshed) {
        setError('Session expired. Please sign up again.');
        return;
      }

      if (!refreshed.emailVerified && !verifiedViaOtp) {
        setError(
          'Email not verified yet! Please click the verification link in your email inbox (or enter the 6-digit code if emailed) before continuing.'
        );
        return;
      }

      const res = await apiSyncFirebaseSession({
        uid: refreshed.uid,
        email: refreshed.email || email.trim(),
        phoneNumber: mobileLocal.trim() ? fullPhoneE164 : undefined,
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        emailVerified: refreshed.emailVerified,
        otpVerified: verifiedViaOtp,
        signupDetails: buildSignupDetails(),
      });
      if (res.user) onAuthenticated(res.user);
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] flex flex-col bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 bg-[var(--sp-primary)] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#A5F3FC]" />
            <div>
              <h2 className="font-display text-lg font-bold">Create Verified Sphere. Account</h2>
              <p className="text-[11px] text-white/80">
                18+ Community · Real Email or Phone SMS OTP Verification
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {info && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
              {info}
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300 space-y-2">
              <div>{error}</div>
              {error.includes('Firebase Console') && (
                <div className="pt-1.5 border-t border-red-500/20 space-y-1 text-[11px] text-[var(--sp-ink-2)]">
                  <div>
                    In Firebase Console for <strong>{FIREBASE_PROJECT_ID}</strong>, enable{' '}
                    <strong>Email/Password</strong> and <strong>Phone</strong> under Sign-in method, and authorize your domain under Settings. Or use{' '}
                    <strong>Continue with Google</strong> below right away.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={FIREBASE_PROVIDERS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold underline text-[var(--sp-primary-text)]"
                    >
                      Enable Sign-in Providers
                    </a>
                    <span>·</span>
                    <a
                      href={FIREBASE_SETTINGS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold underline text-[var(--sp-primary-text)]"
                    >
                      Authorized Domains
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {googleOnboarding ? (
            <form onSubmit={handleCompleteGoogleOnboarding} className="space-y-3.5">
              <div className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-xs text-[var(--sp-ink-2)]">
                Verified Google email: <strong className="text-[var(--sp-ink)]">{googleOnboarding.email}</strong>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">Unique @handle</label>
                  <input
                    type="text"
                    required
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="@yourhandle"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">Date of Birth (18+)</label>
                  <input
                    type="date"
                    required
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  >
                    {GLOBAL_PRIVACY_FRAMEWORKS.map((f) => (
                      <option key={f.country} value={f.country}>
                        {f.country}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">City / Town</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
              </div>
              <label className="flex items-start gap-2 text-xs text-[var(--sp-ink-2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  className="mt-0.5 accent-[#4F46E5]"
                />
                <span>
                  I acknowledge the Global Data Privacy Notice ({privacyFramework.shortCode}).
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs text-[var(--sp-ink-2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={guidelinesConsent}
                  onChange={(e) => setGuidelinesConsent(e.target.checked)}
                  className="mt-0.5 accent-[#4F46E5]"
                />
                <span>I confirm I am 18+ and agree to follow Sphere Community Guidelines.</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGoogleOnboarding(null)}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-ink)] cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
                >
                  {busy ? 'Creating Account...' : 'Complete Signup & Enter Sphere.'}
                </button>
              </div>
            </form>
          ) : step === 'details' ? (
            <form onSubmit={handleProceedToVerify} className="space-y-3.5">
              {/* Verification Method Toggle */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--sp-ink)]">
                  How would you like to receive real verification / OTP?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyMethod('phone');
                      setError(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer ${
                      verifyMethod === 'phone'
                        ? 'bg-[var(--sp-accent-soft)] border-[var(--sp-accent)] text-[var(--sp-ink)]'
                        : 'bg-[var(--sp-surface-alt)] border-[var(--sp-border)] text-[var(--sp-muted)]'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-[var(--sp-accent-text)] shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Phone SMS OTP</div>
                      <div className="text-[10px]">6-digit code to mobile</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyMethod('email');
                      setError(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer ${
                      verifyMethod === 'email'
                        ? 'bg-[var(--sp-primary-soft)] border-[var(--sp-primary)] text-[var(--sp-ink)]'
                        : 'bg-[var(--sp-surface-alt)] border-[var(--sp-border)] text-[var(--sp-muted)]'
                    }`}
                  >
                    <Mail className="w-4 h-4 text-[var(--sp-primary-text)] shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Email Verification</div>
                      <div className="text-[10px]">Link / OTP to inbox</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                    Unique @handle
                  </label>
                  <input
                    type="text"
                    required
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="@yourhandle"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                    Date of Birth (Must be 18+)
                  </label>
                  <input
                    type="date"
                    required
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                    Email Address {verifyMethod === 'email' ? '(Required for verification)' : '(Optional)'}
                  </label>
                  <input
                    type="email"
                    required={verifyMethod === 'email'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                    Mobile Number {verifyMethod === 'phone' ? '(Required for SMS OTP)' : '(Optional)'}
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={dialCode}
                      onChange={(e) => setDialCode(e.target.value)}
                      className="px-2 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                    >
                      {DIAL_CODES.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      required={verifyMethod === 'phone'}
                      value={mobileLocal}
                      onChange={(e) => setMobileLocal(e.target.value)}
                      placeholder="9171234567"
                      className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                    Country
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  >
                    {GLOBAL_PRIVACY_FRAMEWORKS.map((f) => (
                      <option key={f.country} value={f.country}>
                        {f.country}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                    City / Town
                  </label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  >
                    <option>Prefer not to say</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Non-binary</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                    Languages Spoken
                  </label>
                  <input
                    type="text"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                    Preferred Translation Language
                  </label>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  >
                    <option>English</option>
                    <option>Tagalog</option>
                    <option>Japanese</option>
                    <option>Spanish</option>
                    <option>Korean</option>
                    <option>German</option>
                    <option>French</option>
                  </select>
                </div>
              </div>

              {verifyMethod === 'email' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-3 pr-9 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--sp-muted)] cursor-pointer"
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                        Confirm Password
                      </label>
                      <input
                        type={showPw ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      />
                    </div>
                  </div>

                  {/* Password Strength Meter */}
                  <div className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--sp-ink)] flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-[var(--sp-primary-text)]" />
                        Password Strength
                      </span>
                      <span className="font-mono-code font-bold text-[var(--sp-accent-text)]">
                        {pwEval.strengthLabel} ({pwEval.passed}/6)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--sp-border)] overflow-hidden">
                      <div
                        style={{ width: `${(pwEval.passed / 6) * 100}%` }}
                        className={`h-full transition-all ${
                          pwEval.passed <= 2
                            ? 'bg-red-500'
                            : pwEval.passed <= 4
                              ? 'bg-amber-500'
                              : 'bg-[#06B6D4]'
                        }`}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                      {pwEval.rules.map((r) => (
                        <div
                          key={r.label}
                          className={r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--sp-muted)]'}
                        >
                          {r.ok ? '✓' : '○'} {r.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Global Data Privacy Notice */}
              <div className="p-3 rounded-xl bg-[var(--sp-primary-soft)] border border-[var(--sp-primary-soft-border)] text-xs space-y-1.5">
                <div className="font-bold text-[var(--sp-ink)]">
                  Applicable Privacy Standard: {privacyFramework.lawName} ({privacyFramework.shortCode})
                </div>
                <p className="text-[11px] text-[var(--sp-ink-2)]">{privacyFramework.summary}</p>
                <p className="text-[11px] text-[var(--sp-muted)]">
                  Notice: Sphere. requires members to be 18+ years old. Parents and guardians are advised to supervise minors.
                </p>
              </div>

              <label className="flex items-start gap-2 text-xs text-[var(--sp-ink-2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  className="mt-0.5 accent-[#4F46E5]"
                />
                <span>
                  I acknowledge the Global Data Privacy Notice ({privacyFramework.shortCode}) and confirm my registration details are genuine.
                </span>
              </label>

              <label className="flex items-start gap-2 text-xs text-[var(--sp-ink-2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={guidelinesConsent}
                  onChange={(e) => setGuidelinesConsent(e.target.checked)}
                  className="mt-0.5 accent-[#4F46E5]"
                />
                <span>
                  I agree to follow the{' '}
                  <button
                    type="button"
                    onClick={onOpenGuidelines}
                    className="font-semibold text-[var(--sp-primary-text)] underline cursor-pointer"
                  >
                    Sphere Community Guidelines
                  </button>{' '}
                  and confirm I am 18+ years old.
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 font-bold text-sm cursor-pointer disabled:opacity-60"
              >
                {busy
                  ? 'Sending Verification...'
                  : verifyMethod === 'phone'
                    ? 'Continue to Real Phone SMS OTP →'
                    : 'Send Real Email Verification →'}
              </button>

              <div className="pt-2 border-t border-[var(--sp-border-subtle)] space-y-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleGoogleSignUp}
                  className="w-full py-2.5 px-4 rounded-lg border border-[var(--sp-border)] bg-[var(--sp-surface-alt)] hover:border-[var(--sp-primary)] text-xs font-bold text-[var(--sp-ink)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <span>Or Sign Up Instantly with Verified Google Account</span>
                </button>
              </div>
            </form>
          ) : verifyMethod === 'phone' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-center space-y-2">
                <Smartphone className="w-8 h-8 text-[#06B6D4] mx-auto" />
                <div className="text-sm font-bold text-[var(--sp-ink)]">
                  Phone Number SMS Verification
                </div>
                <p className="text-xs text-[var(--sp-muted)]">
                  Complete the security check below to send a real 6-digit SMS OTP to{' '}
                  <strong className="text-[var(--sp-ink)]">{fullPhoneE164}</strong>.
                </p>
              </div>

              {!phoneConfirmation ? (
                <div className="space-y-3">
                  <div id="sphere-signup-recaptcha" className="min-h-[78px] flex justify-center" />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep('details')}
                      className="flex-1 py-2.5 rounded-lg border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-ink)] cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleTriggerSignupSms}
                      className="flex-1 py-2.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-60"
                    >
                      {busy ? 'Sending SMS...' : 'Send 6-Digit SMS OTP'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleVerifySignupPhoneOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                      Enter 6-Digit SMS OTP Sent to {fullPhoneE164}
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={smsOtpInput}
                      onChange={(e) => setSmsOtpInput(e.target.value)}
                      placeholder="000000"
                      className="w-full px-3 py-2.5 text-center font-mono-code text-lg tracking-widest rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneConfirmation(null);
                        setSmsOtpInput('');
                      }}
                      className="flex-1 py-2.5 rounded-lg border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-ink)] cursor-pointer"
                    >
                      Resend Code
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="flex-1 py-2.5 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      {busy ? 'Verifying...' : 'Verify OTP & Join Sphere.'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={handleVerifySignupEmail} className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#06B6D4] mx-auto" />
                <div className="text-sm font-bold text-[var(--sp-ink)]">
                  Verify Your Email Inbox
                </div>
                <p className="text-xs text-[var(--sp-muted)] leading-relaxed">
                  We sent a real verification email to <strong className="text-[var(--sp-ink)]">{email}</strong>. Click the verification link in your inbox, then tap the button below to continue.
                </p>
              </div>

              {smtpOtpAvailable && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
                    Or enter the 6-Digit Email OTP sent to your inbox
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={emailOtpInput}
                    onChange={(e) => setEmailOtpInput(e.target.value)}
                    placeholder="000000"
                    className="w-full px-3 py-2.5 text-center font-mono-code text-lg tracking-widest rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setError(null);
                    setBusy(true);
                    try {
                      await resendVerificationEmailForCurrentUser();
                      setInfo(`Fresh verification link resent to ${email}.`);
                    } catch (err) {
                      setError(formatFirebaseError(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-ink)] cursor-pointer"
                >
                  Resend Email
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {busy ? 'Confirming...' : 'I Verified My Email — Enter Sphere.'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
