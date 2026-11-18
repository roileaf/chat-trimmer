/**
 * Combat turn cleanup: clear resolved combat noise (attacks, saves, damage,
 * HP changes) once it is more than one full round old, keeping reference
 * cards such as spells and abilities.
 */

export const MODULE_ID = "chat-trimmer";

/** Checklist kinds and their default enabled state. */
export const CLEANUP_KINDS = {
  attack: true,
  save: true,
  damage: true,
  hpChange: true,
  skill: false,
  initiative: false,
  chat: false,
};

const PF2E_CONTEXT_KINDS = {
  "attack-roll": "attack",
  "spell-attack-roll": "attack",
  "saving-throw": "save",
  "damage-roll": "damage",
  "damage-taken": "hpChange",
  "skill-check": "skill",
  "perception-check": "skill",
  "flat-check": "skill",
  initiative: "initiative",
};

const DND5E_ROLL_KINDS = {
  attack: "attack",
  damage: "damage",
  healing: "damage",
  save: "save",
  skill: "skill",
  ability: "skill",
  check: "skill",
  tool: "skill",
  initiative: "initiative",
};

/**
 * Position stamp for a message created during the given combat.
 * @returns {{combatId: string, round: number, turn: number} | null}
 */
export function buildCombatStamp(combat) {
  if (!combat?.started || !(combat.round >= 1)) return null;
  return { combatId: combat.id, round: combat.round, turn: combat.turn ?? 0 };
}

/** Is a stamp at least one full round behind the current position? */
export function isEligible(stamp, current) {
  if (!stamp || !current) return false;
  const prevRound = current.round - 1;
  return (
    stamp.round < prevRound ||
    (stamp.round === prevRound && stamp.turn <= current.turn)
  );
}

/** Did the tracker move strictly forward? */
export function isForwardMove(prev, next) {
  if (!prev || !next) return false;
  if (next.round !== prev.round) return next.round > prev.round;
  return next.turn > prev.turn;
}

function isRollMessage(msg) {
  return Boolean(msg.isRoll || msg.rolls?.length);
}

/**
 * Which checklist kind a message belongs to, or null if it is never cleared
 * (spell/ability/item cards and anything unrecognised).
 */
export function classifyCleanupKind(msg) {
  const flags = msg.flags ?? {};

  // PF2e (primary system)
  const pf2eType = flags.pf2e?.context?.type;
  if (pf2eType && PF2E_CONTEXT_KINDS[pf2eType]) {
    return PF2E_CONTEXT_KINDS[pf2eType];
  }
  if (flags.pf2e?.appliedDamage) return "hpChange";

  if (flags.core?.initiativeRoll) return "initiative";

  // dnd5e
  const dnd5eType = flags.dnd5e?.roll?.type;
  if (dnd5eType && DND5E_ROLL_KINDS[dnd5eType]) {
    return DND5E_ROLL_KINDS[dnd5eType];
  }

  // Anything carrying an item origin without a roll context is a reference card.
  if (flags.pf2e?.origin || flags.dnd5e?.use || flags.dnd5e?.item) return null;

  if (isRollMessage(msg)) {
    const content = String(msg.content ?? "").toLowerCase();
    if (content.includes("saving throw") || /\bsave\b/.test(content)) {
      return "save";
    }
    if (content.includes("attack")) return "attack";
    if (content.includes("damage")) return "damage";
    return null;
  }

  const styles = globalThis.CONST?.CHAT_MESSAGE_STYLES ?? {};
  const style = msg.style ?? msg.type;
  if (styles.OOC !== undefined && style === styles.OOC) return "chat";

  return null;
}

function isWhisperedToGM(msg) {
  const whisper = msg.whisper ?? [];
  if (!whisper.length) return false;
  return whisper.some((id) => game.users?.get(id)?.isGM);
}

/** Should this message be cleared under the given checklist? */
export function matchesChecklist(msg, kinds) {
  if (isWhisperedToGM(msg)) return false;
  const kind = classifyCleanupKind(msg);
  return Boolean(kind && kinds?.[kind]);
}

export function getCombatStamp(msg) {
  return msg.flags?.[MODULE_ID]?.combatPos ?? null;
}

/** Messages of this combat that are old enough and match the checklist. */
export function selectForCleanup(messages, combat, kinds) {
  if (!combat) return [];
  const current = { round: combat.round, turn: combat.turn ?? 0 };
  return messages.filter((msg) => {
    const stamp = getCombatStamp(msg);
    return (
      stamp?.combatId === combat.id &&
      isEligible(stamp, current) &&
      matchesChecklist(msg, kinds)
    );
  });
}

/** Settings key for a checklist kind, e.g. "combatCleanupAttack". */
export function kindSettingKey(kind) {
  return `combatCleanup${kind[0].toUpperCase()}${kind.slice(1)}`;
}

/** Read the checklist from module settings. */
export function getCleanupKinds() {
  return Object.fromEntries(
    Object.keys(CLEANUP_KINDS).map((kind) => [
      kind,
      Boolean(game.settings.get(MODULE_ID, kindSettingKey(kind))),
    ]),
  );
}
