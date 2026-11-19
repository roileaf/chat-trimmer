import { ChatTrimmer } from "../scripts/trimmer.js";

describe("ChatTrimmer.formatIndividualDisplay", () => {
  test("formats damage application summaries as damage instead of spell casts", () => {
    const trimmer = new ChatTrimmer();
    const message = {
      content: "<p>Damage Taken</p>",
      flavor: "<strong>Fireball</strong>",
      flags: {
        pf2e: {
          origin: {
            type: "spell",
            item: { name: "Fireball" },
          },
          context: {},
        },
      },
      speaker: {
        alias: "Wizard",
      },
      rolls: [{ total: 18 }],
    };

    expect(trimmer.formatIndividualDisplay(message)).toContain("Damage");
    expect(trimmer.formatIndividualDisplay(message)).toContain("⚔️");
    expect(trimmer.formatIndividualDisplay(message)).not.toContain(
      "✨ Wizard: Fireball",
    );
  });
});

describe("ChatTrimmer.isKeyEvent", () => {
  test("ignores encounter round marker messages", () => {
    const trimmer = new ChatTrimmer();
    const message = {
      content: "<p>Round 2</p>",
      flavor: "",
      flags: {
        "monks-combat-details": {
          round: 2,
        },
      },
      rolls: [],
    };

    expect(trimmer.isKeyEvent(message)).toBe(false);
  });
});

describe("ChatTrimmer.trim progress", () => {
  let bar;
  beforeEach(() => {
    bar = { update: jest.fn() };
    ui.notifications.info = jest.fn(() => bar);
    ChatMessage.deleteDocuments = jest.fn(async () => {});
    game.settings.get = jest.fn(() => 0); // archiving off, keep 0
  });

  test("shows a progress bar and deletes in batches", async () => {
    const messages = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}` }));
    const trimmer = new ChatTrimmer();
    await trimmer.trim(messages, { ignoreKeep: true });

    expect(ChatMessage.deleteDocuments).toHaveBeenCalledTimes(2);
    expect(ui.notifications.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ progress: true }),
    );
    expect(bar.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ pct: 1 }),
    );
  });

  test("silent trims show no notification", async () => {
    const trimmer = new ChatTrimmer();
    await trimmer.trim([{ id: "a" }], { ignoreKeep: true, silent: true });
    expect(ui.notifications.info).not.toHaveBeenCalled();
    expect(ChatMessage.deleteDocuments).toHaveBeenCalledWith(["a"]);
  });
});
