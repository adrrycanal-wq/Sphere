import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Copy,
  FileBadge2,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  ShieldCheck,
  Smartphone,
  Upload,
} from 'lucide-react';
import {
  ActiveSessionRecord,
  GovIdType,
  LoginActivityRecord,
  RecoveryStatus,
  UserProfile,
  UserSecuritySummary,
} from '../types/social';
import {
  apiChangePassword,
  apiFetchSecurityOverview,
  apiGetMfaSetup,
  apiRevokeOtherSessions,
  apiRevokeSession,
  apiSubmitGovIdRecovery,
  apiToggleMfa,
  apiUpdateSecurityContact,
  apiVerifyAdminMfa,
} from '../utils/api';
import {
  PHILIPPINE_GOV_IDS,
  Ra10173NoticeBox,
  RecoveryStatusBadge,
  SECURITY_ROLE_LABELS,
  evaluateRecoveryPassword,
  fileToDataUrl,
} from './SecurityHelpers';

interface AccountSecuritySettingsViewProps {
  currentUser: UserProfile;
  onRefreshBootstrap: () => Promise<void>;
  onOpenRecoveryTracker: (refNumber: string) => void;
  onOpenRestrictedDashboard?: () => void;
}

export const AccountSecuritySettingsView: React.FC<AccountSecuritySettingsViewProps> = ({
  currentUser,
  onRefreshBootstrap,
  onOpenRecoveryTracker,
  onOpenRestrictedDashboard,
}) => {
  const [summary, setSummary] = useState<UserSecuritySummary | null>(null);
  const [sessions, setSessions] = useState<ActiveSessionRecord[]>([]);
  const [loginActivity, setLoginActivity] = useState<LoginActivityRecord[]>([]);
  const [identityRequests, setIdentityRequests] = useState<
    Array<{
      id: string;
      referenceNumber: string;
      purpose: 'account_recovery' | 'hybrid_identity_verification';
      idType: GovIdType;
      status: RecoveryStatus;
      requestedAdditionalInfo?: string;
      rejectionReason?: string;
      documentRetainUntil: string;
      documentDeletedAt?: string;
      createdAt: string;
      updatedAt: string;
    }>
  >([]);

  const [mfaSetup, setMfaSetup] = useState<{
    mfaEnabled: boolean;
    mfaMethod: string;
    totpSecret: string;
    otpauthUrl: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Password Change
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const pwEval = useMemo(
    () =>
      evaluateRecoveryPassword(newPw, [
        currentUser.name,
        currentUser.handle.replace(/^@/, ''),
      ]),
    [newPw, currentUser.name, currentUser.handle]
  );

  // Contacts & Notifications
  const [emailInput, setEmailInput] = useState(currentUser.email || '');
  const [mobileInput, setMobileInput] = useState(currentUser.mobile || '');
  const [backupEmail, setBackupEmail] = useState(currentUser.recoveryEmailBackup || '');
  const [securityNotifs, setSecurityNotifs] = useState(true);

  // MFA Code Input
  const [totpCodeInput, setTotpCodeInput] = useState('');
  const [adminMfaCode, setAdminMfaCode] = useState('');

  // Optional Hybrid ID Verification form
  const [showHybridForm, setShowHybridForm] = useState(false);
  const [hybridLegalName, setHybridLegalName] = useState(currentUser.name);
  const [hybridDob, setHybridDob] = useState(currentUser.birthday || '1998-06-15');
  const [hybridIdType, setHybridIdType] = useState<GovIdType>('PhilSys National ID');
  const [hybridPrivacyOk, setHybridPrivacyOk] = useState(false);
  const [hybridFile, setHybridFile] = useState<{
    name: string;
    mimeType: string;
    dataBase64: string;
    sizeBytes: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, mfa] = await Promise.all([
        apiFetchSecurityOverview(),
        apiGetMfaSetup(),
      ]);
      setSummary(overview.summary);
      setSessions(overview.sessions);
      setLoginActivity(overview.loginActivity);
      setIdentityRequests(overview.identityRequests);
      setEmailInput(overview.summary.registeredEmail || '');
      setMobileInput(overview.summary.registeredPhone || '');
      setBackupEmail(overview.summary.recoveryEmailBackup || '');
      setSecurityNotifs(overview.summary.securityNotificationsEnabled);
      setMfaSetup(mfa);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Sign in with an active server session to manage full Account Security Settings.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!pwEval.allPassed) {
      setError('New password must satisfy all 6 strength requirements.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiChangePassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setInfo(res.message);
      await loadData();
      await onRefreshBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateContacts = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await apiUpdateSecurityContact({
        email: emailInput.trim() || undefined,
        mobile: mobileInput.trim() || undefined,
        recoveryEmailBackup: backupEmail.trim(),
        securityNotificationsEnabled: securityNotifs,
      });
      setInfo(
        res.changedFields.length > 0
          ? `Updated security contacts: ${res.changedFields.join(', ')}.`
          : 'Security contact preferences confirmed.'
      );
      await loadData();
      await onRefreshBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save recovery contacts.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleMfa = async (enable: boolean) => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await apiToggleMfa(enable, totpCodeInput.trim());
      setTotpCodeInput('');
      setInfo(
        res.mfaEnabled
          ? 'Two-factor authentication (TOTP) is now ENABLED on your account.'
          : 'Two-factor authentication (TOTP) was disabled.'
      );
      await loadData();
      await onRefreshBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid authenticator code.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminMfaUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await apiVerifyAdminMfa(adminMfaCode.trim());
      setAdminMfaCode('');
      setInfo('Administrative MFA unlocked for 30 minutes on this session.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Administrative MFA verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitHybridId = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!hybridFile) {
      setError('Select a JPEG, PNG, or WebP Philippine Government ID image.');
      return;
    }
    if (!hybridPrivacyOk) {
      setError('Please acknowledge the RA 10173 Data Privacy Notice.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiSubmitGovIdRecovery({
        targetHandleOrId: currentUser.handle,
        purpose: 'hybrid_identity_verification',
        legalFullName: hybridLegalName.trim(),
        dateOfBirth: hybridDob,
        idType: hybridIdType,
        ownershipContext: 'Voluntary Hybrid Identity Verification submission from Account Security Settings.',
        privacyConsentAccepted: hybridPrivacyOk,
        fileName: hybridFile.name,
        mimeType: hybridFile.mimeType,
        dataBase64: hybridFile.dataBase64,
      });
      setShowHybridForm(false);
      setHybridFile(null);
      setInfo(`Hybrid identity verification submitted cleanly! Reference: ${res.referenceNumber}`);
      await loadData();
      await onRefreshBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit hybrid identity verification.');
    } finally {
      setBusy(false);
    }
  };

  const isStaff = (summary?.securityRoles || []).some((r) => r !== 'regular_user');

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono-code font-bold text-[var(--sp-primary-text)] uppercase">
            <Lock className="w-4 h-4" />
            <span>Account Security &amp; Hybrid Identity Center</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
            Security Settings for {currentUser.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {(summary?.securityRoles || ['regular_user']).map((r) => (
              <span
                key={r}
                className="px-2.5 py-0.5 rounded-full bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] font-semibold text-[var(--sp-ink-2)]"
              >
                {SECURITY_ROLE_LABELS[r]}
              </span>
            ))}
          </div>
        </div>
        {isStaff && onOpenRestrictedDashboard && (
          <button
            type="button"
            onClick={onOpenRestrictedDashboard}
            className="px-4 py-2 rounded-xl bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold inline-flex items-center gap-1.5 self-start shrink-0 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Open Identity &amp; Security Desk</span>
          </button>
        )}
      </div>

      {info && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{info}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-xs text-[var(--sp-muted)]">
          Loading security overview...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT COLUMN: PASSWORD, RECOVERY CONTACTS, MFA */}
          <div className="lg:col-span-7 space-y-5">
            {/* Change Password */}
            <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 space-y-3">
              <h2 className="font-display text-base font-bold text-[var(--sp-ink)] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[var(--sp-primary-text)]" />
                <span>Change Account Password</span>
              </h2>
              <form onSubmit={handleChangePassword} className="space-y-3">
                {summary?.hasPasswordSet && (
                  <div>
                    <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                    New Strong Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {pwEval.rules.map((r) => (
                    <div
                      key={r.label}
                      className={
                        r.ok
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'text-[var(--sp-muted)]'
                      }
                    >
                      {r.ok ? '✓' : '○'} {r.label}
                    </div>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 rounded-xl bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  Update Password &amp; Sign Out Other Devices
                </button>
              </form>
            </div>

            {/* Registered Email, Phone & Backup Recovery */}
            <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 space-y-3">
              <h2 className="font-display text-base font-bold text-[var(--sp-ink)] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[var(--sp-accent-text)]" />
                <span>Registered Recovery Contacts &amp; Security Alerts</span>
              </h2>
              <form onSubmit={handleUpdateContacts} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                      Registered Email
                    </label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                      Registered Phone Number
                    </label>
                    <input
                      type="tel"
                      value={mobileInput}
                      onChange={(e) => setMobileInput(e.target.value)}
                      placeholder="+639171234567"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--sp-ink-2)] mb-1">
                    Backup Recovery Email (optional secondary contact)
                  </label>
                  <input
                    type="email"
                    value={backupEmail}
                    onChange={(e) => setBackupEmail(e.target.value)}
                    placeholder="backup-email@example.com"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--sp-ink)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={securityNotifs}
                    onChange={(e) => setSecurityNotifs(e.target.checked)}
                    className="accent-[#4F46E5]"
                  />
                  <span>Receive security notifications on password changes, logins, and recovery status updates</span>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface-alt)] hover:border-[var(--sp-primary)] text-xs font-bold text-[var(--sp-ink)] cursor-pointer"
                >
                  Save Contact &amp; Notification Settings
                </button>
              </form>
            </div>

            {/* Two-Factor Authentication (TOTP MFA) */}
            <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-[var(--sp-ink)] flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  <span>Two-Factor Authentication (RFC 6238 Authenticator App)</span>
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    mfaSetup?.mfaEnabled
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-500/10 text-[var(--sp-muted)] border-[var(--sp-border)]'
                  }`}
                >
                  {mfaSetup?.mfaEnabled ? 'MFA Enabled' : 'MFA Disabled'}
                </span>
              </div>

              {mfaSetup && (
                <div className="p-3.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-2 text-xs">
                  <div className="font-semibold text-[var(--sp-ink)]">
                    Authenticator Setup Secret Key (Google Authenticator / Authy / Bitwarden):
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] font-mono-code text-xs">
                    <span className="truncate">{mfaSetup.totpSecret}</span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(mfaSetup.totpSecret);
                        setInfo('Copied TOTP secret key to clipboard.');
                      }}
                      className="px-2 py-1 rounded bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <input
                      type="text"
                      maxLength={6}
                      value={totpCodeInput}
                      onChange={(e) => setTotpCodeInput(e.target.value)}
                      placeholder="Enter 6-digit code to toggle MFA"
                      className="flex-1 px-3 py-2 text-xs font-mono-code rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                    />
                    <button
                      type="button"
                      disabled={busy || totpCodeInput.trim().length < 6}
                      onClick={() => void handleToggleMfa(!mfaSetup.mfaEnabled)}
                      className="px-4 py-2 rounded-xl bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {mfaSetup.mfaEnabled ? 'Disable 2FA' : 'Verify & Enable 2FA'}
                    </button>
                  </div>
                </div>
              )}

              {isStaff && (
                <form
                  onSubmit={handleAdminMfaUnlock}
                  className="pt-3 border-t border-[var(--sp-border-subtle)] space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--sp-ink)]">
                      Staff Administrative MFA Session Unlock
                    </span>
                    <span className="font-mono-code text-[11px] text-[var(--sp-accent-text)]">
                      {summary?.adminMfaVerified ? 'Unlocked (30m active)' : 'Locked'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={adminMfaCode}
                      onChange={(e) => setAdminMfaCode(e.target.value)}
                      placeholder="6-digit TOTP for encrypted ID review access"
                      className="flex-1 px-3 py-2 text-xs font-mono-code rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-4 py-2 rounded-xl bg-[#06B6D4] text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Unlock Session
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: HYBRID ID STATUS, ACTIVE SESSIONS, LOGIN ACTIVITY */}
          <div className="lg:col-span-5 space-y-5">
            {/* Hybrid Identity Verification Policy */}
            <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-[var(--sp-ink)] flex items-center gap-2">
                  <FileBadge2 className="w-4 h-4 text-[var(--sp-primary-text)]" />
                  <span>Hybrid Identity Verification</span>
                </h2>
                <span className="text-[11px] font-mono-code font-bold text-[var(--sp-accent-text)] uppercase">
                  {summary?.identityVerificationStatus?.replace(/_/g, ' ') || 'not submitted'}
                </span>
              </div>
              <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
                Sphere uses a <strong>Hybrid Identity Verification Policy</strong>: government IDs are never required for ordinary sign-up, and remain strictly optional for identity verification or emergency recovery.
              </p>

              <button
                type="button"
                onClick={() => setShowHybridForm((v) => !v)}
                className="px-4 py-2 rounded-xl bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)] text-xs font-bold cursor-pointer"
              >
                {showHybridForm ? 'Hide Verification Form' : 'Submit Optional Philippine Government ID'}
              </button>

              {showHybridForm && (
                <form onSubmit={handleSubmitHybridId} className="pt-2 space-y-3 border-t border-[var(--sp-border-subtle)]">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--sp-ink-2)] mb-1">
                      Full Legal Name
                    </label>
                    <input
                      type="text"
                      required
                      value={hybridLegalName}
                      onChange={(e) => setHybridLegalName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--sp-ink-2)] mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        required
                        value={hybridDob}
                        onChange={(e) => setHybridDob(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--sp-ink-2)] mb-1">
                        ID Type
                      </label>
                      <select
                        value={hybridIdType}
                        onChange={(e) => setHybridIdType(e.target.value as GovIdType)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      >
                        {PHILIPPINE_GOV_IDS.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-[var(--sp-border)] bg-[var(--sp-surface-alt)] text-xs cursor-pointer">
                    <Upload className="w-4 h-4 text-[var(--sp-primary-text)]" />
                    <span className="truncate">
                      {hybridFile ? hybridFile.name : 'Choose Government ID image (JPEG/PNG/WebP)'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const dataBase64 = await fileToDataUrl(f);
                        setHybridFile({
                          name: f.name,
                          mimeType: f.type,
                          dataBase64,
                          sizeBytes: f.size,
                        });
                      }}
                      className="hidden"
                    />
                  </label>
                  <Ra10173NoticeBox accepted={hybridPrivacyOk} onChange={setHybridPrivacyOk} />
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2 rounded-xl bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer"
                  >
                    Encrypt &amp; Submit Verification
                  </button>
                </form>
              )}

              {identityRequests.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[var(--sp-border-subtle)]">
                  <div className="text-xs font-bold text-[var(--sp-ink)]">
                    Your Verification &amp; Recovery History
                  </div>
                  {identityRequests.map((reqItem) => (
                    <div
                      key={reqItem.id}
                      className="p-2.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-mono-code font-bold text-[var(--sp-ink)]">
                          {reqItem.referenceNumber}
                        </div>
                        <div className="text-[11px] text-[var(--sp-muted)] truncate">
                          {reqItem.idType} · {reqItem.purpose.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <RecoveryStatusBadge status={reqItem.status} />
                        <button
                          type="button"
                          onClick={() => onOpenRecoveryTracker(reqItem.referenceNumber)}
                          className="text-[11px] font-bold text-[var(--sp-primary-text)] hover:underline cursor-pointer"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Sessions & Revoke Other Devices */}
            <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-[var(--sp-ink)] flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-[var(--sp-accent-text)]" />
                  <span>Active Sessions ({sessions.length})</span>
                </h2>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await apiRevokeOtherSessions();
                      setInfo(`Signed out ${res.revokedCount} other active session(s).`);
                      await loadData();
                    }}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Revoke Other Devices
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[var(--sp-ink)] truncate">
                        {s.deviceLabel} {s.current && <span className="text-emerald-600">(Current)</span>}
                      </div>
                      <div className="text-[10px] text-[var(--sp-muted)] font-mono-code">
                        {s.ipAddress} · {new Date(s.lastActiveAt).toLocaleString()}
                      </div>
                    </div>
                    {!s.current && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRevokeSession(s.id);
                          await loadData();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Revoke</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Login Activity */}
            <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 space-y-3">
              <h2 className="font-display text-base font-bold text-[var(--sp-ink)] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[var(--sp-primary-text)]" />
                <span>Recent Login Activity</span>
              </h2>
              <div className="space-y-1.5 max-h-56 overflow-y-auto text-xs">
                {loginActivity.length === 0 ? (
                  <div className="text-[var(--sp-muted)]">No login events recorded yet.</div>
                ) : (
                  loginActivity.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--sp-ink)] truncate">
                          {log.method} · {log.deviceLabel}
                        </div>
                        <div className="text-[10px] text-[var(--sp-muted)] font-mono-code">
                          {log.ipAddress} · {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          log.outcome === 'success'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                        }`}
                      >
                        {log.outcome}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
