import {
  buildCombatStamp,
  classifyCleanupKind,
  isEligible,
  isForwardMove,
  matchesChecklist,
  selectForCleanup,
} from "../scripts/utils/combat-cleanup.js";

const DEFAULT_KINDS = {
  attack: true,
  save: true,
  damage: true,
  hpChange: true,
  skill: false,
  initiative: false,
  chat: false,
};

const pf2e = (type, extra = {}) => ({
  id: `m-${type}`,
  content: "",
  whisper: [],
  rolls: [{}],
  flags: { pf2e: { context: { type } } },
  ...extra,
});

const stamped = (msg, combatId, round, turn) => ({
  ...msg,
  flags: {
    ...msg.flags,
    "chat-trimmer": { combatPos: { combatId, round, turn } },
  },
});

beforeEach(() => {
  game.users = {
    get: (id) => ({ gm1: { isGM: true }, p1: { isGM: false } })[id],
  };
});

describe("buildCombatStamp", () => {
  test("returns position for started combat", () => {
    expect(
      buildCombatStamp({ id: "c1", started: true, round: 2, turn: 3 }),
    ).toEqual({
      combatId: "c1",
      round: 2,
      turn: 3,
    });
  });

  test("null when no combat or not started", () => {
    expect(buildCombatStamp(null)).toBeNull();
    expect(
      buildCombatStamp({ id: "c1", started: false, round: 0, turn: 0 }),
    ).toBeNull();
    expect(
      buildCombatStamp({ id: "c1", started: true, round: 0, turn: 0 }),
    ).toBeNull();
  });
});

describe("isEligible", () => {
  const current = { round: 3, turn: 2 };
  test("same combatant's previous turn is eligible", () => {
    expect(isEligible({ round: 2, turn: 2 }, current)).toBe(true);
  });
  test("earlier turns of previous round are eligible", () => {
    expect(isEligible({ round: 2, turn: 0 }, current)).toBe(true);
    expect(isEligible({ round: 1, turn: 5 }, current)).toBe(true);
  });
  test("last full round is kept", () => {
    expect(isEligible({ round: 2, turn: 3 }, current)).toBe(false);
    expect(isEligible({ round: 3, turn: 0 }, current)).toBe(false);
    expect(isEligible({ round: 3, turn: 2 }, current)).toBe(false);
  });
  test("missing stamp is never eligible", () => {
    expect(isEligible(null, current)).toBe(false);
  });
});

describe("isForwardMove", () => {
  test("next turn and next round are forward", () => {
    expect(isForwardMove({ round: 1, turn: 0 }, { round: 1, turn: 1 })).toBe(
      true,
    );
    expect(isForwardMove({ round: 1, turn: 4 }, { round: 2, turn: 0 })).toBe(
      true,
    );
  });
  test("rewinds and no-ops are not forward", () => {
    expect(isForwardMove({ round: 2, turn: 1 }, { round: 2, turn: 0 })).toBe(
      false,
    );
    expect(isForwardMove({ round: 2, turn: 0 }, { round: 1, turn: 4 })).toBe(
      false,
    );
    expect(isForwardMove({ round: 2, turn: 1 }, { round: 2, turn: 1 })).toBe(
      false,
    );
  });
});

