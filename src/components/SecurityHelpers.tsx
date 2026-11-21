import React from 'react';
import { GovIdType, RecoveryStatus, SecurityRole } from '../types/social';

export const PHILIPPINE_GOV_IDS: {
  id: GovIdType;
  label: string;
  issuingAgency: string;
}[] = [
  { id: 'PhilSys National ID', label: 'PhilSys National ID (PhilID / ePhilID)', issuingAgency: 'Philippine Statistics Authority' },
  { id: 'Philippine Passport', label: 'Philippine Passport', issuingAgency: 'Department of Foreign Affairs' },
  { id: "Driver's License", label: "Driver's License", issuingAgency: 'Land Transportation Office' },
  { id: 'UMID', label: 'Unified Multi-Purpose ID (UMID)', issuingAgency: 'SSS / GSIS / Pag-IBIG / PhilHealth' },
  { id: 'SSS ID', label: 'SSS ID', issuingAgency: 'Social Security System' },
  { id: 'PRC ID', label: 'PRC Professional ID', issuingAgency: 'Professional Regulation Commission' },
];

export const RECOVERY_STATUS_META: Record<
  RecoveryStatus,
  { label: string; badgeClass: string; description: string }
> = {
  pending_review: {
    label: 'Pending Review',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    description: 'Queued for manual inspection by an authorized Verification Officer.',
  },
  under_verification: {
    label: 'Under Verification',
    badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    description: 'Currently under active human identity verification review.',
  },
  additional_info_required: {
    label: 'Additional Information Required',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
    description: 'Reviewer requested clarification or a clearer supporting document.',
  },
  approved: {
    label: 'Approved',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    description: 'Identity verified. Proceed with the separate recovery authorization step if recovering access.',
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    description: 'Request was not approved. You may review the reason and submit an appeal.',
  },
  appeal_under_review: {
    label: 'Appeal Under Review',
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    description: 'Escalated appeal is being reviewed by a Senior Reviewer.',
  },
  recovery_completed: {
    label: 'Recovery Completed',
    badgeClass: 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-200 border-emerald-500/40',
    description: 'Account credentials were safely reset and prior device sessions were revoked.',
  },
};

export function RecoveryStatusBadge({ status }: { status: RecoveryStatus }) {
  const meta = RECOVERY_STATUS_META[status] || RECOVERY_STATUS_META.pending_review;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
}

export const SECURITY_ROLE_LABELS: Record<SecurityRole, string> = {
  regular_user: 'Regular User',
  verification_officer: 'Verification Officer',
  senior_reviewer: 'Senior Reviewer',
  security_admin: 'Security Administrator',
  platform_admin: 'Platform Administrator',
};

export function evaluateRecoveryPassword(password: string, personalTokens: string[] = []) {
  const lower = password.toLowerCase();
  const hasPersonal = personalTokens.some(
    (t) => t.trim().length >= 3 && lower.includes(t.trim().toLowerCase())
  );
  const rules = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase & lowercase letters', ok: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'At least one number (0–9)', ok: /[0-9]/.test(password) },
    { label: 'At least one special character (!@#$%...)', ok: /[^A-Za-z0-9]/.test(password) },
    { label: 'No spaces', ok: password.length > 0 && !/\s/.test(password) },
    { label: 'No name or @handle included', ok: password.length > 0 && !hasPersonal },
  ];
  const passed = rules.filter((r) => r.ok).length;
  return { rules, passed, allPassed: passed === rules.length };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read selected image file.'));
    reader.readAsDataURL(file);
  });
}

export const Ra10173NoticeBox: React.FC<{
  accepted: boolean;
  onChange: (checked: boolean) => void;
}> = ({ accepted, onChange }) => (
  <div className="p-3.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] space-y-2.5 text-xs">
    <div className="font-bold text-[var(--sp-ink)] flex items-center justify-between gap-2">
      <span>Data Privacy Notice (Republic Act No. 10173 — Philippine Data Privacy Act of 2012)</span>
      <span className="font-mono-code text-[10px] text-[var(--sp-accent-text)]">RA 10173 v2026.1</span>
    </div>
    <p className="text-[11px] text-[var(--sp-ink-2)] leading-relaxed">
      Sphere collects your legal name, date of birth, and government-issued ID image strictly for lawful identity
      verification or account recovery when email/phone recovery is unavailable. Your ID image is encrypted at rest
      using AES-256-GCM inside an isolated vault, accessible only to explicitly authorized Verification Officers or
      Senior Reviewers (never to ordinary admins or moderators), is never publicly displayed, never sold, and is
      automatically purged after the retention period expires.
    </p>
    <label className="flex items-start gap-2 cursor-pointer text-[11px] font-semibold text-[var(--sp-ink)]">
      <input
        type="checkbox"
        checked={accepted}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[#4F46E5]"
      />
      <span>
        I consent to the encrypted processing of my verification details under RA 10173 strictly for account
        ownership verification and security auditing.
      </span>
    </label>
  </div>
);
