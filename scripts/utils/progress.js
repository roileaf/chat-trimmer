/**
 * Progress bar for long operations, using Foundry's progress notification
 * (v13+). Falls back to a single completion notification if unsupported.
 * @param {string} title - Prefix shown on every update.
 * @param {{enabled?: boolean}} [options]
 */
export function createProgress(title, { enabled = true } = {}) {
  if (!enabled) return { update() {}, done() {} };

  const bar = ui.notifications.info(title, { progress: true });
  const canUpdate = typeof bar?.update === "function";
  const label = (message) => `${title} — ${message}`;

  return {
    update(pct, message) {
      if (canUpdate) bar.update({ pct, message: label(message) });
    },
    done(message) {
      if (canUpdate) bar.update({ pct: 1, message: label(message) });
      else ui.notifications.info(label(message));
    },
  };
}