describe("classifyCleanupKind", () => {
  test("PF2e context types", () => {
    expect(classifyCleanupKind(pf2e("attack-roll"))).toBe("attack");
    expect(classifyCleanupKind(pf2e("spell-attack-roll"))).toBe("attack");
    expect(classifyCleanupKind(pf2e("saving-throw"))).toBe("save");
    expect(classifyCleanupKind(pf2e("damage-roll"))).toBe("damage");
    expect(classifyCleanupKind(pf2e("skill-check"))).toBe("skill");
    expect(classifyCleanupKind(pf2e("perception-check"))).toBe("skill");
    expect(classifyCleanupKind(pf2e("initiative"))).toBe("initiative");
  });

  test("PF2e applied damage card is hpChange", () => {
    expect(
      classifyCleanupKind({
        content: "Goblin takes 6 damage",
        whisper: [],
        rolls: [],
        flags: { pf2e: { appliedDamage: { uuid: "x" } } },
      }),
    ).toBe("hpChange");
  });

  test("PF2e spell card with save DC is not cleared", () => {
    expect(
      classifyCleanupKind({
        content: "<div>Fireball — Basic Reflex save DC 22</div>",
        whisper: [],
        rolls: [],
        flags: { pf2e: { origin: { type: "spell", uuid: "Actor.a.Item.b" } } },
      }),
    ).toBeNull();
  });

  test("core initiative flag", () => {
    expect(
      classifyCleanupKind({
        content: "",
        whisper: [],
        rolls: [{}],
        flags: { core: { initiativeRoll: true } },
      }),
    ).toBe("initiative");
  });

  test("dnd5e roll types", () => {
    const m = (type) => ({
      content: "",
      whisper: [],
      rolls: [{}],
      flags: { dnd5e: { roll: { type } } },
    });
    expect(classifyCleanupKind(m("attack"))).toBe("attack");
    expect(classifyCleanupKind(m("damage"))).toBe("damage");
    expect(classifyCleanupKind(m("save"))).toBe("save");
    expect(classifyCleanupKind(m("skill"))).toBe("skill");
  });

  test("generic roll keyword fallback", () => {
    const r = (content) => ({ content, whisper: [], rolls: [{}], flags: {} });
    expect(classifyCleanupKind(r("Longsword Attack"))).toBe("attack");
    expect(classifyCleanupKind(r("Fire Damage"))).toBe("damage");
    expect(classifyCleanupKind(r("Dexterity Saving Throw"))).toBe("save");
    expect(classifyCleanupKind(r("Something else"))).toBeNull();
  });

  test("plain OOC chat", () => {
    expect(
      classifyCleanupKind({
        content: "lol",
        whisper: [],
        rolls: [],
        style: CONST.CHAT_MESSAGE_STYLES.OOC,
        flags: {},
      }),
    ).toBe("chat");
  });
});

describe("matchesChecklist", () => {
  test("respects enabled kinds", () => {
    expect(matchesChecklist(pf2e("attack-roll"), DEFAULT_KINDS)).toBe(true);
    expect(matchesChecklist(pf2e("skill-check"), DEFAULT_KINDS)).toBe(false);
    expect(
      matchesChecklist(pf2e("attack-roll"), {
        ...DEFAULT_KINDS,
        attack: false,
      }),
    ).toBe(false);
  });

  test("whispers to a GM are always kept", () => {
    expect(
      matchesChecklist(
        pf2e("attack-roll", { whisper: ["gm1"] }),
        DEFAULT_KINDS,
      ),
    ).toBe(false);
  });

  test("whispers only to players follow the checklist", () => {
    expect(
      matchesChecklist(pf2e("attack-roll", { whisper: ["p1"] }), DEFAULT_KINDS),
    ).toBe(true);
  });
});

describe("selectForCleanup", () => {
  const combat = { id: "c1", started: true, round: 3, turn: 1 };

  test("selects only stamped, eligible, matching messages of this combat", () => {
    const old = stamped(pf2e("attack-roll"), "c1", 2, 1);
    const recent = stamped(pf2e("damage-roll"), "c1", 2, 2);
    const otherCombat = stamped(pf2e("saving-throw"), "c2", 1, 0);
    const unstamped = pf2e("damage-roll");
    const spell = stamped(
      {
        id: "spell",
        content: "",
        whisper: [],
        rolls: [],
        flags: { pf2e: { origin: { type: "spell" } } },
      },
      "c1",
      1,
      0,
    );
    const gmWhisper = stamped(
      pf2e("attack-roll", { whisper: ["gm1"] }),
      "c1",
      1,
      0,
    );

    const result = selectForCleanup(
      [old, recent, otherCombat, unstamped, spell, gmWhisper],
      combat,
      DEFAULT_KINDS,
    );
    expect(result).toEqual([old]);
  });
});
