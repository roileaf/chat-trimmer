import {
  entrySearchText,
  matchesQuery,
  parseQuery,
} from "../scripts/utils/archive-search.js";

describe("parseQuery", () => {
  test("splits words and keeps quoted phrases", () => {
    expect(parseQuery('Hemlock  "the relic" Night')).toEqual({
      terms: ["hemlock", "night"],
      phrases: ["the relic"],
    });
  });

  test("empty and whitespace", () => {
    expect(parseQuery("   ")).toEqual({ terms: [], phrases: [] });
    expect(parseQuery(undefined)).toEqual({ terms: [], phrases: [] });
  });

  test("unclosed quote is treated as words", () => {
    expect(parseQuery('"the relic')).toEqual({
      terms: ["the", "relic"],
      phrases: [],
    });
  });
});

describe("entrySearchText", () => {
  test("includes summary, speaker, keywords, npcs, member lines, session", () => {
    const text = entrySearchText({
      displaySummary: "💬 Conversation",
      displayText: "x",
      content: "",
      speaker: "Valeros",
      searchKeywords: ["fireball"],
      npcs: ["Mayor Hemlock"],
      memberTexts: ["Kyra: where is the relic?"],
      sessionLabel: "Session 12",
    });
    for (const part of [
      "conversation",
      "valeros",
      "fireball",
      "mayor hemlock",
      "where is the relic",
      "session 12",
    ]) {
      expect(text).toContain(part);
    }
  });

  test("tolerates missing fields", () => {
    expect(entrySearchText({})).toBe("");
  });
});

describe("matchesQuery", () => {
  const entry = {
    displaySummary: "Valeros talks",
    npcs: ["Mayor Hemlock"],
    memberTexts: ["Hemlock: the relic was stolen at night"],
  };

  test("all words must appear, any order", () => {
    expect(matchesQuery(entry, parseQuery("relic hemlock"))).toBe(true);
    expect(matchesQuery(entry, parseQuery("relic dragon"))).toBe(false);
  });

  test("quoted phrase must match exactly", () => {
    expect(matchesQuery(entry, parseQuery('"relic was stolen"'))).toBe(true);
    expect(matchesQuery(entry, parseQuery('"stolen relic"'))).toBe(false);
  });

  test("empty query matches everything", () => {
    expect(matchesQuery(entry, parseQuery(""))).toBe(true);
  });
});
