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

# OpenCode Operating Mode

Follow `opencode.md`: extension sprint, direct-first. Simple/local tasks are handled by main agent without subagent. Delegate only after delegation gate passes.
