import {
  GM_BUCKET,
  computeActorStats,
  extractD20Results,
  getRollerName,
  mergeActorStats,
  summarizeStats,
} from "../scripts/utils/actor-stats.js";

const d20 = (...results) => ({
  faces: 20,
  results: results.map((r) =>
    typeof r === "number" ? { result: r, active: true } : r,
  ),
});

beforeEach(() => {
  game.actors = {
    get: (id) =>
      ({
        val: { name: "Valeros", hasPlayerOwner: true },
        gob: { name: "Goblin", hasPlayerOwner: false },
      })[id] ?? null,
  };
  game.users = {
    get: (id) =>
      ({ gm1: { isGM: true, name: "GM" }, p1: { isGM: false, name: "Pat" } })[
        id
      ],
  };
});

describe("extractD20Results", () => {
  test("live roll with nested terms", () => {
    const roll = {
      total: 25,
      terms: [d20(20), { faces: 6, results: [{ result: 1, active: true }] }],
    };
    expect(extractD20Results(roll)).toEqual([20]);
  });

  test("ignores inactive (dropped) results", () => {
    const roll = { terms: [d20(1, { result: 20, active: false })] };
    expect(extractD20Results(roll)).toEqual([1]);
  });

  test("serialized roll JSON with pool terms", () => {
    const roll = JSON.stringify({
      class: "Roll",
      total: 18,
      terms: [{ class: "PoolTerm", rolls: [{ terms: [d20(1)] }] }],
    });
    expect(extractD20Results(roll)).toEqual([1]);
  });

  test("bad input returns empty", () => {
    expect(extractD20Results("not json")).toEqual([]);
    expect(extractD20Results(null)).toEqual([]);
  });
});

describe("getRollerName", () => {
  test("player-owned actor", () => {
    expect(
      getRollerName({ speaker: { actor: "val" }, author: { isGM: false } }),
    ).toBe("Valeros");
  });

  test("non-player actor goes to GM bucket", () => {
    expect(
      getRollerName({ speaker: { actor: "gob" }, author: { isGM: false } }),
    ).toBe(GM_BUCKET);
  });

  test("GM author without actor goes to GM bucket", () => {
    expect(getRollerName({ speaker: {}, author: { isGM: true } })).toBe(
      GM_BUCKET,
    );
  });

  test("serialized author id resolves via users", () => {
    expect(getRollerName({ speaker: { alias: "Pat" }, author: "p1" })).toBe(
      "Pat",
    );
    expect(getRollerName({ speaker: {}, author: "gm1" })).toBe(GM_BUCKET);
  });
});

describe("computeActorStats", () => {
  test("counts rolls, nat 20/1, crits, damage", () => {
    const val = { speaker: { actor: "val" }, author: { isGM: false } };
    const messages = [
      {
        ...val,
        content: "",
        rolls: [{ total: 30, terms: [d20(20)] }],
        flags: {
          pf2e: {
            context: { type: "attack-roll", outcome: "criticalSuccess" },
          },
        },
      },
      {
        ...val,
        content: "",
        rolls: [{ total: 24, terms: [] }],
        flags: { pf2e: { context: { type: "damage-roll" } } },
      },
      {
        ...val,
        content: "",
        rolls: [{ total: 9, terms: [] }],
        flags: { pf2e: { context: { type: "damage-roll" } } },
      },
      {
        speaker: { actor: "gob" },
        author: { isGM: true },
        content: "<p>Critical Failure</p>",
        rolls: [{ total: 2, terms: [d20(1)] }],
        flags: {},
      },
      { ...val, content: "hello", rolls: [], flags: {} },
    ];

    expect(computeActorStats(messages)).toEqual({
      Valeros: {
        rolls: 3,
        nat20: 1,
        nat1: 0,
        critSuccess: 1,
        critFail: 0,
        damage: 33,
        biggestHit: 24,
      },
      [GM_BUCKET]: {
        rolls: 1,
        nat20: 0,
        nat1: 1,
        critSuccess: 0,
        critFail: 1,
        damage: 0,
        biggestHit: 0,
      },
    });
  });
});

describe("mergeActorStats", () => {
  test("sums counters and keeps max biggest hit", () => {
    const a = {
      V: {
        rolls: 1,
        nat20: 1,
        nat1: 0,
        critSuccess: 0,
        critFail: 0,
        damage: 10,
        biggestHit: 10,
      },
    };
    const b = {
      V: {
        rolls: 2,
        nat20: 0,
        nat1: 1,
        critSuccess: 1,
        critFail: 0,
        damage: 5,
        biggestHit: 5,
      },
      E: {
        rolls: 1,
        nat20: 0,
        nat1: 0,
        critSuccess: 0,
        critFail: 0,
        damage: 0,
        biggestHit: 0,
      },
    };
    expect(mergeActorStats(a, b)).toEqual({
      V: {
        rolls: 3,
        nat20: 1,
        nat1: 1,
        critSuccess: 1,
        critFail: 0,
        damage: 15,
        biggestHit: 10,
      },
      E: {
        rolls: 1,
        nat20: 0,
        nat1: 0,
        critSuccess: 0,
        critFail: 0,
        damage: 0,
        biggestHit: 0,
      },
    });
  });

  test("handles missing inputs", () => {
    expect(mergeActorStats(undefined, null)).toEqual({});
  });
});

describe("summarizeStats", () => {
  const row = (rolls, nat20, nat1, biggestHit) => ({
    rolls,
    nat20,
    nat1,
    critSuccess: 0,
    critFail: 0,
    damage: biggestHit,
    biggestHit,
  });

  test("rows, highlights, session bars and footer", () => {
    const sessions = [
      {
        number: 1,
        name: "Session 1",
        partial: false,
        originalCount: 100,
        compressedCount: 20,
        byActor: { Valeros: row(10, 2, 0, 20), [GM_BUCKET]: row(30, 1, 3, 15) },
      },
      {
        number: 2,
        name: "Session 2",
        partial: true,
        originalCount: 50,
        compressedCount: 10,
        byActor: { Ezren: row(5, 0, 4, 38) },
      },
    ];

    const summary = summarizeStats(sessions);

    expect(summary.rows.map((r) => r.name)).toEqual([
      "Valeros",
      "Ezren",
      GM_BUCKET,
    ]);
    expect(summary.highlights).toEqual({
      mostNat20: { name: "Valeros", value: 2 },
      mostNat1: { name: "Ezren", value: 4 },
      biggestHit: { name: "Ezren", value: 38 },
    });
    expect(summary.sessionBars).toEqual([
      { number: 1, name: "Session 1", rolls: 40, pct: 100, partial: false },
      { number: 2, name: "Session 2", rolls: 5, pct: 13, partial: true },
    ]);
    expect(summary.footer).toEqual({ archived: 150, compressionRatio: 80 });
    expect(summary.partial).toBe(true);
  });

  test("highlights skip the GM bucket and zero values", () => {
    const summary = summarizeStats([
      {
        number: 1,
        name: "S1",
        originalCount: 0,
        compressedCount: 0,
        byActor: { [GM_BUCKET]: row(10, 5, 5, 50), Valeros: row(1, 0, 0, 0) },
      },
    ]);
    expect(summary.highlights).toEqual({
      mostNat20: null,
      mostNat1: null,
      biggestHit: null,
    });
    expect(summary.footer.compressionRatio).toBe(0);
  });
});
