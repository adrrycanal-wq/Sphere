import React, { useState } from 'react';
import { Building2, HeartHandshake, MapPin, Plus, ShieldCheck } from 'lucide-react';
import { DonationDrive, UserProfile } from '../types/social';
import { apiCreateDonationDrive, apiPledgeDonation } from '../utils/api';
import { ImageWithFallback } from './Media';

interface DonationDrivesViewProps {
  currentUser: UserProfile;
  drives: DonationDrive[];
  onRefresh: () => Promise<void>;
  onOpenSphereId: () => void;
}

export const DonationDrivesView: React.FC<DonationDrivesViewProps> = ({
  currentUser,
  drives,
  onRefresh,
  onOpenSphereId,
}) => {
  const isVerifiedGovOrg =
    currentUser.sphereIdCategory === 'verified_organization' &&
    Boolean(currentUser.govRegNumber);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(currentUser.location);
  const [category, setCategory] = useState<DonationDrive['category']>('Disaster Relief');
  const [goalAmountPhp, setGoalAmountPhp] = useState(50000);
  const [error, setError] = useState<string | null>(null);

  const [pledgeDriveId, setPledgeDriveId] = useState<string | null>(null);
  const [pledgeAmount, setPledgeAmount] = useState(500);
  const [pledgeNote, setPledgeNote] = useState('');

  const handleCreateDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiCreateDonationDrive({
        organizerId: currentUser.id,
        title,
        description,
        location,
        category,
        goalAmountPhp,
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create Aid Drive.');
    }
  };

  const handlePledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pledgeDriveId) return;
    setError(null);
    try {
      await apiPledgeDonation(pledgeDriveId, currentUser.id, pledgeAmount, pledgeNote);
      setPledgeDriveId(null);
      setPledgeNote('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record pledge.');
    }
  };

  return (
    <div className="space-y-5">
      <section className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono-code font-semibold text-[var(--sp-accent-text)] uppercase flex items-center gap-1.5">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Verified Aid Drives · Anti-Corruption Ledger</span>
          </div>
          <h1 className="font-display text-xl font-extrabold text-[var(--sp-ink)] mt-0.5">
            Government-Registered Civic &amp; Relief Drives
          </h1>
          <p className="text-xs text-[var(--sp-muted)] mt-0.5 max-w-2xl">
            To prevent fraud and corruption, only Sphere ID Verified Government-Registered Organizations (with verified agency &amp; registration number) can launch Aid Drives.
          </p>
        </div>

        {isVerifiedGovOrg ? (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Launch Aid Drive</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenSphereId}
            className="px-4 py-2 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] text-xs font-semibold text-[var(--sp-primary-text)] shrink-0 cursor-pointer"
          >
            Register Gov Organization via Sphere ID →
          </button>
        )}
      </section>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {showCreate && isVerifiedGovOrg && (
        <form
          onSubmit={handleCreateDrive}
          className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-3"
        >
          <h2 className="font-display text-base font-bold text-[var(--sp-ink)]">
            New Verified Organization Aid Drive
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Aid Drive title"
              className="px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DonationDrive['category'])}
              className="px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            >
              <option>Disaster Relief</option>
              <option>Food &amp; Nutrition</option>
              <option>Medical Aid</option>
              <option>Education &amp; Youth</option>
              <option>Livelihood</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Target municipality / area"
              className="px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
            <input
              type="number"
              min={1000}
              step={500}
              value={goalAmountPhp}
              onChange={(e) => setGoalAmountPhp(Number(e.target.value))}
              className="px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
          </div>
          <textarea
            rows={3}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe beneficiaries, item breakdown, and distribution schedule..."
            className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 rounded-lg border border-[var(--sp-border)] text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#06B6D4] text-slate-950 text-xs font-bold cursor-pointer"
            >
              Publish Verified Aid Drive
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {drives.map((drive) => {
          const pct = Math.min(100, Math.round((drive.raisedAmountPhp / drive.goalAmountPhp) * 100));
          return (
            <article
              key={drive.id}
              className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl overflow-hidden flex flex-col justify-between"
            >
              {drive.coverImage && (
                <div className="h-44 overflow-hidden">
                  <ImageWithFallback
                    src={drive.coverImage}
                    alt={drive.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-5 space-y-3 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-mono-code font-bold text-[var(--sp-accent-text)] inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {drive.govAgency} · {drive.govRegNumber}
                  </span>
                  <span className="text-[11px] text-[var(--sp-muted)]">{drive.category}</span>
                </div>

                <h2 className="font-display text-lg font-extrabold text-[var(--sp-ink)]">
                  {drive.title}
                </h2>
                <div className="text-xs text-[var(--sp-ink-2)] flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[var(--sp-primary-text)]" />
                    {drive.organizerName}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[var(--sp-accent-text)]" />
                    {drive.location}
                  </span>
                </div>
                <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">{drive.description}</p>

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-mono-code tabular-nums">
                    <strong className="text-[var(--sp-ink)]">
                      ₱{drive.raisedAmountPhp.toLocaleString()} raised
                    </strong>
                    <span className="text-[var(--sp-muted)]">
                      Goal: ₱{drive.goalAmountPhp.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--sp-surface-alt)] overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-[#06B6D4] rounded-full"
                    />
                  </div>
                </div>

                {/* Pledge Form or Button */}
                {pledgeDriveId === drive.id ? (
                  <form
                    onSubmit={handlePledge}
                    className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] space-y-2"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={50}
                        step={50}
                        value={pledgeAmount}
                        onChange={(e) => setPledgeAmount(Number(e.target.value))}
                        className="px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      />
                      <input
                        type="text"
                        value={pledgeNote}
                        onChange={(e) => setPledgeNote(e.target.value)}
                        placeholder="Short note of support..."
                        className="px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPledgeDriveId(null)}
                        className="px-3 py-1 text-xs rounded-lg border border-[var(--sp-border)] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs font-bold rounded-lg bg-[var(--sp-primary)] text-white cursor-pointer"
                      >
                        Record Public Pledge
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPledgeDriveId(drive.id)}
                    className="w-full py-2 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold cursor-pointer"
                  >
                    Pledge Support
                  </button>
                )}

                {/* Public Contribution Ledger */}
                <div className="pt-2 border-t border-[var(--sp-border-subtle)] space-y-1.5">
                  <div className="text-[11px] font-bold text-[var(--sp-muted)] uppercase">
                    Public Contribution Ledger ({drive.pledges.length})
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {drive.pledges.map((pl) => (
                      <div
                        key={pl.id}
                        className="text-[11px] flex items-center justify-between gap-2 text-[var(--sp-ink-2)]"
                      >
                        <span className="truncate">
                          <strong>{pl.donorName}</strong> — {pl.note}
                        </span>
                        <span className="font-mono-code font-bold text-[var(--sp-accent-text)] shrink-0 tabular-nums">
                          ₱{pl.amountPhp.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
