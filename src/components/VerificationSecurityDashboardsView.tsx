import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileSearch,
  Lock,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import {
  RecoveryStatus,
  SecurityAuditLogEntry,
  SecurityRole,
  SuspiciousActivityAlert,
  UserProfile,
} from '../types/social';
import {
  OfficerQueueRequest,
  PersonnelRosterItem,
  apiFetchPersonnelRoles,
  apiFetchSecurityAlerts,
  apiFetchSecurityAuditLogs,
  apiFetchVerificationQueue,
  apiSignRecoveryDocument,
  apiSubmitVerificationDecision,
  apiTriggerRetentionPurge,
  apiUpdatePersonnelRoles,
  apiUpdateSecurityAlert,
  apiVerifyAdminMfa,
} from '../utils/api';
import { RECOVERY_STATUS_META, RecoveryStatusBadge, SECURITY_ROLE_LABELS } from './SecurityHelpers';

interface VerificationSecurityDashboardsViewProps {
  currentUser: UserProfile;
  onRefreshBootstrap: () => Promise<void>;
}

type DeskTab = 'officer' | 'senior' | 'security_admin' | 'platform_admin';

const ALL_STATUS_FILTERS: Array<{ id: 'all' | RecoveryStatus; label: string }> = [
  { id: 'all', label: 'All Cases' },
  { id: 'pending_review', label: 'Pending Review' },
  { id: 'under_verification', label: 'Under Verification' },
  { id: 'additional_info_required', label: 'Additional Info Required' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'appeal_under_review', label: 'Appeal Under Review' },
  { id: 'recovery_completed', label: 'Recovery Completed' },
];

const ASSIGNABLE_ROLES: SecurityRole[] = [
  'regular_user',
  'verification_officer',
  'senior_reviewer',
  'security_admin',
  'platform_admin',
];

export const VerificationSecurityDashboardsView: React.FC<
  VerificationSecurityDashboardsViewProps
