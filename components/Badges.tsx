import type { Offer } from "../src/core/schema";
import { avatarIndex, rewardView } from "./format";

export function BankAvatar({ slug, name }: { slug: string; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={`avatar av-${avatarIndex(slug)}`} aria-hidden="true">
      {initial}
    </span>
  );
}

export function RewardBadge({ offer }: { offer: Offer }) {
  const r = rewardView(offer);
  return <span className={`badge badge-${r.kind}`}>{r.badge}</span>;
}

export function StaleBadge() {
  return (
    <span className="badge badge-stale" title="Not re-checked for more than 30 days">
      Stale
    </span>
  );
}
