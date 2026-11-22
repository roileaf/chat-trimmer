export function hasActiveCombatEncounter() {
  return Boolean(
    game.combat?.active || game.combats?.some((combat) => combat.active),
  );
}

export function shouldSkipAutoTrim({
  autoTrimMethod,
  disableDuringEncounter,
  hasActiveCombat,
}) {
  if (autoTrimMethod === "disabled") return false;
  return Boolean(disableDuringEncounter && hasActiveCombat);
}

/**
 * Background auto-trim. Silent like combat cleanup and message lifetimes:
 * in message-count mode it can fire every few messages (busy combats), so a
 * toast each time is distracting. Manual trims keep their progress bar.
 */
export async function runAutoTrim(trimmer) {
  await trimmer.trim(null, { silent: true });
  await game.settings.set("chat-trimmer", "lastTrimTime", Date.now());
}
