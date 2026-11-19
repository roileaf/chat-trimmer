/**
 * Message lifetimes: per-type timers measured on a world clock that only
 * advances while the world is running (and a GM is connected).
 */

import {
  MODULE_ID,
  classifyCleanupKind,
  isReferenceCard,
  isRollMessage,
} from "./combat-cleanup.js";

/** Lifetime types in match order, with default lifetimes in minutes (0 = never). */
export const LIFETIME_TYPES = {
  whisper: 0,
  gm: 0,
  card: 0,
  combat: 0,
  roll: 0,
  ic: 0,
  ooc: 15,
};

export const CLOCK_SETTING = "worldClockMinutes";
const COMBAT_KINDS = new Set([
  "attack",
  "save",
  "damage",
  "hpChange",
  "initiative",
]);

function isGMAuthor(msg) {
  const author = msg.author ?? msg.user;
  return Boolean(author?.isGM);
}

/** Lifetime type for a message; first matching rule wins. */
export function classifyLifetimeType(msg) {
  if (msg.whisper?.length) return "whisper";
  if (isGMAuthor(msg)) return "gm";
  if (isReferenceCard(msg)) return "card";
  if (COMBAT_KINDS.has(classifyCleanupKind(msg))) return "combat";
  if (isRollMessage(msg)) return "roll";

  const styles = globalThis.CONST?.CHAT_MESSAGE_STYLES ?? {};
  const style = msg.style ?? msg.type;
  if (style === styles.IC || style === styles.EMOTE) return "ic";
  return "ooc";
}

/** Has a message stamped at `stamp` outlived `lifetime` minutes at `clock`? */
export function isExpired(stamp, clock, lifetime) {
  if (typeof stamp !== "number" || !(lifetime > 0)) return false;
  return clock - stamp >= lifetime;
}

export function getClockStamp(msg) {
  return msg.flags?.[MODULE_ID]?.clock;
}

/** Stamped messages whose type lifetime has elapsed on the world clock. */
export function selectExpired(messages, clock, lifetimes) {
  return messages.filter((msg) =>
    isExpired(getClockStamp(msg), clock, lifetimes[classifyLifetimeType(msg)]),
  );
}

/** Settings key for a lifetime type, e.g. "lifetimeOoc". */
export function lifetimeSettingKey(type) {
  return `lifetime${type[0].toUpperCase()}${type.slice(1)}`;
}

/** Read lifetimes from module settings. */
export function getLifetimes() {
  return Object.fromEntries(
    Object.keys(LIFETIME_TYPES).map((type) => [
      type,
      Number(game.settings.get(MODULE_ID, lifetimeSettingKey(type))) || 0,
    ]),
  );
}
