/**
 * Dialogue threads and NPC tracking.
 * Works on live ChatMessages and serialized message data (archived entries).
 */

export const THREAD_GAP_MS = 5 * 60 * 1000;
export const THREAD_MIN_LINES = 3;
const PREVIEW_LENGTH = 60;

function styles() {
  return globalThis.CONST?.CHAT_MESSAGE_STYLES ?? {};
}

function messageStyle(msg) {
  return msg.style ?? msg.type;
}

function hasRolls(msg) {
  return Boolean(msg.isRoll || msg.rolls?.length);
}

/** In-character speech or emote that isn't a roll or whisper. */
export function isDialogueLine(msg) {
  const s = styles();
  const style = messageStyle(msg);
  return (
    (style === s.IC || style === s.EMOTE) &&
    !hasRolls(msg) &&
    !msg.whisper?.length
  );
}

const stripHtml = (html) =>
  String(html ?? "")
    .replace(/<\/?(p|div|br|li|h\d)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

function speakerName(msg) {
  return msg.alias || msg.speaker?.alias || "Unknown";
}

function resolveUser(author) {
  if (!author) return null;
  if (typeof author === "string") return game.users?.get(author) ?? null;
  return author;
}

/** NPC name for a message's speaker, or null for players / no speaker. */
export function getNpcName(msg) {
  const actorId = msg.speaker?.actor;
  const actor = actorId ? game.actors?.get(actorId) : null;
  if (actor) return actor.hasPlayerOwner ? null : actor.name;
  const user = resolveUser(msg.author ?? msg.user);
  const alias = msg.speaker?.alias || msg.alias;
  return user?.isGM && alias ? alias : null;
}

/**
 * Runs of dialogue lines, each within `gapMs` of the previous line.
 * Rolls and unavailable dialogue lines end a run; OOC chat does not.
 */
export function findDialogueThreads(
  messages,
  {
    gapMs = THREAD_GAP_MS,
    minLines = THREAD_MIN_LINES,
    isAvailable = () => true,
  } = {},
) {
  const threads = [];
  let current = [];
  const close = () => {
    if (current.length >= minLines) threads.push({ messages: current });
    current = [];
  };

  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  for (const msg of sorted) {
    if (isDialogueLine(msg)) {
      if (!isAvailable(msg)) {
        close();
        continue;
      }
      const last = current[current.length - 1];
      if (last && msg.timestamp - last.timestamp > gapMs) close();
      current.push(msg);
    } else if (hasRolls(msg)) {
      close();
    }
  }
  close();
  return threads;
}

/** "Speaker: text" */
export function lineText(msg) {
  return `${speakerName(msg)}: ${stripHtml(msg.content)}`;
}

function shorten(text) {
  return text.length > PREVIEW_LENGTH
    ? `${text.slice(0, PREVIEW_LENGTH).trimEnd()}…`
    : text;
}

/** "💬 Conversation — A, B (14 lines): “first line…”" */
export function formatThreadSummary(thread) {
  const speakers = [...new Set(thread.messages.map(speakerName))];
  const preview = shorten(stripHtml(thread.messages[0]?.content));
  return `💬 Conversation — ${speakers.join(", ")} (${thread.messages.length} lines): “${preview}”`;
}

function entryMessages(entry) {
  if (Array.isArray(entry?.originalMessages)) return entry.originalMessages;
  return entry?.originalMessage ? [entry.originalMessage] : [];
}

/** NPC names involved in an archive entry. */
export function entryNpcs(entry) {
  if (Array.isArray(entry?.npcs)) return entry.npcs;
  const names = entryMessages(entry).map(getNpcName).filter(Boolean);
  return [...new Set(names)];
}

/** NPCs met across entries: dialogue line count and first appearance. */
export function collectNpcs(entries) {
  const npcs = new Map();
  for (const entry of entries) {
    for (const msg of entryMessages(entry)) {
      const name = getNpcName(msg);
      if (!name) continue;
      const npc = npcs.get(name) ?? { name, lines: 0, firstSeen: Infinity };
      npc.lines += 1;
      npc.firstSeen = Math.min(npc.firstSeen, msg.timestamp ?? Infinity);
      npcs.set(name, npc);
    }
  }
  return [...npcs.values()].sort((a, b) => a.firstSeen - b.firstSeen);
}
