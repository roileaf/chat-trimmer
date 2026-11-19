# Campaign Stats Dashboard — Design

Date: 2026-11-19
Status: Approved in conversation (approach A)

## Intent

Roadmap Phase 3 "Archive statistics dashboard". Built for the table's enjoyment (per-character leaderboards), with a one-line module-health footer.

## Goals

- Stats window opened from the archive viewer header (chart icon). Same visibility as the viewer (respects "Hide archives from players").
- Scope: whole campaign or one session.
- Highlights: most nat 20s, most nat 1s, biggest hit.
- Table per character: rolls, nat 20, nat 1, crit success, crit failure, damage dealt.
- Player-owned actors get their own row; GM rolls / non-player actors go to one "GM / NPCs" row (no enemy name spoilers).
- Per-session bars (roll counts) for trend.
- Footer: messages archived, compression ratio.

## Approaches

- **A. Compute per-character stats at trim time from raw messages, store on archive (chosen).** Exact dice (nat 20/1) even for messages later compressed into combat summaries. Stored as `statistics.byActor`; merged on append.
- B. Derive at view time from archived entries. Rejected as primary: combat summaries drop dice, so headline numbers would be wrong. Used only as fallback for archives without `byActor` (from individual entries' `originalMessage`), marked "partial".

## Data

`statistics.byActor = { [name]: { rolls, nat20, nat1, critSuccess, critFail, damage, biggestHit } }`
`statistics.byActorPartial = true` when an archive predating this feature receives appended stats.

- Roller: `speaker.actor` → actor with `hasPlayerOwner` → actor name. GM author or non-player actor → "GM / NPCs". Otherwise speaker alias / user name.
- d20 results: walk roll terms (live Roll or serialized JSON) for dice with 20 faces; count active results of 20 / 1.
- Crits: PF2e `flags.pf2e.context.outcome` (`criticalSuccess` / `criticalFailure`), else text "critical success/hit", "critical failure/miss" in content/flavor.
- Damage: messages classified as `damage` by combat-cleanup's classifier; sum of roll totals; biggest hit = max.

## Non-goals

- Charts library; bars are CSS.
- Editing or resetting stats.

## Builder's call

`scripts/utils/actor-stats.js` (pure: `extractD20Results`, `getRollerName`, `computeActorStats`, `mergeActorStats`, `summarizeStats`), `scripts/ui/campaign-stats.js` (ApplicationV2), `templates/campaign-stats.hbs`, styles in `styles/archive-viewer.css`, tests `tests/actor-stats.test.js`.
