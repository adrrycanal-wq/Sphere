import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileBadge2,
  KeyRound,
  Lock,
  Mail,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Upload,
} from 'lucide-react';
import { sendFirebasePasswordReset } from '../firebase';
import { GovIdType, UserProfile } from '../types/social';
import {
  RecoveryStatusResponse,
  apiCompleteRecovery,
  apiConfirmEmailRecovery,
  apiLookupRecoveryStatus,
  apiRequestEmailRecovery,
  apiRequestPhoneRecoveryOtp,
  apiSubmitAdditionalRecoveryInfo,
  apiSubmitGovIdRecovery,
  apiSubmitRecoveryAppeal,
  apiVerifyPhoneRecoveryOtp,
} from '../utils/api';
import {
  PHILIPPINE_GOV_IDS,
  Ra10173NoticeBox,
  RecoveryStatusBadge,
  evaluateRecoveryPassword,
  fileToDataUrl,
} from './SecurityHelpers';

export type RecoveryCenterTab = 'email' | 'phone' | 'gov-id' | 'status' | 'appeal' | 'complete';

interface AccountRecoveryCenterViewProps {
  currentUser?: UserProfile | null;
  initialTab?: RecoveryCenterTab | 'gov_id';
  initialEmailToken?: string;
  initialReferenceNumber?: string;
  onBack: () => void;
  onRecoveryCompleted?: () => void;
}

