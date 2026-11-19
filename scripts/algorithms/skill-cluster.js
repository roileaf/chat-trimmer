/**
 * Skill check clustering: group checks of the same skill rolled close
 * together ("everyone roll Perception") into one archive entry.
 */

export const CLUSTER_WINDOW_MS = 2 * 60 * 1000;
export const CLUSTER_MIN_SIZE = 2;

const PF2E_SKILLS = new Set([
  "acrobatics",
  "arcana",
  "athletics",
  "crafting",
  "deception",
  "diplomacy",
  "intimidation",
  "medicine",
  "nature",
  "occultism",
  "performance",
  "religion",
  "society",
  "stealth",
  "survival",
  "thievery",
]);

const DND5E_SKILLS = {
  acr: "Acrobatics",
  ani: "Animal Handling",
  arc: "Arcana",
  ath: "Athletics",
  dec: "Deception",
  his: "History",
  ins: "Insight",
  itm: "Intimidation",
  inv: "Investigation",
  med: "Medicine",
  nat: "Nature",
  prc: "Perception",
  prf: "Performance",
  per: "Persuasion",
  rel: "Religion",
  slt: "Sleight of Hand",
  ste: "Stealth",
  sur: "Survival",
};

const OUTCOME_MARKS = {
  criticalSuccess: "✓✓",
  success: "✓",
  failure: "✗",
  criticalFailure: "✗✗",
};

const titleCase = (slug) =>
  slug
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

const stripHtml = (html) =>
  String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Skill name for a skill/perception check message, or null. */
export function getSkillName(msg) {
  if (!msg.rolls?.length) return null;
  const flags = msg.flags ?? {};

  const ctx = flags.pf2e?.context;
  if (ctx?.type) {
    if (ctx.type === "perception-check") return "Perception";
    if (ctx.type !== "skill-check") return null;
    const domains = ctx.domains ?? [];
    const skill = domains.find((d) => PF2E_SKILLS.has(d));
    if (skill) return titleCase(skill);
    const lore = domains.find((d) => d.endsWith("-lore"));
    return lore ? titleCase(lore) : null;
  }

  const dnd5e = flags.dnd5e?.roll;
  if (dnd5e?.type) {
    return dnd5e.type === "skill"
      ? (DND5E_SKILLS[dnd5e.skillId] ?? null)
      : null;
  }

  const match = stripHtml(msg.flavor).match(
    /([A-Z][A-Za-z' ]*?)\s+(?:Skill\s+)?Check\b/,
  );
  return match ? match[1].trim() : null;
}

/** Group same-skill checks; each within the window of the group's last one. */
export function findSkillClusters(
  messages,
  { windowMs = CLUSTER_WINDOW_MS, minSize = CLUSTER_MIN_SIZE } = {},
) {
  const done = [];
  const open = new Map();
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  for (const msg of sorted) {
    const skill = getSkillName(msg);
    if (!skill) continue;
    const group = open.get(skill);
    if (group && msg.timestamp - group.last <= windowMs) {
      group.messages.push(msg);
      group.last = msg.timestamp;
    } else {
      if (group) done.push(group);
      open.set(skill, { skill, messages: [msg], last: msg.timestamp });
    }
  }
  done.push(...open.values());
  return done
    .filter((g) => g.messages.length >= minSize)
    .sort((a, b) => a.messages[0].timestamp - b.messages[0].timestamp)
    .map(({ skill, messages: groupMessages }) => ({
      skill,
      messages: groupMessages,
    }));
}

function rollTotal(msg) {
  const total = Number(msg.rolls?.[0]?.total);
  return Number.isFinite(total) ? total : null;
}

function rollerName(msg) {
  return msg.alias || msg.speaker?.alias || "Unknown";
}

/** "Valeros 25 ✓✓" */
export function formatMemberText(msg) {
  const total = rollTotal(msg);
  const mark = OUTCOME_MARKS[msg.flags?.pf2e?.context?.outcome];
  return [rollerName(msg), total ?? "?", mark]
    .filter((p) => p !== undefined)
    .join(" ");
}

/** "🎲 Perception ×4 — Valeros 25 ✓✓, Kyra 21 ✓, …" (highest first) */
export function formatClusterSummary(cluster) {
  const members = [...cluster.messages]
    .sort((a, b) => (rollTotal(b) ?? -Infinity) - (rollTotal(a) ?? -Infinity))
    .map(formatMemberText)
    .join(", ");
  return `🎲 ${cluster.skill} ×${cluster.messages.length} — ${members}`;
}
