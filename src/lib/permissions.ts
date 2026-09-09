import type { Tier } from "@/hooks/useCredits";

export type AppRole = "owner" | "admin" | "advertiser" | "user";
export type AppTier = "trial" | "regular" | "premium";

/**
 * Effective role is the single source of truth for permission checks.
 * It collapses the database role + tier into one granular value:
 *
 *   "owner"      — role owner/admin → ad-free, unlimited AI, full system access
 *   "advertiser" — role advertiser → ad-free, manages campaigns
 *   "premium"    — tier premium → ad-free, unlimited AI
 *   "regular"    — tier regular → ads shown, 100 AI/day
 *   "trial"      — tier trial → ads shown, 10 AI/day
 */
export type EffectiveRole = "owner" | "advertiser" | "premium" | "regular" | "trial";

export function getEffectiveRole(role: AppRole | null | undefined, tier: Tier | null | undefined): EffectiveRole {
  if (role === "owner" || role === "admin") return "owner";
  if (role === "advertiser") return "advertiser";
  if (tier === "premium") return "premium";
  if (tier === "regular") return "regular";
  return "trial";
}

/** Ad slots are visible only to regular and trial users. */
export function shouldShowAdSlot(role: EffectiveRole): boolean {
  return role === "regular" || role === "trial";
}

/** Ad-free means no ad slots anywhere in the app. */
export function isAdFree(role: EffectiveRole): boolean {
  return !shouldShowAdSlot(role);
}

/** Unlimited AI credits (no daily limit). */
export function hasUnlimitedAI(role: EffectiveRole): boolean {
  return role === "owner" || role === "premium";
}

/** Show the "Upgrade to Premium" CTA. */
export function shouldShowUpgradeCTA(role: EffectiveRole): boolean {
  return role === "regular" || role === "trial";
}

/** Show the owner-only system settings nav. */
export function canManageSite(role: EffectiveRole): boolean {
  return role === "owner";
}

/** Show the advertiser campaign panel. */
export function isAdvertiser(role: EffectiveRole): boolean {
  return role === "advertiser";
}

/** Daily AI credit limit per effective role. -1 = unlimited. */
export const AI_DAILY_LIMITS: Record<EffectiveRole, number> = {
  owner: -1,
  advertiser: 100,
  premium: -1,
  regular: 100,
  trial: 10,
};
