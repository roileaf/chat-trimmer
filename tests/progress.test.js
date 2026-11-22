import { deleteInBatches } from "../scripts/utils/chat-cleanup.js";
import { createProgress } from "../scripts/utils/progress.js";

describe("deleteInBatches", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("deletes in batches of 10 and reports progress", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `m${i}`);
    const deleteDocuments = jest.fn(async () => {});
    const onProgress = jest.fn();

    const done = deleteInBatches({ deleteDocuments }, ids, { onProgress });
    await jest.runAllTimersAsync();
    await done;

    expect(deleteDocuments.mock.calls.map(([batch]) => batch.length)).toEqual([
      10, 10, 5,
    ]);
    expect(onProgress.mock.calls).toEqual([
      [10, 25],
      [20, 25],
      [25, 25],
    ]);
  });

  test("no-op for empty list", async () => {
    const deleteDocuments = jest.fn();
    await deleteInBatches({ deleteDocuments }, []);
    expect(deleteDocuments).not.toHaveBeenCalled();
  });
});

describe("createProgress", () => {
  let bar;

  beforeEach(() => {
    bar = { update: jest.fn() };
    ui.notifications.info = jest.fn(() => bar);
  });

  test("opens a progress notification and updates it", () => {
    const progress = createProgress("Trimming chat");
    progress.update(0.5, "Saving archive…");
    progress.done("Done");

    expect(ui.notifications.info).toHaveBeenCalledWith(
      "Trimming chat",
      expect.objectContaining({ progress: true }),
    );
    expect(bar.update).toHaveBeenCalledWith({
      pct: 0.5,
      message: "Trimming chat — Saving archive…",
    });
    expect(bar.update).toHaveBeenLastCalledWith({
      pct: 1,
      message: "Trimming chat — Done",
    });
  });

  test("disabled progress shows nothing", () => {
    const progress = createProgress("Trimming chat", { enabled: false });
    progress.update(0.5, "x");
    progress.done("y");
    expect(ui.notifications.info).not.toHaveBeenCalled();
  });

  test("falls back to a plain notification when progress is unsupported", () => {
    ui.notifications.info = jest.fn(() => undefined);
    const progress = createProgress("Trimming chat");
    progress.update(0.5, "x");
    progress.done("Done");
    expect(ui.notifications.info).toHaveBeenLastCalledWith(
      "Trimming chat — Done",
    );
  });
});

describe("deleteInBatches with messages removed elsewhere", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const serverWith = (ids) => {
    const alive = new Set(ids);
    return {
      alive,
      deleteDocuments: jest.fn(async (batch) => {
        const missing = batch.find((id) => !alive.has(id));
        if (missing)
          throw new Error(`ChatMessage "${missing}" does not exist!`);
        batch.forEach((id) => alive.delete(id));
      }),
    };
  };

  test("skips ids that no longer exist before each batch", async () => {
    const ids = Array.from({ length: 15 }, (_, i) => `m${i}`);
    const server = serverWith(ids);
    server.alive.delete("m12"); // deleted by someone else after the snapshot
    const onProgress = jest.fn();

    const done = deleteInBatches(server, ids, {
      exists: (id) => server.alive.has(id),
      onProgress,
    });
    await jest.runAllTimersAsync();
    await done;

    expect(server.alive.size).toBe(0);
    expect(onProgress).toHaveBeenLastCalledWith(15, 15);
  });

  test("retries once without ids removed during the request", async () => {
    const ids = ["a", "b", "c"];
    const server = serverWith(ids);
    const real = server.deleteDocuments;
    server.deleteDocuments = jest.fn(async (batch) => {
      if (server.deleteDocuments.mock.calls.length === 1)
        server.alive.delete("b");
      return real(batch);
    });

    const done = deleteInBatches(server, ids, {
      exists: (id) => server.alive.has(id),
    });
    await jest.runAllTimersAsync();
    await done;

    expect(server.deleteDocuments).toHaveBeenCalledTimes(2);
    expect(server.deleteDocuments.mock.calls[1][0]).toEqual(["a", "c"]);
    expect(server.alive.size).toBe(0);
  });

  test("other errors still propagate", async () => {
    const server = {
      deleteDocuments: jest.fn(async () => {
        throw new Error("permission denied");
      }),
    };
    await expect(
      deleteInBatches(server, ["a"], { exists: () => true }),
    ).rejects.toThrow("permission denied");
  });
});
