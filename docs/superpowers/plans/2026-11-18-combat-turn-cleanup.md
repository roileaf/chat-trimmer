# Combat Turn Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On combat turn advance, archive + delete checklist-matching chat messages older than one full round.

**Architecture:** Pure helpers in `scripts/utils/combat-cleanup.js` (stamp builder, eligibility, checklist matcher, forward-move check). `main.js` wires `preCreateChatMessage` (stamp via `updateSource`) and `updateCombat` (active GM selects + calls `chatTrimmer.trim(selected, { ignoreKeep: true, silent: true })`).

**Tech Stack:** Foundry VTT v13–14 ES modules, Jest (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-18-combat-turn-cleanup-design.md`

## Global Constraints

- Flag path: `flags["chat-trimmer"].combatPos = { combatId, round, turn }`.
- Only `game.users.activeGM?.isSelf` runs cleanup.
- Independent of `disableAutoTrimDuringEncounter`.
- Default kinds on: attack, save, damage, hpChange. Off: skill, initiative, chat.

## Review Focus

1. Backward move (rewind turn/round) → nothing cleared. Test in Task 1 (`isForwardMove`).
2. Message stamped in a different combat → never cleared by this combat. Test in Task 1 (`selectForCleanup`).
3. Unstamped messages → never cleared. Test in Task 1.
4. GM whisper roll matching checklist → kept. Test in Task 1 (`matchesChecklist`).
5. Spell card with save DC (PF2e item card, no roll context) → kept. Test in Task 1.

---

### Task 1: Pure helpers

**Files:** Create `scripts/utils/combat-cleanup.js`; Test `tests/combat-cleanup.test.js`

**Produces:**
- `buildCombatStamp(combat) -> {combatId, round, turn} | null` (null if no combat, not started, round < 1)
- `isEligible(stamp, current: {round, turn}) -> boolean` — `r < R-1 || (r === R-1 && t <= T)`
- `isForwardMove(prev: {round, turn}, next: {round, turn}) -> boolean` — lexical `next > prev`
- `classifyCleanupKind(msg) -> "attack"|"save"|"damage"|"hpChange"|"skill"|"initiative"|"chat"|null`
- `matchesChecklist(msg, kinds: Record<string, boolean>) -> boolean` — false for GM-recipient whispers
- `selectForCleanup(messages, combat, kinds) -> ChatMessage[]`

- [ ] Write tests covering each function + Review Focus 1–5; run (fail); implement; run (pass); commit.

### Task 2: Wiring + trim option

**Files:** Modify `scripts/main.js`, `scripts/trimmer.js` (`options.silent` suppresses completion info notification)

- [ ] `preCreateChatMessage`: if `combatCleanupEnabled` and stamp non-null, `message.updateSource({"flags.chat-trimmer.combatPos": stamp})`.
- [ ] `preUpdateCombat` record prior `{round, turn}` in `options.chatTrimmerPrev`; `updateCombat`: if enabled, active GM, `"turn" in changed || "round" in changed`, forward move → select & trim (skip if empty).
- [ ] Commit.

### Task 3: Settings, lang, docs

**Files:** `scripts/ui/settings-panel.js`, `lang/en.json`, `README.md`, `CHANGELOG.md`

- [ ] Register `combatCleanupEnabled` + `combatCleanupKinds` (Object, config false) + one Boolean per kind (`combatCleanup<Kind>`), PF2e-best-effort hint. Commit.

### Task 4: Verify

- [ ] `npm test` and `npm run lint` pass.
