/**
 * Campaign Stats dashboard: per-character roll leaderboards across archives.
 */
import { summarizeStats } from "../utils/actor-stats.js";

export class CampaignStatsApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  constructor(archiveManager, options = {}) {
    super(options);
    this.archiveManager = archiveManager;
    this.scope = "campaign"; // "campaign" or a session number (string)
  }

  static DEFAULT_OPTIONS = {
    id: "chat-trimmer-campaign-stats",
    classes: ["chat-trimmer-viewer", "chat-trimmer-stats"],
    tag: "div",
    window: {
      title: "CHATTRIMMER.Stats.Title",
      icon: "fa-solid fa-chart-column",
      resizable: true,
      minimizable: true,
    },
    position: { width: 640, height: 600 },
  };

  static PARTS = {
    body: { template: "modules/chat-trimmer/templates/campaign-stats.hbs" },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sessions = await this.archiveManager.getSessionStats();
    const selected =
      this.scope === "campaign"
        ? sessions
        : sessions.filter((s) => String(s.number) === this.scope);
    const summary = summarizeStats(selected);
    return {
      ...context,
      hasData: summary.rows.length > 0,
      scopeOptions: [
        {
          value: "campaign",
          label: game.i18n.localize("CHATTRIMMER.Stats.WholeCampaign"),
          selected: this.scope === "campaign",
        },
        ...sessions.map((s) => ({
          value: String(s.number),
          label: s.name,
          selected: String(s.number) === this.scope,
        })),
      ],
      showBars: this.scope === "campaign" && summary.sessionBars.length > 1,
      ...summary,
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.element
      .querySelector("select[name=scope]")
      ?.addEventListener("change", (event) => {
        this.scope = event.target.value;
        this.render();
      });
  }
}
