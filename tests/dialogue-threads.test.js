import {
  collectNpcs,
  entryNpcs,
  findDialogueThreads,
  formatThreadSummary,
  getNpcName,
  lineText,
} from "../scripts/algorithms/dialogue-threads.js";

const STYLES = CONST.CHAT_MESSAGE_STYLES;
const MIN = 60_000;

let n = 0;
const line = (alias, text, timestamp, extra = {}) => ({
  id: `l${n++}`,
  alias,
  speaker: { alias, actor: extra.actor },
  author: extra.author ?? { isGM: false },
  content: `<p>${text}</p>`,
  style: extra.style ?? STYLES.IC,
  whisper: [],
  rolls: [],
  timestamp,
  ...extra.fields,
});

const roll = (timestamp) => ({
  id: `r${n++}`,
  style: STYLES.OTHER,
  rolls: [{ total: 10 }],
  whisper: [],
  content: "10",
  timestamp,
});

const ooc = (timestamp) => ({
  id: `o${n++}`,
  style: STYLES.OOC,
  rolls: [],
  whisper: [],
  content: "brb",
  timestamp,
});

beforeEach(() => {
  game.actors = {
    get: (id) =>
      ({
        hem: { name: "Mayor Hemlock", hasPlayerOwner: false },
        val: { name: "Valeros", hasPlayerOwner: true },
      })[id] ?? null,
  };
  game.users = { get: (id) => ({ gm1: { isGM: true } })[id] };
});

describe("findDialogueThreads", () => {
  test("3+ IC/emote lines within 5 minutes form a thread; OOC does not break it", () => {
    const msgs = [
      line("Valeros", "Who took it?", 0),
      ooc(1 * MIN),
      line("Hemlock", "Not me.", 2 * MIN),
      line("Kyra", "Liar.", 6 * MIN, { style: STYLES.EMOTE }),
    ];
    const threads = findDialogueThreads(msgs);
    expect(threads).toHaveLength(1);
    expect(threads[0].messages).toHaveLength(3);
  });

  test("a roll breaks the thread", () => {
    const msgs = [
      line("A", "1", 0),
      line("B", "2", MIN),
      roll(2 * MIN),
      line("A", "3", 3 * MIN),
    ];
    expect(findDialogueThreads(msgs)).toHaveLength(0);
  });

  test("a gap over 5 minutes breaks the thread", () => {
    const msgs = [
      line("A", "1", 0),
      line("B", "2", MIN),
      line("A", "3", 7 * MIN),
    ];
    expect(findDialogueThreads(msgs)).toHaveLength(0);
  });

  test("unavailable lines break the thread and are never included", () => {
    const taken = line("B", "2", MIN);
    const msgs = [
      line("A", "1", 0),
      taken,
      line("A", "3", 2 * MIN),
      line("B", "4", 3 * MIN),
    ];
    const threads = findDialogueThreads(msgs, {
      isAvailable: (m) => m !== taken,
    });
    expect(threads).toHaveLength(0);
  });

  test("whispers are not dialogue lines", () => {
    const w = line("A", "psst", MIN, { fields: { whisper: ["u"] } });
    const msgs = [line("A", "1", 0), w, line("B", "2", 2 * MIN)];
    expect(findDialogueThreads(msgs)).toHaveLength(0);
  });
});

describe("getNpcName", () => {
  test("non-player actor is an NPC", () => {
    expect(getNpcName(line("Hemlock", "x", 0, { actor: "hem" }))).toBe(
      "Mayor Hemlock",
    );
  });

  test("player actor is not", () => {
    expect(getNpcName(line("Valeros", "x", 0, { actor: "val" }))).toBeNull();
  });

  test("GM speaking under an alias without actor", () => {
    expect(
      getNpcName(line("Old Woman", "x", 0, { author: { isGM: true } })),
    ).toBe("Old Woman");
    expect(getNpcName(line("Old Woman", "x", 0, { author: "gm1" }))).toBe(
      "Old Woman",
    );
  });

  test("player without actor is not an NPC", () => {
    expect(getNpcName(line("Pat", "x", 0))).toBeNull();
  });
});

describe("formatting", () => {
  test("summary lists speakers in order with line count and preview", () => {
    const thread = {
      messages: [
        line(
          "Valeros",
          "We need to know who took the relic before nightfall.",
          0,
        ),
        line("Mayor Hemlock", "Not me.", MIN),
        line("Valeros", "Then who?", 2 * MIN),
      ],
    };
    expect(formatThreadSummary(thread)).toBe(
      "💬 Conversation — Valeros, Mayor Hemlock (3 lines): “We need to know who took the relic before nightfall.”",
    );
  });

  test("long preview is shortened", () => {
    const long = "word ".repeat(30).trim();
    const summary = formatThreadSummary({
      messages: [line("A", long, 0), line("B", "x", 1), line("C", "y", 2)],
    });
    expect(summary.endsWith("…”")).toBe(true);
  });

  test("lineText strips html", () => {
    expect(lineText(line("Kyra", "<b>Liar</b>.", 0))).toBe("Kyra: Liar.");
  });
});

describe("NPC collection", () => {
  test("entryNpcs reads cluster members and single messages", () => {
    const cluster = {
      originalMessages: [
        line("Hemlock", "a", 0, { actor: "hem" }),
        line("Valeros", "b", 1, { actor: "val" }),
      ],
    };
    expect(entryNpcs(cluster)).toEqual(["Mayor Hemlock"]);
    expect(
      entryNpcs({
        originalMessage: line("Hag", "c", 0, { author: { isGM: true } }),
      }),
    ).toEqual(["Hag"]);
    expect(entryNpcs({ type: "combat" })).toEqual([]);
  });

  test("collectNpcs counts lines and first appearance", () => {
    const entries = [
      {
        originalMessages: [
          line("Hemlock", "a", 100, { actor: "hem" }),
          line("Hemlock", "b", 200, { actor: "hem" }),
        ],
      },
      { originalMessage: line("Hag", "c", 50, { author: { isGM: true } }) },
      { originalMessage: line("Hemlock", "d", 300, { actor: "hem" }) },
    ];
    expect(collectNpcs(entries)).toEqual([
      { name: "Hag", lines: 1, firstSeen: 50 },
      { name: "Mayor Hemlock", lines: 3, firstSeen: 100 },
    ]);
  });
});
