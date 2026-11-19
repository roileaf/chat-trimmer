import {
  findSkillClusters,
  formatClusterSummary,
  formatMemberText,
  getSkillName,
} from "../scripts/algorithms/skill-cluster.js";

const pf2eCheck = (alias, total, domains, extra = {}) => ({
  id: `${alias}-${total}`,
  alias,
  timestamp: extra.timestamp ?? 0,
  content: String(total),
  flavor: "",
  rolls: [{ total }],
  flags: {
    pf2e: {
      context: {
        type: extra.type ?? "skill-check",
        domains,
        outcome: extra.outcome,
      },
    },
  },
});

describe("getSkillName", () => {
  test("PF2e skill and perception checks", () => {
    expect(
      getSkillName(pf2eCheck("V", 10, ["stealth", "dex-based", "skill-check"])),
    ).toBe("Stealth");
    expect(
      getSkillName(
        pf2eCheck("V", 10, ["perception"], { type: "perception-check" }),
      ),
    ).toBe("Perception");
    expect(
      getSkillName(pf2eCheck("V", 10, ["society-lore", "skill-check"])),
    ).toBe("Society Lore");
  });

  test("dnd5e skill id", () => {
    expect(
      getSkillName({
        rolls: [{}],
        flags: { dnd5e: { roll: { type: "skill", skillId: "prc" } } },
      }),
    ).toBe("Perception");
  });

  test("generic flavor fallback", () => {
    expect(
      getSkillName({
        rolls: [{}],
        flavor: "<b>Athletics Check</b>",
        flags: {},
      }),
    ).toBe("Athletics");
  });

  test("non-skill messages return null", () => {
    expect(
      getSkillName(pf2eCheck("V", 10, [], { type: "attack-roll" })),
    ).toBeNull();
    expect(
      getSkillName(pf2eCheck("V", 10, [], { type: "flat-check" })),
    ).toBeNull();
    expect(
      getSkillName({ rolls: [], flavor: "Stealth Check", flags: {} }),
    ).toBeNull();
    expect(
      getSkillName({ rolls: [{}], flavor: "Fire Damage", flags: {} }),
    ).toBeNull();
  });
});

describe("findSkillClusters", () => {
  const per = (alias, total, timestamp) =>
    pf2eCheck(alias, total, ["perception"], {
      type: "perception-check",
      timestamp,
    });

  test("groups same skill within the window, ignoring chat in between", () => {
    const chat = {
      id: "chat",
      timestamp: 30_000,
      content: "hi",
      rolls: [],
      flags: {},
    };
    const messages = [
      per("A", 10, 0),
      chat,
      per("B", 12, 60_000),
      per("C", 15, 170_000),
    ];
    const clusters = findSkillClusters(messages);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].skill).toBe("Perception");
    expect(clusters[0].messages.map((m) => m.alias)).toEqual(["A", "B", "C"]);
  });

  test("a gap over 2 minutes starts a new group; singletons are dropped", () => {
    const messages = [
      per("A", 10, 0),
      per("B", 12, 60_000),
      per("C", 15, 400_000),
    ];
    const clusters = findSkillClusters(messages);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].messages).toHaveLength(2);
  });

  test("different skills never mix", () => {
    const stealth = pf2eCheck("A", 10, ["stealth"], { timestamp: 1000 });
    const messages = [per("A", 10, 0), stealth, per("B", 12, 2000)];
    const clusters = findSkillClusters(messages);
    expect(clusters.map((c) => [c.skill, c.messages.length])).toEqual([
      ["Perception", 2],
    ]);
  });
});

describe("formatting", () => {
  test("summary sorts by total and shows PF2e degrees", () => {
    const cluster = {
      skill: "Perception",
      messages: [
        pf2eCheck("Ezren", 12, ["perception"], { outcome: "failure" }),
        pf2eCheck("Valeros", 25, ["perception"], {
          outcome: "criticalSuccess",
        }),
        pf2eCheck("Kyra", 21, ["perception"], { outcome: "success" }),
        pf2eCheck("Merisiel", 9, ["perception"], {
          outcome: "criticalFailure",
        }),
      ],
    };
    expect(formatClusterSummary(cluster)).toBe(
      "🎲 Perception ×4 — Valeros 25 ✓✓, Kyra 21 ✓, Ezren 12 ✗, Merisiel 9 ✗✗",
    );
  });

  test("no outcome means totals only", () => {
    expect(formatMemberText(pf2eCheck("Kyra", 21, ["perception"]))).toBe(
      "Kyra 21",
    );
  });
});
