/**
 * Archive search: all words must appear (any order); "quoted" text must
 * appear as an exact phrase. Matches everything known about an entry.
 */

/** @returns {{terms: string[], phrases: string[]}} lowercased */
export function parseQuery(query) {
  const phrases = [];
  const rest = String(query ?? "")
    .toLowerCase()
    .replace(/"([^"]+)"/g, (_, phrase) => {
      const trimmed = phrase.trim();
      if (trimmed) phrases.push(trimmed);
      return " ";
    })
    .replace(/"/g, " ");
  const terms = rest.split(/\s+/).filter(Boolean);
  return { terms, phrases };
}

/** Lowercased text of every searchable field of an entry. */
export function entrySearchText(entry) {
  const parts = [
    entry.displaySummary,
    entry.displayText,
    entry.content,
    entry.speaker,
    entry.sessionLabel,
    ...(entry.searchKeywords ?? []),
    ...(entry.npcs ?? []),
    ...(entry.memberTexts ?? []),
  ];
  return parts
    .filter((p) => typeof p === "string" && p)
    .join(" ")
    .toLowerCase();
}

export function matchesQuery(entry, { terms, phrases }) {
  if (!terms.length && !phrases.length) return true;
  const text = entrySearchText(entry);
  return (
    terms.every((t) => text.includes(t)) &&
    phrases.every((p) => text.includes(p))
  );
}
