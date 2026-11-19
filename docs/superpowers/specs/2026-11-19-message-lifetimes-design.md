# Message Lifetimes (Per-Type Timers) — Design

Date: 2026-11-19
Status: Draft, awaiting approval

## Intent

Player request (camrun91, Discord 2026-11-18): let some message types be trimmed sooner. Casual player chatter can go after 10–15 minutes; GM posts and spell cards should last longer. Complements Combat Turn Cleanup (2.2.0), which handles combat rolls.

## Goals

- Each message type has its own lifetime in minutes; 0 = never.
- Lifetime counts **only time while the world is running** (decided by user).
- Expired messages are archived + removed silently (same path as combat cleanup).
- Default config only clears player OOC chat after 15 minutes.

## Non-goals

- Clearing messages created before the feature is enabled (unstamped).
- Per-user or per-actor lifetimes.

## Anti-goals

- Clearing a world's last-session chatter the moment it loads.
- Per-message DB writes on a timer (stall risk addressed in 2.1.1).

## Approaches

- **A. Shared world clock + creation stamp (chosen).** World setting `worldClockMinutes` (Number, hidden). Active GM increments by 1 every 60 s, skipping while paused if `pauseTimerWithGame` is on. `preCreateChatMessage` stamps `flags.chat-trimmer.clock = <current clock>` via `updateSource`. Age = clock − stamp. ≤1 minute skew on player clients accepted.
- B. Record running intervals with heartbeat. Rejected: unclean shutdown needs guessing, list grows, harder age math.
- C. Per-message running age updates. Rejected: one DB write per message per minute.

## Types and defaults (first match wins)

| Type key | Rule | Default |
|---|---|---|
| `whisper` | `whisper.length > 0` | 0 |
| `gm` | author is GM | 0 |
| `card` | spell/ability/item card (item origin, no roll context) | 0 |
| `combat` | cleanup kind attack/save/damage/hpChange/initiative | 0 |
| `roll` | any other roll | 0 |
| `ic` | IC or EMOTE style | 0 |
| `ooc` | everything else from a player (OOC/plain) | 15 |

Settings: `lifetimesEnabled` (Boolean, default false) + `lifetime<Type>` Number (0–240, step 5) per type.

## Behaviour

- Tick runs only when `lifetimesEnabled` and on `game.users.activeGM`.
- Each tick (after incrementing): select messages with `clock` stamp where `age >= lifetime(type) > 0`; if any, `chatTrimmer.trim(selected, { ignoreKeep: true, silent: true })`. If a trim is in progress, the next tick retries.
- Independent of auto-trim method and "messages to keep".
- Stamping happens whenever `lifetimesEnabled`, regardless of combat.

## Builder's call

- Helpers in `scripts/utils/message-lifetimes.js`: `classifyLifetimeType(msg)`, `isExpired(stamp, clock, lifetime)`, `selectExpired(messages, clock, lifetimes)`; reuse `classifyCleanupKind` from `combat-cleanup.js` (export an `isReferenceCard` helper there).
- Tests in `tests/message-lifetimes.test.js`; lang keys, README, CHANGELOG `[Unreleased]` (top of file).
