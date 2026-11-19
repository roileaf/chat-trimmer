import { messageKeywords } from "../scripts/utils/message-keywords.js";
import { KeywordExtractor } from "../scripts/utils/keyword-extractor.js";

beforeEach(() => {
  game.scenes = {
    get: (id) => (id === "s1" ? { name: "Sandpoint Docks" } : null),
  };
});

describe("messageKeywords", () => {
  test("names, card titles, target and scene; no generic words", () => {
    const kws = messageKeywords(
      {
        content: "<p>Valeros hits with an attack for damage</p>",
        flavor: '<h4 class="action"><strong>Magic Missile</strong></h4>',
        speaker: { alias: "Ezren", scene: "s1" },
      },
      { targetName: "Goblin Warchanter" },
    );
    expect(kws).toEqual(
      expect.arrayContaining([
        "valeros",
        "magic missile",
        "ezren",
        "goblin warchanter",
        "sandpoint docks",
      ]),
    );
    expect(kws).not.toContain("attack");
    expect(kws).not.toContain("damage");
  });

  test("multi-word proper names are kept whole", () => {
    const kws = messageKeywords({
      content: "<p>We met Mayor Kendra Deverin at the Rusty Dragon.</p>",
      speaker: {},
    });
    expect(kws).toEqual(
      expect.arrayContaining(["mayor kendra deverin", "rusty dragon"]),
    );
  });

  test("sentence-start words alone are skipped", () => {
    const kws = messageKeywords({
      content: "<p>We wait. Then go.</p>",
      speaker: {},
    });
    expect(kws).not.toContain("we");
    expect(kws).not.toContain("then");
  });

  test("missing fields", () => {
    expect(messageKeywords({})).toEqual([]);
  });
});

describe("KeywordExtractor.extractFromText", () => {
  test("no longer adds generic quest/combat words", () => {
    const kws = KeywordExtractor.extractFromText(
      "find the goblin and attack it",
    );
    expect(kws).not.toContain("find");
    expect(kws).not.toContain("attack");
  });
});
