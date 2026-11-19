/**
 * Search keywords for a chat message: proper names (kept whole, e.g.
 * "mayor kendra deverin"), card titles (spell/item/action names), the
 * speaker, the attack target and the scene. No generic game words.
 */

const STOPWORDS = new Set(
  (
    "a an and as at but by for from he her his i if in is it its me my no " +
    "not of on or our she so that the their then there they this to up us " +
    "was we what when where who why will with you your yes ok okay"
  ).split(" "),
);

const MAX_TITLE_WORDS = 5;

const stripHtml = (html) =>
  String(html ?? "")
    .replace(/<\/?(p|div|br|li|h\d)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Capitalized word runs, allowing "of"/"the" inside: "Order of the Rack". */
function properNames(text) {
  const names = [];
  const re = /\b[A-Z][\w'-]*(?:\s+(?:(?:of|the|de|von)\s+)*[A-Z][\w'-]*)*/g;
  for (const match of text.matchAll(re)) {
    const name = match[0].toLowerCase();
    if (!name.includes(" ") && STOPWORDS.has(name)) continue;
    names.push(name);
  }
  return names;
}

/** Text of <strong>/<b>/<h1-6> elements (card titles), if short. */
function cardTitles(html) {
  const titles = [];
  const re = /<(strong|b|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of String(html ?? "").matchAll(re)) {
    const text = stripHtml(match[2]).toLowerCase();
    const words = text.split(" ").filter(Boolean);
    if (words.length && words.length <= MAX_TITLE_WORDS) titles.push(text);
  }
  return titles;
}

/**
 * @param {object} msg - live ChatMessage or serialized data
 * @param {{targetName?: string|null}} [extra]
 * @returns {string[]} unique lowercased keywords
 */
export function messageKeywords(msg, { targetName } = {}) {
  const keywords = new Set();
  const add = (k) => {
    const v = String(k ?? "")
      .trim()
      .toLowerCase();
    if (v && !STOPWORDS.has(v)) keywords.add(v);
  };

  for (const html of [msg.content, msg.flavor]) {
    properNames(stripHtml(html)).forEach(add);
    cardTitles(html).forEach(add);
  }
  add(msg.speaker?.alias || msg.alias);
  add(targetName);
  const sceneId = msg.speaker?.scene;
  if (sceneId) add(game.scenes?.get(sceneId)?.name);

  return [...keywords];
}
