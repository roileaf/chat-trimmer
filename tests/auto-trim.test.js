import { runAutoTrim, shouldSkipAutoTrim } from "../scripts/utils/auto-trim.js";

describe("shouldSkipAutoTrim", () => {
  test("skips auto-trim during active combat when setting enabled", () => {
    expect(
      shouldSkipAutoTrim({
        autoTrimMethod: "messageCount",
        disableDuringEncounter: true,
        hasActiveCombat: true,
      }),
    ).toBe(true);
  });

  test("does not skip when setting disabled", () => {
    expect(
      shouldSkipAutoTrim({
        autoTrimMethod: "messageCount",
        disableDuringEncounter: false,
        hasActiveCombat: true,
      }),
    ).toBe(false);
  });

  test("does not skip manual mode", () => {
    expect(
      shouldSkipAutoTrim({
        autoTrimMethod: "disabled",
        disableDuringEncounter: true,
        hasActiveCombat: true,
      }),
    ).toBe(false);
  });
});

describe("runAutoTrim", () => {
  test("trims silently (no toast) and records the trim time", async () => {
    const trimmer = { trim: jest.fn(async () => ({})) };
    game.settings.set = jest.fn();
    await runAutoTrim(trimmer);
    expect(trimmer.trim).toHaveBeenCalledWith(null, { silent: true });
    expect(game.settings.set).toHaveBeenCalledWith(
      "chat-trimmer",
      "lastTrimTime",
      expect.any(Number),
    );
  });
});