> = ({ currentUser, onRefreshBootstrap }) => {
  const roles = currentUser.securityRoles || ['regular_user'];
  const canOfficer = roles.includes('verification_officer') || roles.includes('senior_reviewer');
  const canSenior = roles.includes('senior_reviewer');
  const canSecurityAdmin = roles.includes('security_admin');
  const canPlatformAdmin = roles.includes('platform_admin');

  const defaultTab: DeskTab = canOfficer
    ? 'officer'
    : canSecurityAdmin
      ? 'security_admin'
      : 'platform_admin';

  const [tab, setTab] = useState<DeskTab>(defaultTab);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Officer / Senior Reviewer State
  const [statusFilter, setStatusFilter] = useState<'all' | RecoveryStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [adminMfaVerified, setAdminMfaVerified] = useState(false);
  const [mfaPromptCode, setMfaPromptCode] = useState('');
  const [queue, setQueue] = useState<OfficerQueueRequest[]>([]);
  const [selectedCase, setSelectedCase] = useState<OfficerQueueRequest | null>(null);
  const [signedPreview, setSignedPreview] = useState<{
    docUrl: string;
    expiresAt: number;
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [requestedInfoPrompt, setRequestedInfoPrompt] = useState('');
  const [issuedAuthReceipt, setIssuedAuthReceipt] = useState<{
    referenceNumber: string;
    recoveryAuthToken: string;
    expiresAt: string;
  } | null>(null);

  // Security Admin State
  const [alerts, setAlerts] = useState<SuspiciousActivityAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLogEntry[]>([]);
  const [chainIntegrity, setChainIntegrity] = useState<{
    valid: boolean;
    totalEntries: number;
    brokenAtSeq?: number;
  } | null>(null);
  const [auditEventFilter, setAuditEventFilter] = useState('all');

  // Platform Admin Role Roster State
  const [personnelQuery, setPersonnelQuery] = useState('');
  const [personnel, setPersonnel] = useState<PersonnelRosterItem[]>([]);

  const loadQueue = useCallback(async () => {
    if (!canOfficer) return;
    try {
      const effectiveStatus = tab === 'senior' && statusFilter === 'all' ? 'all' : statusFilter;
      const res = await apiFetchVerificationQueue({
        status: effectiveStatus,
        q: searchQuery,
      });
      setStats(res.stats);
      setAdminMfaVerified(res.adminMfaVerified);
      const list =
        tab === 'senior'
          ? res.requests.filter(
              (r) => r.status === 'appeal_under_review' || r.escalatedToSeniorReviewer || r.appeals.length > 0
            )
          : res.requests;
      setQueue(list);
      if (selectedCase) {
        const refreshed = res.requests.find((r) => r.referenceNumber === selectedCase.referenceNumber);
        if (refreshed) setSelectedCase(refreshed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch verification queue.');
    }
  }, [canOfficer, tab, statusFilter, searchQuery, selectedCase]);

  const loadSecurityAdminData = useCallback(async () => {
    if (!canSecurityAdmin) return;
    try {
      const [alertsRes, logsRes] = await Promise.all([
        apiFetchSecurityAlerts(),
        apiFetchSecurityAuditLogs(auditEventFilter),
      ]);
      setAlerts(alertsRes.alerts);
      setAuditLogs(logsRes.logs);
      setChainIntegrity(logsRes.chainIntegrity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch security logs & alerts.');
    }
  }, [canSecurityAdmin, auditEventFilter]);

  const loadPersonnel = useCallback(async () => {
    if (!canPlatformAdmin && !canSecurityAdmin) return;
    try {
      const res = await apiFetchPersonnelRoles(personnelQuery);
      setPersonnel(res.personnel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load personnel roster.');
    }
  }, [canPlatformAdmin, canSecurityAdmin, personnelQuery]);

  useEffect(() => {
    setError(null);
    if (tab === 'officer' || tab === 'senior') {
      void loadQueue();
    } else if (tab === 'security_admin') {
      void loadSecurityAdminData();
    } else if (tab === 'platform_admin') {
      void loadPersonnel();
    }
  }, [tab, loadQueue, loadSecurityAdminData, loadPersonnel]);

  if (!canOfficer && !canSecurityAdmin && !canPlatformAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="rounded-2xl bg-[var(--sp-surface)] border border-rose-500/40 p-6 text-center space-y-2">
          <Lock className="w-8 h-8 text-rose-500 mx-auto" />
          <h1 className="font-display text-xl font-bold text-[var(--sp-ink)]">
            Restricted Personnel Area
          </h1>
          <p className="text-xs text-[var(--sp-ink-2)]">
            Access is limited strictly to assigned Verification Officers, Senior Reviewers, Security Administrators, or Platform Administrators.
          </p>
        </div>
      </div>
    );
  }

  const handleSignDocument = async (referenceNumber: string, docId?: string) => {
    setError(null);
    setInfo(null);
    try {
      const res = await apiSignRecoveryDocument(referenceNumber, docId);
      setSignedPreview({ docUrl: res.signedUrl, expiresAt: res.expiresAt });
    } catch (err: unknown) {
      const typed = err as Error & { requiresAdminMfa?: boolean };
      if (typed.requiresAdminMfa) {
        setAdminMfaVerified(false);
      }
      setError(err instanceof Error ? err.message : 'Unable to unlock encrypted Gov ID.');
    }
  };

  const handleDecision = async (
    action: 'start_verification' | 'approve' | 'reject' | 'request_info' | 'escalate'
  ) => {
    if (!selectedCase) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await apiSubmitVerificationDecision(selectedCase.referenceNumber, {
        action,
        reason: rejectReason.trim() || undefined,
        note: decisionNote.trim() || undefined,
        requestedInfo: requestedInfoPrompt.trim() || undefined,
      });
      setSelectedCase(res.request);
      setRejectReason('');
      setDecisionNote('');
      setRequestedInfoPrompt('');
      if (res.recoveryAuthToken && res.recoveryAuthExpiresAt) {
        setIssuedAuthReceipt({
          referenceNumber: res.request.referenceNumber,
          recoveryAuthToken: res.recoveryAuthToken,
          expiresAt: res.recoveryAuthExpiresAt,
        });
      }
      setInfo(
        `Decision "${action.replace(/_/g, ' ')}" recorded cleanly for ${res.request.referenceNumber}.`
      );
      await loadQueue();
      await onRefreshBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to apply review decision.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono-code font-bold text-[var(--sp-accent-text)] uppercase">
            <ShieldCheck className="w-4 h-4" />
            <span>Sphere. Identity Verification &amp; Security Governance</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
            Restricted Verification &amp; Security Desk
          </h1>
          <p className="text-xs text-[var(--sp-ink-2)]">
            Signed in as <strong>{currentUser.name}</strong> · Roles:{' '}
            {roles.map((r) => SECURITY_ROLE_LABELS[r]).join(', ')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canOfficer && (
            <button
              type="button"
              onClick={() => {
                setTab('officer');
                setSelectedCase(null);
                setSignedPreview(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                tab === 'officer'
                  ? 'bg-[var(--sp-primary)] text-white'
                  : 'bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-[var(--sp-ink)]'
              }`}
            >
              <FileSearch className="w-3.5 h-3.5" />
              <span>Verification Officer</span>
            </button>
          )}
          {canSenior && (
            <button
              type="button"
              onClick={() => {
                setTab('senior');
                setSelectedCase(null);
                setSignedPreview(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                tab === 'senior'
                  ? 'bg-[var(--sp-primary)] text-white'
                  : 'bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-[var(--sp-ink)]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Senior Reviewer (Appeals)</span>
            </button>
          )}
          {canSecurityAdmin && (
            <button
              type="button"
              onClick={() => setTab('security_admin')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                tab === 'security_admin'
                  ? 'bg-[var(--sp-primary)] text-white'
                  : 'bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-[var(--sp-ink)]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Security Admin</span>
            </button>
          )}
          {canPlatformAdmin && (
            <button
              type="button"
              onClick={() => setTab('platform_admin')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                tab === 'platform_admin'
                  ? 'bg-[var(--sp-primary)] text-white'
                  : 'bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-[var(--sp-ink)]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Platform Admin (Roles)</span>
            </button>
          )}
        </div>
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

      {/* VIEW 1 & 2: VERIFICATION OFFICER & SENIOR REVIEWER DASHBOARDS */}
      {(tab === 'officer' || tab === 'senior') && canOfficer && (
        <div className="space-y-4">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {ALL_STATUS_FILTERS.map((f) => {
              const count = f.id === 'all' ? stats.total || 0 : stats[f.id] || 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-[var(--sp-primary-soft)] border-[var(--sp-primary)] text-[var(--sp-ink)]'
                      : 'bg-[var(--sp-surface)] border-[var(--sp-border)] text-[var(--sp-ink-2)]'
                  }`}
                >
                  <div className="font-mono-code text-lg font-extrabold text-[var(--sp-ink)]">
                    {count}
                  </div>
                  <div className="text-[10px] font-bold truncate">{f.label}</div>
                </button>
              );
            })}
          </div>

          {/* Admin MFA Guard Banner */}
          {!adminMfaVerified && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Administrative MFA Locked:</strong> Verify your 6-digit TOTP authenticator code (available in Account Security Settings) before viewing decrypted Government ID images.
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  try {
                    await apiVerifyAdminMfa(mfaPromptCode.trim());
                    setAdminMfaVerified(true);
                    setMfaPromptCode('');
                    setInfo('Administrative MFA unlocked for 30 minutes.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Invalid TOTP code.');
                  }
                }}
                className="flex gap-2 shrink-0"
              >
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={mfaPromptCode}
                  onChange={(e) => setMfaPromptCode(e.target.value)}
                  placeholder="6-digit TOTP"
                  className="w-32 px-3 py-1.5 text-xs font-mono-code rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[var(--sp-ink)]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold cursor-pointer"
                >
                  Unlock MFA
                </button>
              </form>
            </div>
          )}

          {issuedAuthReceipt && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 space-y-1.5 text-xs">
              <div className="font-bold text-emerald-800 dark:text-emerald-200">
                Separate Single-Use Recovery Authorization Token Issued ({issuedAuthReceipt.referenceNumber})
              </div>
              <div className="font-mono-code p-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] select-all">
                {issuedAuthReceipt.recoveryAuthToken}
              </div>
              <div className="text-[11px] text-[var(--sp-muted)]">
                Transmit securely to the verified account owner via authorized out-of-band channel. Expires{' '}
                {new Date(issuedAuthReceipt.expiresAt).toLocaleString()}.
              </div>
            </div>
          )}

          {/* Split Master/Detail Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Queue List */}
            <div className="lg:col-span-5 rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--sp-muted)] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reference (REC-...), handle, or legal name..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>

              <div className="space-y-2 max-h-[620px] overflow-y-auto">
                {queue.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--sp-muted)]">
                    No verification requests match the current filter.
                  </div>
                ) : (
                  queue.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedCase(item);
                        setSignedPreview(null);
                      }}
                      className={`w-full p-3 rounded-xl border text-left space-y-1.5 cursor-pointer transition-colors ${
                        selectedCase?.id === item.id
                          ? 'bg-[var(--sp-primary-soft)] border-[var(--sp-primary)]'
                          : 'bg-[var(--sp-surface-alt)] border-[var(--sp-border-subtle)] hover:border-[var(--sp-border)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-code text-xs font-extrabold text-[var(--sp-ink)]">
                          {item.referenceNumber}
                        </span>
                        <RecoveryStatusBadge status={item.status} />
                      </div>
                      <div className="text-xs font-bold text-[var(--sp-ink)] truncate">
                        {item.legalFullName} · {item.targetHandleOrId}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[var(--sp-muted)]">
                        <span>{item.idType}</span>
                        <span>
                          {item.screening.discrepancies.length > 0
                            ? `${item.screening.discrepancies.length} flag(s)`
                            : 'Clean screening'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Case Detail Inspector */}
            <div className="lg:col-span-7 rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5">
              {!selectedCase ? (
                <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center text-xs text-[var(--sp-muted)] space-y-2">
                  <FileSearch className="w-8 h-8 opacity-60" />
                  <div>Select a verification or appeal request on the left to inspect its details.</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[var(--sp-border-subtle)]">
                    <div>
                      <div className="font-mono-code text-lg font-extrabold text-[var(--sp-ink)]">
                        {selectedCase.referenceNumber}
                      </div>
                      <div className="text-xs text-[var(--sp-ink-2)]">
                        {selectedCase.purpose.replace(/_/g, ' ')} · Submitted{' '}
                        {new Date(selectedCase.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <RecoveryStatusBadge status={selectedCase.status} />
                  </div>

                  {/* Applicant & Account Identification */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)]">
                    <div>
                      <span className="text-[var(--sp-muted)] block">Full Legal Name:</span>
                      <strong className="text-[var(--sp-ink)]">{selectedCase.legalFullName}</strong>
                    </div>
                    <div>
                      <span className="text-[var(--sp-muted)] block">Date of Birth:</span>
                      <strong className="text-[var(--sp-ink)]">{selectedCase.dateOfBirth}</strong>
                    </div>
                    <div>
                      <span className="text-[var(--sp-muted)] block">Target Account Identifier:</span>
                      <strong className="text-[var(--sp-ink)]">
                        {selectedCase.targetHandleOrId}{' '}
                        {selectedCase.targetUserId ? `(Matched ID: ${selectedCase.targetUserId})` : '(Unmatched)'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--sp-muted)] block">Government ID Type:</span>
                      <strong className="text-[var(--sp-ink)]">{selectedCase.idType}</strong>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[var(--sp-muted)] block">Ownership Context:</span>
                      <span className="text-[var(--sp-ink)]">{selectedCase.ownershipContext}</span>
                    </div>
                  </div>

                  {/* Stage A Screening Summary */}
                  <div className="p-3.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-1.5 text-xs">
                    <div className="font-bold text-[var(--sp-ink)] flex items-center justify-between">
                      <span>Stage A Automated Screening (Advisory Only — Never Decides)</span>
                      <span className="font-mono-code text-[11px] text-[var(--sp-accent-text)]">
                        {selectedCase.screening.readabilityLabel} ({selectedCase.screening.readabilityScore}/100)
                      </span>
                    </div>
                    {selectedCase.screening.discrepancies.length > 0 ? (
                      <ul className="list-disc pl-4 text-amber-700 dark:text-amber-300 space-y-0.5">
                        {selectedCase.screening.discrepancies.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-emerald-600 dark:text-emerald-400">
                        No automated registration mismatches flagged.
                      </div>
                    )}
                  </div>

                  {/* Encrypted Gov ID Document Preview */}
                  <div className="p-3.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[var(--sp-ink)]">
                        Encrypted Government ID Document
                      </span>
                      {selectedCase.hasDocument ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleSignDocument(
                              selectedCase.referenceNumber,
                              selectedCase.documentRecordId
                            )
                          }
                          className="px-3.5 py-1.5 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Decrypt &amp; View ID (120s Signed URL)</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[var(--sp-muted)]">
                          Document purged from vault
                        </span>
                      )}
                    </div>

                    {signedPreview && (
                      <div className="space-y-1.5">
                        <img
                          src={signedPreview.docUrl}
                          alt="Encrypted Government ID preview"
                          className="max-h-72 rounded-xl border border-[var(--sp-border)] object-contain bg-black/5"
                        />
                        <div className="text-[10px] font-mono-code text-[var(--sp-muted)]">
                          Short-lived decrypted preview logged to immutable audit trail · Expires{' '}
                          {new Date(signedPreview.expiresAt).toLocaleTimeString()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Appeals History */}
                  {selectedCase.appeals.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2 text-xs">
                      <div className="font-bold text-purple-800 dark:text-purple-200">
                        Submitted Appeals (Senior Reviewer Authority Required)
                      </div>
                      {selectedCase.appeals.map((a) => (
                        <div key={a.id} className="p-2 rounded-lg bg-[var(--sp-surface)] space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold uppercase">{a.status}</span>
                            <span className="text-[var(--sp-muted)]">
                              {new Date(a.submittedAt).toLocaleString()}
                            </span>
                          </div>
                          <div>{a.explanation}</div>
                          {a.additionalDocumentId && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleSignDocument(
                                  selectedCase.referenceNumber,
                                  a.additionalDocumentId
                                )
                              }
                              className="text-[11px] font-bold text-[var(--sp-primary-text)] hover:underline cursor-pointer"
                            >
                              Decrypt Appeal Supporting Document
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reviewer Actions */}
                  <div className="p-4 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] space-y-3 text-xs">
                    <div className="font-bold text-[var(--sp-ink)]">Human Review Actions</div>
                    <input
                      type="text"
                      value={decisionNote}
                      onChange={(e) => setDecisionNote(e.target.value)}
                      placeholder="Reviewer notes (logged in review history)..."
                      className="w-full px-3 py-2 rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Mandatory reason if rejecting..."
                        className="px-3 py-2 rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      />
                      <input
                        type="text"
                        value={requestedInfoPrompt}
                        onChange={(e) => setRequestedInfoPrompt(e.target.value)}
                        placeholder="Details if requesting additional info..."
                        className="px-3 py-2 rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDecision('start_verification')}
                        className="px-3 py-2 rounded-lg bg-sky-600 text-white font-bold cursor-pointer"
                      >
                        Start Verification
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDecision('approve')}
                        className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer"
                      >
                        Approve Verification
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDecision('request_info')}
                        className="px-3 py-2 rounded-lg bg-orange-600 text-white font-bold cursor-pointer"
                      >
                        Request Additional Info
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDecision('reject')}
                        className="px-3 py-2 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
                      >
                        Reject (Requires Reason)
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDecision('escalate')}
                        className="px-3 py-2 rounded-lg bg-purple-600 text-white font-bold cursor-pointer"
                      >
                        Escalate to Senior Reviewer
                      </button>
                    </div>
                  </div>

                  {/* Review History */}
                  <div className="space-y-1.5 text-xs">
                    <div className="font-bold text-[var(--sp-ink)]">Audit &amp; Review History</div>
                    <div className="space-y-1 max-h-44 overflow-y-auto">
                      {selectedCase.reviewHistory.map((h) => (
                        <div
                          key={h.id}
                          className="p-2 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] text-[11px]"
                        >
                          <div className="font-bold text-[var(--sp-ink)]">
                            {h.action} — {h.actorName} ({h.actorRole})
                          </div>
                          {h.note && <div className="text-[var(--sp-ink-2)]">{h.note}</div>}
                          {h.reason && <div className="text-rose-600 dark:text-rose-300">Reason: {h.reason}</div>}
                          <div className="text-[10px] text-[var(--sp-muted)] font-mono-code">
                            {new Date(h.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: SECURITY ADMINISTRATOR DASHBOARD */}
      {tab === 'security_admin' && canSecurityAdmin && (
        <div className="space-y-5">
          {/* Integrity & Retention Purge Bar */}
          <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className={`w-5 h-5 ${
                  chainIntegrity?.valid ? 'text-emerald-500' : 'text-rose-500'
                }`}
              />
              <div>
                <div className="font-bold text-[var(--sp-ink)]">
                  Hash-Chained Audit Log Integrity:{' '}
                  {chainIntegrity?.valid ? 'VERIFIED (No Tampering)' : 'INTEGRITY WARNING'}
                </div>
                <div className="text-[11px] text-[var(--sp-muted)]">
                  {chainIntegrity?.totalEntries || 0} HMAC-linked security events recorded.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const res = await apiTriggerRetentionPurge(false);
                  setInfo(`Retention purge ran cleanly. ${res.purgedCount} expired ID document(s) deleted.`);
                }}
                className="px-3.5 py-2 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface-alt)] font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge Expired IDs</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await apiTriggerRetentionPurge(true);
                  setInfo(
                    `Purged ${res.purgedCount} closed/expired ID document(s) cleanly from the encrypted vault.`
                  );
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge Closed ID Docs Now</span>
              </button>
            </div>
          </div>

          {/* Suspicious Activity Alerts */}
          <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 space-y-3">
            <h2 className="font-display text-base font-bold text-[var(--sp-ink)] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Suspicious Activity Alerts ({alerts.length})</span>
            </h2>
            <div className="space-y-2 max-h-72 overflow-y-auto text-xs">
              {alerts.length === 0 ? (
                <div className="text-[var(--sp-muted)]">No suspicious activity alerts detected.</div>
              ) : (
                alerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-[var(--sp-ink)] flex items-center gap-2">
                        <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-300">
                          {al.severity}
                        </span>
                        <span>{al.category}</span>
                      </div>
                      <div className="text-[var(--sp-ink-2)]">{al.summary}</div>
                      <div className="text-[10px] font-mono-code text-[var(--sp-muted)]">
                        IP: {al.ipAddress} · {new Date(al.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(['open', 'investigating', 'resolved'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={async () => {
                            await apiUpdateSecurityAlert(al.id, { status: st });
                            await loadSecurityAdminData();
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            al.status === st
                              ? 'bg-[var(--sp-primary)] text-white'
                              : 'bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[var(--sp-ink-2)]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Security Audit Logs */}
          <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[var(--sp-ink)]">
                Immutable Security Audit Logs
              </h2>
              <select
                value={auditEventFilter}
                onChange={(e) => setAuditEventFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              >
                <option value="all">All Event Types</option>
                <option value="login_attempt">Login Attempts</option>
                <option value="password_reset_request">Password Reset Requests</option>
                <option value="password_change">Password Changes</option>
                <option value="otp_attempt">OTP Attempts</option>
                <option value="recovery_request_submission">Recovery Submissions</option>
                <option value="id_document_view">Encrypted ID Document Views</option>
                <option value="verification_decision">Verification Decisions</option>
                <option value="appeal_submission">Appeal Submissions</option>
                <option value="role_assignment_change">Role Assignments</option>
                <option value="suspicious_activity_alert">Blocked / Suspicious Attempts</option>
                <option value="retention_purge">ID Retention Purges</option>
              </select>
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto text-xs">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-[var(--sp-ink)]">
                      #{log.seq} · {log.eventType}{' '}
                      <span className="font-mono-code text-[10px] text-[var(--sp-primary-text)]">
                        [{log.outcome}]
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--sp-ink-2)]">{log.details}</div>
                  </div>
                  <div className="text-[10px] font-mono-code text-[var(--sp-muted)] text-right shrink-0">
                    <div>
                      actor: {log.actorId} ({log.actorRole})
                    </div>
                    <div>{new Date(log.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: PLATFORM ADMINISTRATOR (ROLE MANAGEMENT ONLY — NO ID ACCESS) */}
      {tab === 'platform_admin' && canPlatformAdmin && (
        <div className="rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-xs text-[var(--sp-ink-2)]">
            <strong>Strict Privacy Separation Enforced:</strong> Platform Administrators manage authorized personnel roles and operations, and cannot view encrypted Government ID documents or private user messages without explicit Verification Officer / Senior Reviewer authorization and MFA.
          </div>

          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-[var(--sp-muted)] absolute left-3 top-2.5" />
            <input
              type="text"
              value={personnelQuery}
              onChange={(e) => setPersonnelQuery(e.target.value)}
              placeholder="Search Sphere accounts to manage roles..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
          </div>

          <div className="space-y-2">
            {personnel.map((person) => (
              <div
                key={person.id}
                className="p-3.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-[var(--sp-ink)]">
                    {person.name} <span className="text-[var(--sp-muted)]">{person.handle}</span>
                  </div>
                  <div className="text-[11px] text-[var(--sp-muted)]">
                    {person.email || 'No email'} · MFA: {person.mfaEnabled ? 'Enabled' : 'Not enabled'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ASSIGNABLE_ROLES.map((roleOpt) => {
                    const checked = person.securityRoles.includes(roleOpt);
                    return (
                      <label
                        key={roleOpt}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] cursor-pointer text-[11px] font-semibold"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={roleOpt === 'regular_user'}
                          onChange={async () => {
                            const nextRoles = checked
                              ? person.securityRoles.filter((r) => r !== roleOpt)
                              : Array.from(new Set([...person.securityRoles, roleOpt]));
                            try {
                              await apiUpdatePersonnelRoles(person.id, nextRoles);
                              setInfo(`Updated security roles for ${person.handle}.`);
                              await loadPersonnel();
                              await onRefreshBootstrap();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Unable to update roles.');
                            }
                          }}
                          className="accent-[#4F46E5]"
                        />
                        <span>{SECURITY_ROLE_LABELS[roleOpt]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