export const AccountRecoveryCenterView: React.FC<AccountRecoveryCenterViewProps> = ({
  currentUser,
  initialTab = 'email',
  initialEmailToken = '',
  initialReferenceNumber = '',
  onBack,
  onRecoveryCompleted,
}) => {
  const normalizedInitial: RecoveryCenterTab =
    initialTab === 'gov_id' ? 'gov-id' : initialTab;
  const [tab, setTab] = useState<RecoveryCenterTab>(
    initialEmailToken ? 'email' : initialReferenceNumber ? 'status' : normalizedInitial
  );
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Option A: Registered Email Recovery
  const [emailInput, setEmailInput] = useState(currentUser?.email || '');
  const [emailToken, setEmailToken] = useState(initialEmailToken);
  const [emailNewPw, setEmailNewPw] = useState('');
  const [emailConfirmMode, setEmailConfirmMode] = useState(Boolean(initialEmailToken));

  // Option B: Registered Phone OTP Recovery
  const [phoneInput, setPhoneInput] = useState(currentUser?.mobile || '');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');

  // Option C: Government ID Recovery / Hybrid Verification Submission
  const [targetHandleOrId, setTargetHandleOrId] = useState(currentUser?.handle || '');
  const [purpose, setPurpose] = useState<'account_recovery' | 'hybrid_identity_verification'>(
    'account_recovery'
  );
  const [legalFullName, setLegalFullName] = useState(currentUser?.name || '');
  const [dateOfBirth, setDateOfBirth] = useState(currentUser?.birthday || '1998-06-15');
  const [idType, setIdType] = useState<GovIdType>('PhilSys National ID');
  const [ownershipContext, setOwnershipContext] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [idFile, setIdFile] = useState<{
    name: string;
    mimeType: string;
    dataBase64: string;
    sizeBytes: number;
  } | null>(null);
  const [govReceipt, setGovReceipt] = useState<{
    referenceNumber: string;
    status: string;
    readabilityLabel: string;
    discrepancies: string[];
    retainUntil: string;
  } | null>(null);

  // Status Tracker & Additional Info
  const [lookupRef, setLookupRef] = useState(initialReferenceNumber);
  const [statusData, setStatusData] = useState<RecoveryStatusResponse | null>(null);
  const [addInfoText, setAddInfoText] = useState('');
  const [addInfoFile, setAddInfoFile] = useState<{
    name: string;
    mimeType: string;
    dataBase64: string;
  } | null>(null);

  // Appeal Submission
  const [appealRef, setAppealRef] = useState(initialReferenceNumber);
  const [appealExplanation, setAppealExplanation] = useState('');
  const [appealFile, setAppealFile] = useState<{
    name: string;
    mimeType: string;
    dataBase64: string;
  } | null>(null);

  // Complete Separate Recovery Authorization Flow
  const [completeRef, setCompleteRef] = useState(initialReferenceNumber);
  const [recoveryAuthToken, setRecoveryAuthToken] = useState('');
  const [completePassword, setCompletePassword] = useState('');
  const [completeNewEmail, setCompleteNewEmail] = useState('');
  const [completeNewPhone, setCompleteNewPhone] = useState('');

  const emailPwEval = useMemo(() => evaluateRecoveryPassword(emailNewPw), [emailNewPw]);
  const completePwEval = useMemo(() => evaluateRecoveryPassword(completePassword), [completePassword]);

  const switchTab = (next: RecoveryCenterTab) => {
    setTab(next);
    setError(null);
    setInfo(null);
  };

  const handleRequestEmailRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await apiRequestEmailRecovery(emailInput.trim());
      // Trigger Firebase reset link when available without breaking server anti-enumeration
      await sendFirebasePasswordReset(emailInput.trim()).catch(() => {});
      setInfo(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process email recovery request.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmEmailRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!emailPwEval.allPassed) {
      setError('Please meet all 6 password strength rules before resetting your password.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiConfirmEmailRecovery(emailToken.trim(), emailNewPw);
      setInfo(res.message);
      setEmailNewPw('');
      setEmailToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password with that token.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await apiRequestPhoneRecoveryOtp(phoneInput.trim());
      setPhoneOtpSent(true);
      setInfo(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send phone OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await apiVerifyPhoneRecoveryOtp(phoneInput.trim(), phoneOtpCode.trim());
      setCompleteRef(res.referenceNumber);
      setRecoveryAuthToken(res.recoveryAuthToken);
      setInfo(
        `OTP verified (${res.referenceNumber}). Complete the separate Recovery Authorization step below to set your new password.`
      );
      setTab('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification code rejected.');
    } finally {
      setBusy(false);
    }
  };

  const handleSelectIdFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Government ID image must be JPEG, PNG, or WebP.');
      return;
    }
    if (f.size < 1024 || f.size > 8 * 1024 * 1024) {
      setError('Government ID image must be between 1 KB and 8 MB.');
      return;
    }
    const dataBase64 = await fileToDataUrl(f);
    setIdFile({ name: f.name, mimeType: f.type, dataBase64, sizeBytes: f.size });
  };

  const handleSubmitGovId = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!idFile) {
      setError('Please upload a clear photo of your valid Philippine government-issued ID.');
      return;
    }
    if (!privacyAccepted) {
      setError('Please acknowledge the RA 10173 Data Privacy Notice before submitting.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiSubmitGovIdRecovery({
        targetHandleOrId: targetHandleOrId.trim(),
        purpose,
        legalFullName: legalFullName.trim(),
        dateOfBirth,
        idType,
        ownershipContext: ownershipContext.trim(),
        privacyConsentAccepted: privacyAccepted,
        fileName: idFile.name,
        mimeType: idFile.mimeType,
        dataBase64: idFile.dataBase64,
      });
      setGovReceipt({
        referenceNumber: res.referenceNumber,
        status: res.status,
        readabilityLabel: res.screening.readabilityLabel,
        discrepancies: res.screening.discrepancies,
        retainUntil: res.retainUntil,
      });
      setLookupRef(res.referenceNumber);
      setInfo(
        `Encrypted ID submitted cleanly! Reference Number: ${res.referenceNumber}. Save this code to track verification progress.`
      );
    } catch (err: unknown) {
      const typed = err as Error & { existingReferenceNumber?: string };
      if (typed.existingReferenceNumber) {
        setLookupRef(typed.existingReferenceNumber);
      }
      setError(err instanceof Error ? err.message : 'Unable to submit Government ID request.');
    } finally {
      setBusy(false);
    }
  };

  const handleLookupStatus = async (e?: React.FormEvent, explicitRef?: string) => {
    if (e) e.preventDefault();
    const targetRef = (explicitRef ?? lookupRef).trim().toUpperCase();
    if (!targetRef) {
      setError('Enter your REC-... reference number.');
      return;
    }
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const data = await apiLookupRecoveryStatus(targetRef);
      setStatusData(data);
      setAppealRef(data.referenceNumber);
      setCompleteRef(data.referenceNumber);
    } catch (err) {
      setStatusData(null);
      setError(err instanceof Error ? err.message : 'Recovery reference not found.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitAdditionalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusData) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await apiSubmitAdditionalRecoveryInfo(statusData.referenceNumber, {
        responseText: addInfoText.trim(),
        fileName: addInfoFile?.name,
        mimeType: addInfoFile?.mimeType,
        dataBase64: addInfoFile?.dataBase64,
      });
      setAddInfoText('');
      setAddInfoFile(null);
      setInfo('Additional information submitted! Your request has returned to Under Verification.');
      await handleLookupStatus(undefined, statusData.referenceNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit additional information.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await apiSubmitRecoveryAppeal(appealRef.trim().toUpperCase(), {
        explanation: appealExplanation.trim(),
        fileName: appealFile?.name,
        mimeType: appealFile?.mimeType,
        dataBase64: appealFile?.dataBase64,
      });
      setInfo(
        `Appeal submitted for ${appealRef.trim().toUpperCase()}. A Senior Reviewer will inspect your appeal.`
      );
      setAppealExplanation('');
      setAppealFile(null);
      setLookupRef(appealRef.trim().toUpperCase());
      await handleLookupStatus(undefined, appealRef.trim().toUpperCase());
      setTab('status');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit appeal.');
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!completePwEval.allPassed) {
      setError('Please meet all 6 password complexity rules.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiCompleteRecovery({
        referenceNumber: completeRef.trim() ? completeRef.trim().toUpperCase() : undefined,
        recoveryAuthToken: recoveryAuthToken.trim(),
        newPassword: completePassword,
        newEmail: completeNewEmail.trim() || undefined,
        newPhone: completeNewPhone.trim() || undefined,
      });
      setInfo(res.message);
      setCompletePassword('');
      setRecoveryAuthToken('');
      if (onRecoveryCompleted) onRecoveryCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete account recovery.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono-code font-bold text-[var(--sp-accent-text)] uppercase">
            <ShieldCheck className="w-4 h-4" />
            <span>Sphere. Account Recovery Center</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
            Verify Ownership &amp; Recover Your Account Safely
          </h1>
          <p className="text-xs text-[var(--sp-ink-2)] max-w-2xl leading-relaxed">
            Recover access via your registered email, registered phone OTP, or encrypted Philippine government-issued ID verification when primary contacts are inaccessible. Government IDs are always optional during ordinary registration under our Hybrid Identity Verification Policy.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface-alt)] hover:border-[var(--sp-primary)] text-xs font-bold text-[var(--sp-ink)] inline-flex items-center gap-1.5 self-start shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{currentUser ? 'Back to Sphere.' : 'Back to Sign In'}</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {(
          [
            { id: 'email', label: 'Email Reset', icon: Mail },
            { id: 'phone', label: 'Phone OTP', icon: Smartphone },
            { id: 'gov-id', label: 'Gov ID Verify', icon: FileBadge2 },
            { id: 'status', label: 'Track Status', icon: Search },
            { id: 'appeal', label: 'Submit Appeal', icon: ShieldAlert },
            { id: 'complete', label: 'Finalize Reset', icon: KeyRound },
          ] as const
        ).map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                active
                  ? 'bg-[var(--sp-primary)] border-[var(--sp-primary)] text-white shadow-sm'
                  : 'bg-[var(--sp-surface)] border-[var(--sp-border)] text-[var(--sp-ink-2)] hover:border-[var(--sp-primary)]'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {info && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{info}</div>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {/* TAB A: EMAIL RECOVERY */}
      {tab === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-[var(--sp-ink)]">
                A. Recover Through Registered Email
              </h2>
              <button
                type="button"
                onClick={() => setEmailConfirmMode((v) => !v)}
                className="text-xs font-bold text-[var(--sp-primary-text)] hover:underline cursor-pointer"
              >
                {emailConfirmMode ? 'Request Reset Link' : 'Have a Reset Token?'}
              </button>
            </div>

            {!emailConfirmMode ? (
              <form onSubmit={handleRequestEmailRecovery} className="space-y-3">
                <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
                  Enter your registered email address. For account privacy, Sphere always returns an identical confirmation response without disclosing whether an address is registered.
                </p>
                <div>
                  <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{busy ? 'Issuing Single-Use Link...' : 'Send Expiring Reset Link'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmEmailRecovery} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                    Single-Use Reset Token
                  </label>
                  <input
                    type="text"
                    required
                    value={emailToken}
                    onChange={(e) => setEmailToken(e.target.value)}
                    placeholder="Paste token from your email link"
                    className="w-full px-3 py-2 text-xs font-mono-code rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                    New Strong Password
                  </label>
                  <input
                    type="password"
                    required
                    value={emailNewPw}
                    onChange={(e) => setEmailNewPw(e.target.value)}
                    placeholder="Create a strong new password"
                    className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {emailPwEval.rules.map((r) => (
                    <div
                      key={r.label}
                      className={r.ok ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-[var(--sp-muted)]'}
                    >
                      {r.ok ? '✓' : '○'} {r.label}
                    </div>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {busy ? 'Updating Password...' : 'Confirm Password Reset'}
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-5 rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 space-y-3 text-xs">
            <h3 className="font-display text-sm font-bold text-[var(--sp-ink)]">
              Security Guarantees on Email Recovery
            </h3>
            <ul className="space-y-2 text-[var(--sp-ink-2)]">
              <li className="flex gap-2">
                <Lock className="w-4 h-4 text-[var(--sp-primary-text)] shrink-0 mt-0.5" />
                <span>Reset tokens expire in 15 minutes and are cryptographically invalidated immediately after single use.</span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>All prior device sessions are revoked automatically and a security notification is logged to your account.</span>
              </li>
            </ul>
            <div className="pt-2 border-t border-[var(--sp-border-subtle)] text-[11px] text-[var(--sp-muted)]">
              Lost access to both email and phone?{' '}
              <button
                type="button"
                onClick={() => switchTab('gov-id')}
                className="text-[var(--sp-primary-text)] font-bold hover:underline cursor-pointer"
              >
                Recover using a Philippine Government ID →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB B: PHONE OTP RECOVERY */}
      {tab === 'phone' && (
        <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 sm:p-6 max-w-2xl space-y-4">
          <h2 className="font-display text-lg font-bold text-[var(--sp-ink)]">
            B. Recover Through Registered Phone Number (OTP)
          </h2>
          <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
            Receive a 6-digit verification code valid for 5 minutes. Enforces strict 5-attempt lockout, per-IP/per-number rate limiting, and zero account existence leakage.
          </p>

          <form onSubmit={handleRequestPhoneOtp} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                Registered Mobile Number (with country code, e.g. +639171234567)
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  required
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+639171234567"
                  className="flex-1 px-3 py-2 text-sm rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  {busy ? 'Sending...' : 'Request OTP'}
                </button>
              </div>
            </div>
          </form>

          {phoneOtpSent && (
            <form
              onSubmit={handleVerifyPhoneOtp}
              className="pt-4 border-t border-[var(--sp-border-subtle)] space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                  Enter 6-Digit Recovery OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={phoneOtpCode}
                  onChange={(e) => setPhoneOtpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3 py-2.5 text-center font-mono-code text-lg tracking-widest rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {busy ? 'Verifying...' : 'Verify OTP & Issue Recovery Authorization Token'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB C: GOVERNMENT ID RECOVERY & HYBRID IDENTITY VERIFICATION */}
      {tab === 'gov-id' && (
        <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--sp-ink)]">
                C. Philippine Government ID Verification &amp; Recovery
              </h2>
              <p className="text-xs text-[var(--sp-ink-2)]">
                For users who lost access to both registered email &amp; phone, or opting into voluntary Hybrid Verification. Automated screening flags unreadable files or mismatches, and a human Verification Officer makes the final decision.
              </p>
            </div>
          </div>

          {govReceipt ? (
            <div className="p-5 rounded-2xl bg-[var(--sp-surface-alt)] border border-emerald-500/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                    Encrypted Submission Received
                  </div>
                  <div className="font-mono-code text-xl font-extrabold text-[var(--sp-ink)]">
                    {govReceipt.referenceNumber}
                  </div>
                </div>
                <RecoveryStatusBadge status={govReceipt.status as never} />
              </div>
              <div className="text-xs text-[var(--sp-ink-2)] space-y-1">
                <div>
                  Stage A Automated Screening: <strong>{govReceipt.readabilityLabel} readability</strong>
                </div>
                {govReceipt.discrepancies.length > 0 && (
                  <div className="text-amber-700 dark:text-amber-300">
                    Flagged items routed for officer review: {govReceipt.discrepancies.join(' · ')}
                  </div>
                )}
                <div className="text-[11px] text-[var(--sp-muted)]">
                  Encrypted ID scheduled retention ceiling: {new Date(govReceipt.retainUntil).toLocaleDateString()}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    switchTab('status');
                    void handleLookupStatus(undefined, govReceipt.referenceNumber);
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer"
                >
                  View Live Tracker
                </button>
                <button
                  type="button"
                  onClick={() => setGovReceipt(null)}
                  className="px-4 py-2 rounded-xl border border-[var(--sp-border)] text-xs font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitGovId} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                    Verification Purpose
                  </label>
                  <select
                    value={purpose}
                    onChange={(e) =>
                      setPurpose(e.target.value as 'account_recovery' | 'hybrid_identity_verification')
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  >
                    <option value="account_recovery">
                      Account Recovery (Lost Registered Email &amp; Phone)
                    </option>
                    <option value="hybrid_identity_verification">
                      Optional Hybrid Identity Verification (Account Ownership Badge)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                    Sphere Username (@handle) or Account ID
                  </label>
                  <input
                    type="text"
                    required
                    value={targetHandleOrId}
                    onChange={(e) => setTargetHandleOrId(e.target.value)}
                    placeholder="@adrian.v or account email/ID"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                    Full Legal Name (as printed on ID)
                  </label>
                  <input
                    type="text"
                    required
                    value={legalFullName}
                    onChange={(e) => setLegalFullName(e.target.value)}
                    placeholder="Juan Dela Cruz"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                    Supported Philippine Government ID
                  </label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value as GovIdType)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  >
                    {PHILIPPINE_GOV_IDS.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                  Account Ownership Details (e.g. approximate join date, city, recent circles or Pages)
                </label>
                <textarea
                  rows={2}
                  value={ownershipContext}
                  onChange={(e) => setOwnershipContext(e.target.value)}
                  placeholder="Share helpful details to verify ownership (never include passwords)..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                  Upload Valid Government ID Image (JPEG, PNG, or WebP · max 8 MB)
                </label>
                <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-[var(--sp-border)] hover:border-[var(--sp-primary)] rounded-2xl bg-[var(--sp-surface-alt)] cursor-pointer transition-colors">
                  <Upload className="w-6 h-6 text-[var(--sp-primary-text)] mb-1.5" />
                  <span className="text-xs font-bold text-[var(--sp-ink)]">
                    {idFile
                      ? `${idFile.name} (${Math.round(idFile.sizeBytes / 1024)} KB)`
                      : 'Select encrypted Government ID image'}
                  </span>
                  <span className="text-[11px] text-[var(--sp-muted)] mt-0.5">
                    Protected by AES-256-GCM encryption on upload
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleSelectIdFile}
                    className="hidden"
                  />
                </label>
              </div>

              <Ra10173NoticeBox accepted={privacyAccepted} onChange={setPrivacyAccepted} />

              <button
                type="submit"
                disabled={busy}
                className="px-6 py-2.5 rounded-xl bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {busy ? 'Encrypting & Screening...' : 'Submit Verification Request'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB D: RECOVERY REQUEST STATUS TRACKER & ADDITIONAL INFO */}
      {tab === 'status' && (
        <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 sm:p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[var(--sp-ink)]">
            Track Recovery Request Status
          </h2>
          <form onSubmit={(e) => handleLookupStatus(e)} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              value={lookupRef}
              onChange={(e) => setLookupRef(e.target.value)}
              placeholder="Enter Reference Number (e.g. REC-2026-AB12CD)"
              className="flex-1 px-3 py-2 text-xs font-mono-code uppercase rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-xl bg-[var(--sp-primary)] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{busy ? 'Looking up...' : 'Check Status'}</span>
            </button>
          </form>

          {statusData && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-mono-code text-base font-extrabold text-[var(--sp-ink)]">
                    {statusData.referenceNumber}
                  </div>
                  <div className="text-[11px] text-[var(--sp-muted)]">
                    {statusData.idType} · Screening: {statusData.screeningSummary.readabilityLabel} (
                    {statusData.screeningSummary.readabilityScore}/100)
                  </div>
                </div>
                <RecoveryStatusBadge status={statusData.status} />
              </div>

              {statusData.requestedAdditionalInfo && (
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs text-orange-800 dark:text-orange-200">
                  <strong>Officer Requested Additional Information:</strong>{' '}
                  {statusData.requestedAdditionalInfo}
                </div>
              )}

              {statusData.rejectionReason && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-200 space-y-2">
                  <div>
                    <strong>Rejection Reason:</strong> {statusData.rejectionReason}
                  </div>
                  {statusData.status === 'rejected' && (
                    <button
                      type="button"
                      onClick={() => switchTab('appeal')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                    >
                      Submit Appeal to Senior Reviewer
                    </button>
                  )}
                </div>
              )}

              {statusData.status === 'approved' && statusData.purpose === 'account_recovery' && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex flex-wrap items-center justify-between gap-2">
                  <span className="text-emerald-800 dark:text-emerald-200 font-semibold">
                    Identity verification approved! Use the separate single-use Recovery Authorization Token issued for this case to reset your password safely.
                  </span>
                  <button
                    type="button"
                    onClick={() => switchTab('complete')}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Open Finalize Reset Step
                  </button>
                </div>
              )}

              {statusData.status === 'additional_info_required' && (
                <form
                  onSubmit={handleSubmitAdditionalInfo}
                  className="p-4 rounded-xl bg-[var(--sp-surface)] border border-[var(--sp-border)] space-y-3"
                >
                  <div className="text-xs font-bold text-[var(--sp-ink)]">
                    Respond to Information Request
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={addInfoText}
                    onChange={(e) => setAddInfoText(e.target.value)}
                    placeholder="Provide the clarification requested by the Verification Officer..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const dataBase64 = await fileToDataUrl(f);
                      setAddInfoFile({ name: f.name, mimeType: f.type, dataBase64 });
                    }}
                    className="text-xs text-[var(--sp-muted)]"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 rounded-xl bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer"
                  >
                    Submit Additional Information
                  </button>
                </form>
              )}

              <div className="space-y-2">
                <div className="text-xs font-bold text-[var(--sp-ink)]">Review Timeline</div>
                <div className="space-y-1.5">
                  {statusData.timeline.map((t, idx) => (
                    <div
                      key={`${t.timestamp}-${idx}`}
                      className="flex items-center justify-between gap-2 text-[11px] p-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border-subtle)]"
                    >
                      <span className="font-medium text-[var(--sp-ink)]">{t.action}</span>
                      <span className="text-[var(--sp-muted)] font-mono-code">
                        {t.actorRole} · {new Date(t.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-[var(--sp-muted)]">
                {statusData.documentDeletedAt
                  ? `Encrypted ID purged from vault on ${new Date(statusData.documentDeletedAt).toLocaleString()}.`
                  : `Encrypted ID retention deadline: ${new Date(statusData.documentRetainUntil).toLocaleString()}.`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB E: RECOVERY APPEAL PAGE */}
      {tab === 'appeal' && (
        <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 sm:p-6 max-w-2xl space-y-4">
          <h2 className="font-display text-lg font-bold text-[var(--sp-ink)]">
            Submit Recovery &amp; Verification Appeal
          </h2>
          <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
            If your Government ID request was rejected, submit an appeal with additional context or a clearer document. Appeals are routed directly to a Senior Reviewer.
          </p>
          <form onSubmit={handleSubmitAppeal} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                Rejected Reference Number
              </label>
              <input
                type="text"
                required
                value={appealRef}
                onChange={(e) => setAppealRef(e.target.value)}
                placeholder="REC-2026-XXXXXX"
                className="w-full px-3 py-2 text-xs font-mono-code uppercase rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                Appeal Explanation (minimum 15 characters)
              </label>
              <textarea
                rows={3}
                required
                value={appealExplanation}
                onChange={(e) => setAppealExplanation(e.target.value)}
                placeholder="Explain discrepancies (e.g. maiden name, middle initial, or uploaded clearer photo)..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                Optional Clearer / Secondary Philippine ID Image
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const dataBase64 = await fileToDataUrl(f);
                  setAppealFile({ name: f.name, mimeType: f.type, dataBase64 });
                }}
                className="text-xs text-[var(--sp-muted)]"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Submitting Appeal...' : 'Escalate Appeal to Senior Reviewer'}
            </button>
          </form>
        </div>
      )}

      {/* TAB F: COMPLETE SEPARATE RECOVERY AUTHORIZATION */}
      {tab === 'complete' && (
        <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 sm:p-6 max-w-2xl space-y-4">
          <h2 className="font-display text-lg font-bold text-[var(--sp-ink)]">
            Separate Recovery Authorization — Reset Password &amp; Recovery Contacts
          </h2>
          <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
            Verification approval alone never resets an account automatically. Enter your single-use Recovery Authorization Token issued upon approval to set a fresh password and sign out all prior sessions.
          </p>
          <form onSubmit={handleCompleteRecovery} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={completeRef}
                  onChange={(e) => setCompleteRef(e.target.value)}
                  placeholder="REC-2026-XXXXXX"
                  className="w-full px-3 py-2 text-xs font-mono-code uppercase rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                  Single-Use Recovery Authorization Token
                </label>
                <input
                  type="text"
                  required
                  value={recoveryAuthToken}
                  onChange={(e) => setRecoveryAuthToken(e.target.value)}
                  placeholder="Paste authorization token"
                  className="w-full px-3 py-2 text-xs font-mono-code rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                New Account Password
              </label>
              <input
                type="password"
                required
                value={completePassword}
                onChange={(e) => setCompletePassword(e.target.value)}
                placeholder="Strong password (8+ chars, upper/lower, digit, symbol)"
                className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
              <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-2">
                {completePwEval.rules.map((r) => (
                  <div
                    key={r.label}
                    className={r.ok ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-[var(--sp-muted)]'}
                  >
                    {r.ok ? '✓' : '○'} {r.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                  Optional New Recovery Email
                </label>
                <input
                  type="email"
                  value={completeNewEmail}
                  onChange={(e) => setCompleteNewEmail(e.target.value)}
                  placeholder="new-email@example.com"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                  Optional New Phone Number
                </label>
                <input
                  type="tel"
                  value={completeNewPhone}
                  onChange={(e) => setCompleteNewPhone(e.target.value)}
                  placeholder="+639171234567"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Finalizing Recovery...' : 'Reset Password & Sign Out Other Sessions'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
