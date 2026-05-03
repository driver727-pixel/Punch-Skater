import type { BattlePassHookState } from "../hooks/useBattlePass";

interface BattlePassPanelProps {
  battlePass: BattlePassHookState;
}

const REWARD_ICONS: Record<string, string> = {
  ozzies: "\u{1F4B0}",
  frame: "\u{1F5BC}\uFE0F",
  forge_credit: "\u26A1",
  cosmetic: "\u2728",
  title: "\u{1F3C6}",
};

export function BattlePassPanel({ battlePass }: BattlePassPanelProps) {
  if (!battlePass.enabled) return null;

  const { state, tier, maxTier, xpProgress, tiers, seasonName } = battlePass;
  const visibleTiers = tiers.filter((t) => t.tier > 0 && (t.freeReward || t.premiumReward));

  return (
    <div className="battle-pass-panel">
      <div className="battle-pass-panel__header">
        <div>
          <h3 className="battle-pass-panel__title">Battle Pass</h3>
          <span className="battle-pass-panel__season">{seasonName}</span>
        </div>
        <div className="battle-pass-panel__tier-display">
          <span className="battle-pass-panel__tier-number">{tier}</span>
          <span className="battle-pass-panel__tier-label">/ {maxTier}</span>
        </div>
      </div>

      <div className="battle-pass-panel__xp-bar">
        <div className="battle-pass-panel__xp-track">
          <div
            className="battle-pass-panel__xp-fill"
            style={{ width: `${xpProgress.percentage}%` }}
          />
        </div>
        <span className="battle-pass-panel__xp-text">
          {tier >= maxTier
            ? "MAX TIER"
            : `${xpProgress.currentXp} / ${xpProgress.xpToNext} XP`}
        </span>
      </div>

      <div className="battle-pass-panel__track">
        {visibleTiers.map((t) => {
          const unlocked = t.tier <= state.tier;
          const freeClaimed = state.claimedFreeRewards.includes(t.tier);
          const premiumClaimed = state.claimedPremiumRewards.includes(t.tier);

          return (
            <div
              key={t.tier}
              className={`battle-pass-tier${unlocked ? " battle-pass-tier--unlocked" : ""}${t.tier === state.tier ? " battle-pass-tier--current" : ""}`}
            >
              <span className="battle-pass-tier__number">T{t.tier}</span>
              <div className="battle-pass-tier__rewards">
                {t.freeReward && (
                  <button
                    className={`battle-pass-reward battle-pass-reward--free${freeClaimed ? " battle-pass-reward--claimed" : ""}`}
                    disabled={!unlocked || freeClaimed}
                    onClick={() => battlePass.claimFreeReward(t.tier)}
                    title={t.freeReward.description}
                  >
                    <span className="battle-pass-reward__icon">
                      {REWARD_ICONS[t.freeReward.type] ?? "\u{1F381}"}
                    </span>
                    <span className="battle-pass-reward__name">{t.freeReward.name}</span>
                    {freeClaimed && <span className="battle-pass-reward__check">{"\u2713"}</span>}
                  </button>
                )}
                {t.premiumReward && (
                  <button
                    className={`battle-pass-reward battle-pass-reward--premium${premiumClaimed ? " battle-pass-reward--claimed" : ""}${!state.isPremium ? " battle-pass-reward--locked" : ""}`}
                    disabled={!unlocked || premiumClaimed || !state.isPremium}
                    onClick={() => battlePass.claimPremiumReward(t.tier)}
                    title={`${t.premiumReward.description}${!state.isPremium ? " (Premium required)" : ""}`}
                  >
                    <span className="battle-pass-reward__icon">
                      {REWARD_ICONS[t.premiumReward.type] ?? "\u{1F381}"}
                    </span>
                    <span className="battle-pass-reward__name">{t.premiumReward.name}</span>
                    {premiumClaimed && <span className="battle-pass-reward__check">{"\u2713"}</span>}
                    {!state.isPremium && <span className="battle-pass-reward__lock">{"\u{1F512}"}</span>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
