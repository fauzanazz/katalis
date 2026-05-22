# OpenCode Operating Mode: Extension Sprint

Default mode: direct-first. Main agent works simple tasks directly. Subagent use is exception, not default.

## Task Size

- S: clear scope, <=2 files, local edit, answer/docs/config/small bug. Work directly. No subagent.
- M: 3-5 related files or needs test/debug. Work directly first. Use at most 1 subagent only if useful.
- L: many areas, unclear scope, high risk, or >30 minutes estimate. Split into smaller tasks. Delegate selectively.

## Delegation Gate

Use subagent only when one condition true:

- parallel investigation needed
- specialized domain needed
- scope spans >3 unrelated areas
- security, privacy, or data-loss risk exists
- independent review needed
- estimated work >30 minutes

If none true, do not delegate.

## Sprint Loop

For each task:

1. Classify S/M/L.
2. Choose direct or delegated.
3. Make smallest useful change.
4. Run relevant validation.
5. Report result, tests, risks.

## Fast Path

These must be direct unless risk appears:

- typo/content change
- config tweak
- local bug with clear cause
- add small field/copy/translation
- update docs
- refactor inside one component/module
- single API or UI adjustment

## Escalation

Start direct. If hidden complexity appears, stop, explain blocker, then delegate only needed slice.

## Output Style

Keep plan short. Avoid long coordination notes for S tasks. Optimize for finished increment over orchestration.
