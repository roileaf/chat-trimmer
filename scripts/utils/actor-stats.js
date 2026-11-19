/**
 * Per-character roll statistics for the campaign stats dashboard.
 * Works on live ChatMessages and on serialized message data (old archives).
 */

import { classifyCleanupKind } from "./combat-cleanup.js";

export const GM_BUCKET = "GM / NPCs";

const COUNTERS = [
  "rolls",
  "nat20",
  "nat1",
  "critSuccess",
  "critFail",
  "damage",
];

function emptyRow() {
  return {
    rolls: 0,
    nat20: 0,
    nat1: 0,
    critSuccess: 0,
    critFail: 0,
    damage: 0,
    biggestHit: 0,
  };
}

function parseRoll(roll) {
  if (typeof roll !== "string") return roll ?? null;
  try {
    return JSON.parse(roll);
  } catch {
    return null;
  }
}

/** Active d20 results in a roll (live Roll or serialized JSON). */
export function extractD20Results(roll) {
  const root = parseRoll(roll);
  if (!root || typeof root !== "object") return [];
  const results = [];
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (node.faces === 20 && Array.isArray(node.results)) {
      for (const r of node.results) {
        if (r && r.active !== false && !r.discarded) results.push(r.result);
      }
    }
    for (const key of ["terms", "rolls", "operands"]) {
      if (Array.isArray(node[key])) node[key].forEach(walk);
    }
    if (node.term) walk(node.term);
  };
  walk(root);
  return results;
}

function resolveUser(author) {
  if (!author) return null;
  if (typeof author === "string") return game.users?.get(author) ?? null;
  return author;
}

/** Row name for whoever made a message. */
export function getRollerName(msg) {
  const actorId = msg.speaker?.actor;
  const actor = actorId ? game.actors?.get(actorId) : null;
  if (actor) return actor.hasPlayerOwner ? actor.name : GM_BUCKET;

  const user = resolveUser(msg.author ?? msg.user);
  if (user?.isGM) return GM_BUCKET;
  return msg.speaker?.alias || user?.name || GM_BUCKET;
}

function rollTotal(roll) {
  const total = Number(parseRoll(roll)?.total);
  return Number.isFinite(total) ? total : 0;
}

function critOutcome(msg) {
  const outcome = msg.flags?.pf2e?.context?.outcome;
  if (outcome === "criticalSuccess") return "success";
  if (outcome === "criticalFailure") return "failure";
  if (outcome) return null;
  const text = `${msg.content ?? ""} ${msg.flavor ?? ""}`.toLowerCase();
  if (text.includes("critical failure") || text.includes("critical miss")) {
    return "failure";
  }
  if (text.includes("critical success") || text.includes("critical hit")) {
    return "success";
  }
  return null;
}

/** Per-character stats from a list of messages. */
export function computeActorStats(messages) {
  const byActor = {};
  for (const msg of messages) {
    const rolls = msg.rolls ?? [];
    if (!rolls.length) continue;

    const name = getRollerName(msg);
    const row = (byActor[name] ??= emptyRow());
    row.rolls += 1;

    for (const roll of rolls) {
      for (const result of extractD20Results(roll)) {
        if (result === 20) row.nat20 += 1;
        else if (result === 1) row.nat1 += 1;
      }
    }

    if (classifyCleanupKind(msg) === "damage") {
      const total = rolls.reduce((sum, roll) => sum + rollTotal(roll), 0);
      row.damage += total;
      row.biggestHit = Math.max(row.biggestHit, total);
      continue;
    }

    const crit = critOutcome(msg);
    if (crit === "success") row.critSuccess += 1;
    else if (crit === "failure") row.critFail += 1;
  }
  return byActor;
}

/** Sum two byActor maps (biggestHit takes the max). */
export function mergeActorStats(a, b) {
  const merged = {};
  for (const source of [a, b]) {
    for (const [name, row] of Object.entries(source ?? {})) {
      const target = (merged[name] ??= emptyRow());
      for (const key of COUNTERS) target[key] += row?.[key] ?? 0;
      target.biggestHit = Math.max(target.biggestHit, row?.biggestHit ?? 0);
    }
  }
  return merged;
}

function topBy(rows, key) {
  let best = null;
  for (const row of rows) {
    if (row.name === GM_BUCKET || !(row[key] > 0)) continue;
    if (!best || row[key] > best.value)
      best = { name: row.name, value: row[key] };
  }
  return best;
}

/**
 * Dashboard view model.
 * @param {Array<{number, name, byActor, partial?, originalCount, compressedCount}>} sessions
 */
export function summarizeStats(sessions) {
  const totals = sessions.reduce(
    (acc, s) => mergeActorStats(acc, s.byActor),
    {},
  );
  const rows = Object.entries(totals)
    .map(([name, row]) => ({ name, ...row }))
    .sort((x, y) => {
      if (x.name === GM_BUCKET) return 1;
      if (y.name === GM_BUCKET) return -1;
      return y.rolls - x.rolls;
    });

  const sessionRolls = sessions.map((s) =>
    Object.values(s.byActor ?? {}).reduce((sum, r) => sum + (r.rolls ?? 0), 0),
  );
  const maxRolls = Math.max(0, ...sessionRolls);
  const sessionBars = sessions.map((s, i) => ({
    number: s.number,
    name: s.name,
    rolls: sessionRolls[i],
    pct: maxRolls ? Math.round((sessionRolls[i] / maxRolls) * 100) : 0,
    partial: Boolean(s.partial),
  }));

  const archived = sessions.reduce((sum, s) => sum + (s.originalCount ?? 0), 0);
  const compressed = sessions.reduce(
    (sum, s) => sum + (s.compressedCount ?? 0),
    0,
  );

  return {
    rows,
    highlights: {
      mostNat20: topBy(rows, "nat20"),
      mostNat1: topBy(rows, "nat1"),
      biggestHit: topBy(rows, "biggestHit"),
    },
    sessionBars,
    footer: {
      archived,
      compressionRatio: archived
        ? Math.round(((archived - compressed) / archived) * 100)
        : 0,
    },
    partial: sessions.some((s) => s.partial),
  };
}
