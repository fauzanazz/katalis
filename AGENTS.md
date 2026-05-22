# Clean Code Philosophy
Every line liability. Best code: no code.

- DRY: write twice = doing it wrong
- YAGNI: build only what's needed NOW
- KISS: complexity kills maintainability
- Readability > cleverness
- Self-documenting: names explain what, comments explain why. Always descriptive names, even in map/filter.
- Pure functions default; class only for shared mutable state or real polymorphism
- Compose > inherit
- Interface/type first; class only when behaviour + state need runtime instances
- Flag module >200 LOC or class >5 public methods as god object to split
- FP: short chains fine; avoid nested point-free puzzles

--- project-doc ---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI Feedback

- Never use `window.alert`, `window.confirm`, or `window.prompt`. Use `toast` from `sonner` instead.
- Import: `import { toast } from "sonner"`
- Types: `toast()` info, `toast.success()`, `toast.error()`, `toast.warning()`
- `<Toaster />` already mounted in root layout — do not add it again.

# OpenCode Operating Mode

Follow `opencode.md`: extension sprint, direct-first. Simple/local tasks are handled by main agent without subagent. Delegate only after delegation gate passes.

# Operations notes

- `CRON_SECRET` (32-byte hex) must be set in every environment that runs Vercel cron. The
  `/api/admin/reliability/snapshot` endpoint requires it for the weekly reliability snapshot
  job defined in `vercel.ts`. Generate with `openssl rand -hex 32`.
