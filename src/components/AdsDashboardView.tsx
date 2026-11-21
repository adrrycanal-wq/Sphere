import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Megaphone,
  PauseCircle,
  ShieldAlert,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  AdCampaign,
  AdObjective,
  AdStatus,
  SocialPost,
  UserProfile,
} from '../types/social';
import { apiCreateAdCampaign, apiModerateAd } from '../utils/api';

interface AdsDashboardViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  posts: SocialPost[];
  adCampaigns: AdCampaign[];
  initialBoostPostId?: string;
  onRefresh: () => Promise<void>;
}

export const AdsDashboardView: React.FC<AdsDashboardViewProps> = ({
  currentUser,
  users,
  posts,
  adCampaigns,
  initialBoostPostId,
  onRefresh,
}) => {
  const myPosts = useMemo(
    () => posts.filter((p) => p.authorId === currentUser.id),
    [posts, currentUser.id]
  );

  const [selectedPostId, setSelectedPostId] = useState(
    initialBoostPostId || myPosts[0]?.id || ''
  );
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState<AdObjective>('reach');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [countriesText, setCountriesText] = useState(currentUser.country || 'Philippines');
  const [locationsText, setLocationsText] = useState('Labo, Daet, Camarines Norte');
  const [interestsText, setInterestsText] = useState('Local Food, Artisan Baking, Design');
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(60);
  const [dailyBudgetPhp, setDailyBudgetPhp] = useState(300);
  const [durationDays, setDurationDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const estMin = Math.round(dailyBudgetPhp * durationDays * 0.55);
  const estMax = Math.round(dailyBudgetPhp * durationDays * 1.35);

  const isAdmin = currentUser.role === 'admin';
  const myCampaigns = adCampaigns.filter((c) => c.advertiserId === currentUser.id);
  const moderationQueue = adCampaigns.filter((c) => c.status === 'pending_review');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPostId) {
      setError('Select one of your posts to boost.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await apiCreateAdCampaign({
        advertiserId: currentUser.id,
        postId: selectedPostId,
        title: title.trim() || 'Boosted Sphere Post',
        objective,
        destinationUrl: objective === 'traffic' ? destinationUrl : undefined,
        targetCountries: countriesText.split(',').map((s) => s.trim()).filter(Boolean),
        targetLocations: locationsText.split(',').map((s) => s.trim()).filter(Boolean),
        targetInterests: interestsText.split(',').map((s) => s.trim()).filter(Boolean),
        targetAgeMin: ageMin,
        targetAgeMax: ageMax,
        dailyBudgetPhp,
        durationDays,
      });
      setTitle('');
      setSuccessMsg(
        'Campaign submitted to the moderation queue (Status: pending review · Billing: awaiting payment setup).'
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModerate = async (adId: string, status: AdStatus) => {
    setError(null);
    try {
      await apiModerateAd(
        adId,
        currentUser.id,
        status,
        status === 'approved' ? 'Approved under Sphere Community Guidelines.' : `Updated to ${status}.`
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Moderation failed.');
    }
  };

  return (
    <div className="space-y-5">
      <section className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-mono-code font-semibold text-[var(--sp-accent-text)] uppercase flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5" />
              <span>Sphere. Ads Manager</span>
            </div>
            <h1 className="font-display text-xl font-extrabold text-[var(--sp-ink)] mt-0.5">
              Promoted Posts &amp; Transparent Campaigns
            </h1>
            <p className="text-xs text-[var(--sp-muted)] mt-0.5">
              Boost posts to relevant locations and interests. All ads require admin moderation approval before appearing labeled “Sponsored” in Pulse.
            </p>
          </div>
          <div className="text-xs font-mono-code px-3 py-1.5 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-[var(--sp-ink-2)]">
            Billing Status: awaiting_payment_setup
          </div>
        </div>
      </section>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Create Boost Campaign */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-3.5 h-fit"
        >
          <h2 className="font-display text-base font-bold text-[var(--sp-ink)]">
            Boost an Existing Post
          </h2>

          <div>
            <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
              Select Your Post
            </label>
            <select
              value={selectedPostId}
              onChange={(e) => setSelectedPostId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            >
              {myPosts.length === 0 ? (
                <option value="">Publish a post first to boost it</option>
              ) : (
                myPosts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.content.slice(0, 65)}...
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
              Campaign Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Labo Weekend Pasalubong Promo"
              className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['reach', 'engagement', 'traffic'] as AdObjective[]).map((obj) => (
              <button
                key={obj}
                type="button"
                onClick={() => setObjective(obj)}
                className={`py-2 px-2 rounded-lg text-xs font-semibold capitalize border cursor-pointer ${
                  objective === obj
                    ? 'bg-[var(--sp-primary)] text-white border-[var(--sp-primary)]'
                    : 'bg-[var(--sp-surface-alt)] border-[var(--sp-border)] text-[var(--sp-ink-2)]'
                }`}
              >
                {obj === 'traffic' ? 'Web Traffic' : obj}
              </button>
            ))}
          </div>

          {objective === 'traffic' && (
            <input
              type="url"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="https://your-site.example"
              className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--sp-ink-2)] mb-1">
                Target Countries
              </label>
              <input
                type="text"
                value={countriesText}
                onChange={(e) => setCountriesText(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--sp-ink-2)] mb-1">
                Target Cities / Areas
              </label>
              <input
                type="text"
                value={locationsText}
                onChange={(e) => setLocationsText(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--sp-ink-2)] mb-1">
              Target Interests (comma-separated)
            </label>
            <input
              type="text"
              value={interestsText}
              onChange={(e) => setInterestsText(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--sp-ink-2)] mb-1">
                Min Age (18+)
              </label>
              <input
                type="number"
                min={18}
                max={80}
                value={ageMin}
                onChange={(e) => setAgeMin(Math.max(18, Number(e.target.value)))}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--sp-ink-2)] mb-1">
                Max Age
              </label>
              <input
                type="number"
                min={18}
                max={85}
                value={ageMax}
                onChange={(e) => setAgeMax(Math.min(85, Number(e.target.value)))}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--sp-ink-2)] mb-1">
                Daily Budget (₱ PHP)
              </label>
              <input
                type="number"
                min={100}
                step={50}
                value={dailyBudgetPhp}
                onChange={(e) => setDailyBudgetPhp(Math.max(100, Number(e.target.value)))}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--sp-ink-2)] mb-1">
                Duration (Days)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={durationDays}
                onChange={(e) => setDurationDays(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--sp-primary-soft)] border border-[var(--sp-primary-soft-border)] text-xs space-y-1">
            <div className="font-bold text-[var(--sp-ink)] flex items-center justify-between">
              <span>Estimated Reach</span>
              <span className="font-mono-code text-[var(--sp-primary-text)]">
                {estMin.toLocaleString()} – {estMax.toLocaleString()} people
              </span>
            </div>
            <div className="text-[11px] text-[var(--sp-muted)]">
              Total planned budget: ₱{(dailyBudgetPhp * durationDays).toLocaleString()} · Payment gateway is not charged in prototype mode (`awaiting_payment_setup`).
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || myPosts.length === 0}
            className="w-full py-2.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Submitting Campaign...' : 'Submit Campaign for Review'}
          </button>
        </form>

        {/* Campaigns & Admin Moderation */}
        <div className="lg:col-span-7 space-y-4">
          {isAdmin && (
            <section className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-[var(--sp-ink)] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[var(--sp-accent-text)]" />
                  <span>Admin Moderation Queue ({moderationQueue.length} pending)</span>
                </h2>
                <span className="text-[11px] font-mono-code text-[var(--sp-muted)]">
                  Admin Role Active
                </span>
              </div>

              {adCampaigns.length === 0 ? (
                <p className="text-xs text-[var(--sp-muted)]">No campaigns submitted yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {adCampaigns.map((ad) => {
                    const adv = users.find((u) => u.id === ad.advertiserId);
                    return (
                      <div
                        key={ad.id}
                        className="p-3.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[var(--sp-ink)] truncate">
                            {ad.title}
                          </div>
                          <div className="text-[11px] text-[var(--sp-muted)]">
                            By {adv?.name} · {ad.objective} · ₱{ad.dailyBudgetPhp}/day × {ad.durationDays}d · Status:{' '}
                            <strong className="text-[var(--sp-ink)]">{ad.status}</strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleModerate(ad.id, 'approved')}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleModerate(ad.id, 'paused')}
                            className="px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <PauseCircle className="w-3 h-3" /> Pause
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleModerate(ad.id, 'rejected')}
                            className="px-2.5 py-1 rounded-md bg-red-600 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <section className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-3">
            <h2 className="font-display text-base font-bold text-[var(--sp-ink)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--sp-primary-text)]" />
              <span>Your Campaigns &amp; Live Analytics ({myCampaigns.length})</span>
            </h2>
            {myCampaigns.length === 0 ? (
              <p className="text-xs text-[var(--sp-muted)]">
                You have not submitted any promoted post campaigns yet.
              </p>
            ) : (
              <div className="space-y-3">
                {myCampaigns.map((ad) => (
                  <div
                    key={ad.id}
                    className="p-4 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-[var(--sp-ink)]">{ad.title}</div>
                        <div className="text-[11px] text-[var(--sp-muted)]">
                          Target: {ad.targetLocations.join(', ')} ({ad.targetCountries.join(', ')}) · Ages {ad.targetAgeMin}–{ad.targetAgeMax}
                        </div>
                      </div>
                      <span className="text-[11px] font-mono-code font-bold px-2.5 py-1 rounded-md bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[var(--sp-primary-text)]">
                        {ad.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border-subtle)]">
                        <div className="font-mono-code text-sm font-bold text-[var(--sp-ink)] tabular-nums">
                          {ad.impressions}
                        </div>
                        <div className="text-[10px] text-[var(--sp-muted)]">Impressions</div>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border-subtle)]">
                        <div className="font-mono-code text-sm font-bold text-[var(--sp-ink)] tabular-nums">
                          {ad.uniqueViewerIds.length}
                        </div>
                        <div className="text-[10px] text-[var(--sp-muted)]">Reach</div>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border-subtle)]">
                        <div className="font-mono-code text-sm font-bold text-[var(--sp-ink)] tabular-nums">
                          {ad.clicks}
                        </div>
                        <div className="text-[10px] text-[var(--sp-muted)]">Clicks</div>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border-subtle)]">
                        <div className="font-mono-code text-sm font-bold text-[var(--sp-ink)] tabular-nums">
                          {ad.engagements}
                        </div>
                        <div className="text-[10px] text-[var(--sp-muted)]">Engagements</div>
                      </div>
                    </div>

                    {ad.destinationUrl && (
                      <div className="text-[11px] text-[var(--sp-accent-text)] flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        <span>{ad.destinationUrl}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
