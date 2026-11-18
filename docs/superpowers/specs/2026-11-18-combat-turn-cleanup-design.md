# Combat Turn Cleanup — Design

Date: 2026-11-18
Status: Draft, awaiting approval

## Intent

Players asked (Discord, 2026-11-18) for chat to stay readable during combat. GMs currently clear chat by hand mid-fight just to find things, which also loses spell/ability cards they want to reference (save DCs, Kineticist impulses, ongoing effects). Goal: auto-remove resolved combat noise (attacks, saves, damage, HP changes) while keeping reference cards.

## Goals

- When the combat tracker advances, archive + delete checklist-matching messages that are **more than one full round old**.
- GM-configurable checklist of message kinds to clear.
- Spell/ability/feat/item cards and GM whispers are never cleared.
- Cleared messages go to the archive (searchable), same as a normal trim.

## Non-goals (this version)

- Per-type time-to-live (e.g. OOC chatter after 15 min) — separate future feature, will reuse the type filters.
- Cleanup at combat end. The final round stays; normal auto/manual trim handles it later.
- Retroactively clearing messages created before this feature existed.

## Anti-goals

- Deleting something the GM still needs to act on (unapplied damage button) — hence the one-round buffer.
- Clearing anything on a rewind/previous-turn.
- Multiple clients deleting the same messages.

## Constraints

- Foundry v13–v14. Only the active GM runs cleanup.
- PF2e is primary; other systems are best-effort (heuristic classification), labelled as such in settings.
- Independent of `disableAutoTrimDuringEncounter` — works even when that is on.
- Delete in small batches (reuse existing batching pattern in `chat-cleanup.js`) to avoid chat stalls.

## Approaches

- **A. Stamp messages with combat position (chosen).** `preCreateChatMessage` on the author's client calls `updateSource` to add `flags.chat-trimmer.combatPos = { combatId, round, turn }` when a combat is active and started. No extra DB write. On `updateCombat` (turn/round change), the GM selects stamped messages for that combat whose position is ≥ one full round behind the new current position, filters by checklist, and passes them to `trim()`. Robust to rewinds, skips, reloads. Unstamped (pre-update) messages are never cleared.
- B. Record turn-start timestamps in a combat flag, select by time window. Rejected: overlapping windows on rewinds/mid-turn changes, extra bookkeeping, no benefit over A.
- C. Derive turn from PF2e message flags. Rejected: PF2e doesn't reliably store round; locks to one system.

## Behaviour

- **"One round old"**: with current position (R, T), a message stamped (r, t) is eligible iff `(r, t) <= (R - 1, T)` in lexical order (`r < R - 1`, or `r === R - 1 && t <= T`). The current combatant's previous turn and everything earlier is cleared; the last full round is kept. Express as a pure, unit-tested function. Known edge: adding/removing combatants shifts turn indexes — accepted (worst case one turn cleared early/late).
- **Trigger**: only fire when position moves forward (compare with `options`/previous round+turn in `preUpdateCombat`/`updateCombat`). Backward moves do nothing.
- **Ownership**: run only on `game.users.activeGM === game.user`.
- **Archiving**: call `chatTrimmer.trim(selected, { ignoreKeep: true })` (or equivalent option that skips the "messages to keep" slice). If archiving is disabled globally, messages are just deleted (existing behaviour of `trim`). Must not show the "no messages" warning when the selection is empty — just no-op silently.

## Checklist (settings)

New settings group "Combat turn cleanup":

- `combatCleanupEnabled` (bool, default false)
- Kinds, each a bool:
  - attack rolls / spell attack rolls — default on
  - saving throws — default on
  - damage rolls — default on
  - HP change / damage-taken cards — default on
  - skill & perception checks — default off
  - initiative rolls — default off
  - plain chat (OOC) — default off

PF2e detection: `flags.pf2e.context.type` (`attack-roll`, `spell-attack-roll`, `saving-throw`, `damage-roll`, `skill-check`, `perception-check`, `initiative`) and the applied-damage card flag (`flags.pf2e.appliedDamage`). Non-PF2e fallback: `flags.core.initiativeRoll`, roll messages + keyword heuristics already in `trimmer.js`.

## Always kept

- PF2e item/spell/action/feat cards (`flags.pf2e.origin` with item card and no roll context, or non-roll messages carrying an item).
- Any whisper that includes a GM recipient.
- Anything not matching an enabled checklist kind.

## Builder's call

- Exact file layout (suggest `scripts/utils/combat-cleanup.js` with pure helpers: `stampPosition`, `isEligible(pos, current)`, `matchesChecklist(msg, settings)`), and tests in `tests/combat-cleanup.test.js`.
- Settings UI placement within the existing settings panel, and lang keys in `lang/en.json`.
- CHANGELOG + README entry.
