import {
  LIFETIME_TYPES,
  classifyLifetimeType,
  isExpired,
  selectExpired,
} from "../scripts/utils/message-lifetimes.js";

const STYLES = CONST.CHAT_MESSAGE_STYLES;
const player = { isGM: false };
const gm = { isGM: true };

const msg = (overrides = {}) => ({
  id: overrides.id ?? "m",
  content: "",
  whisper: [],
  rolls: [],
  style: STYLES.OOC,
  author: player,
  flags: {},
  ...overrides,
});

const stampedAt = (m, clock) => ({
  ...m,
  flags: { ...m.flags, "chat-trimmer": { clock } },
});

const lifetimes = {
  whisper: 0,
  gm: 0,
  card: 0,
  combat: 0,
  roll: 0,
  ic: 0,
  ooc: 15,
};

describe("LIFETIME_TYPES defaults", () => {
  test("only player OOC chat has a default lifetime", () => {
    expect(LIFETIME_TYPES).toEqual(lifetimes);
  });
});

describe("classifyLifetimeType", () => {
  test("whisper wins over everything", () => {
    expect(classifyLifetimeType(msg({ whisper: ["u1"], author: gm }))).toBe(
      "whisper",
    );
  });

  test("GM posts", () => {
    expect(classifyLifetimeType(msg({ author: gm }))).toBe("gm");
    expect(
      classifyLifetimeType(
        msg({
          author: gm,
          rolls: [{}],
          flags: { pf2e: { context: { type: "attack-roll" } } },
        }),
      ),
    ).toBe("gm");
  });

  test("spell card", () => {
    expect(
      classifyLifetimeType(
        msg({
          style: STYLES.OTHER,
          flags: { pf2e: { origin: { type: "spell" } } },
        }),
      ),
    ).toBe("card");
  });

  test("combat roll", () => {
    expect(
      classifyLifetimeType(
        msg({
          rolls: [{}],
          flags: { pf2e: { context: { type: "damage-roll" } } },
        }),
      ),
    ).toBe("combat");
  });

  test("spell attack roll is combat, not card", () => {
    expect(
      classifyLifetimeType(
        msg({
          rolls: [{}],
          flags: {
            pf2e: {
              origin: { type: "spell" },
              context: { type: "spell-attack-roll" },
            },
          },
        }),
      ),
    ).toBe("combat");
  });

  test("other roll", () => {
    expect(
      classifyLifetimeType(
        msg({
          rolls: [{}],
          flags: { pf2e: { context: { type: "skill-check" } } },
        }),
      ),
    ).toBe("roll");
    expect(classifyLifetimeType(msg({ rolls: [{}], content: "1d20" }))).toBe(
      "roll",
    );
  });

  test("IC and emote", () => {
    expect(classifyLifetimeType(msg({ style: STYLES.IC }))).toBe("ic");
    expect(classifyLifetimeType(msg({ style: STYLES.EMOTE }))).toBe("ic");
  });

  test("player OOC and plain messages", () => {
    expect(classifyLifetimeType(msg())).toBe("ooc");
    expect(classifyLifetimeType(msg({ style: STYLES.OTHER }))).toBe("ooc");
  });
});

describe("isExpired", () => {
  test("expires once age reaches lifetime", () => {
    expect(isExpired(10, 25, 15)).toBe(true);
    expect(isExpired(10, 24, 15)).toBe(false);
  });

  test("lifetime 0 never expires", () => {
    expect(isExpired(0, 10000, 0)).toBe(false);
  });

  test("missing stamp never expires", () => {
    expect(isExpired(undefined, 10000, 15)).toBe(false);
    expect(isExpired(null, 10000, 15)).toBe(false);
  });
});

describe("selectExpired", () => {
  test("selects stamped, expired messages by type lifetime", () => {
    const oldOoc = stampedAt(msg({ id: "a" }), 0);
    const freshOoc = stampedAt(msg({ id: "b" }), 10);
    const oldGm = stampedAt(msg({ id: "c", author: gm }), 0);
    const unstamped = msg({ id: "d" });
    const oldIc = stampedAt(msg({ id: "e", style: STYLES.IC }), 0);

    const result = selectExpired(
      [oldOoc, freshOoc, oldGm, unstamped, oldIc],
      20,
      lifetimes,
    );
    expect(result.map((m) => m.id)).toEqual(["a"]);
  });

  test("respects custom lifetimes", () => {
    const oldIc = stampedAt(msg({ id: "e", style: STYLES.IC }), 0);
    expect(selectExpired([oldIc], 30, { ...lifetimes, ic: 30 })).toEqual([
      oldIc,
    ]);
  });
});
