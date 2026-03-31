---
name: fullstack-worker
description: Implements full-stack features spanning database, API routes, and React UI for the Katalis platform.
---

# Fullstack Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features that involve any combination of:
- Prisma schema changes or database operations
- Next.js API route handlers
- React UI components and pages
- File upload/storage integration
- i18n translation additions
- Layout, navigation, and responsive design
- Cross-area integration and data flow features

## Required Skills

- **agent-browser**: MUST be invoked for UI verification after implementation. Use to navigate the app, test user flows, take screenshots, and verify responsive behavior.

## Work Procedure

### 1. Understand the Feature
- Read `mission.md`, `AGENTS.md`, and `.factory/library/architecture.md`
- Read the feature description, preconditions, expectedBehavior, and verificationSteps
- Read `.factory/library/` files relevant to this feature
- Identify which files need to be created or modified

### 2. Write Tests First (TDD - Red Phase)
- Create test files BEFORE implementation
- Write failing tests that cover:
  - API route handlers: request validation, response shape, error cases
  - React components: rendering, user interaction, state changes
  - Utility functions: input/output, edge cases
- Run `bun run test` to confirm tests fail (red)
- Minimum test coverage: every item in `expectedBehavior` should have a corresponding test

### 3. Implement (Green Phase)
- Write the minimum code to make tests pass
- Follow coding conventions from AGENTS.md:
  - Use Prisma for DB, Zod for validation, next-intl for translations
  - shadcn/ui components with Tailwind styling
  - Server Components by default, `"use client"` only when needed
  - Sanitize all user input (XSS prevention)
  - Strip EXIF from uploaded images
- Run `bun run test` to confirm tests pass (green)

### 4. Add Translations
- Add all new user-facing strings to both `messages/en.json` and `messages/id.json`
- Never hardcode text in components

### 5. Run Validators
- `bun run typecheck` — must pass with zero errors
- `bun run lint` — must pass with zero errors
- `bun run test` — all tests passing

### 6. Manual Verification with agent-browser
- Start the dev server if not running: `PORT=3100 bun run dev`
- Invoke `agent-browser` to verify EACH user flow from the feature's expectedBehavior
- Test in both English (`/en/`) and Indonesian (`/id/`) locales
- Test on mobile viewport (375px width) if the feature has UI
- Check for console errors
- Each flow tested = one entry in `interactiveChecks` in the handoff

### 7. Commit
- Stage all changes
- Write a clear commit message describing what was built
- Ensure no secrets or sensitive data in the commit

## Example Handoff

```json
{
  "salientSummary": "Built access code auth system with login page, POST /api/auth/login endpoint, session middleware, and logout. Ran `bun run test` (12 passing), `bun run typecheck` (clean), verified login flow in both /en/ and /id/ locales via agent-browser.",
  "whatWasImplemented": "Access code authentication: login page with code input and validation errors, POST /api/auth/login route with Zod validation returning session cookie, auth middleware protecting /dashboard and child routes, logout route clearing session, access code generation API at POST /api/auth/codes. Seed script creates 2 valid codes (KATAL-001, KATAL-002) and 1 expired code (KATAL-EXP).",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "bun run test", "exitCode": 0, "observation": "12 tests passing in 3 files: auth.test.ts (5), login-page.test.tsx (4), middleware.test.ts (3)" },
      { "command": "bun run typecheck", "exitCode": 0, "observation": "No errors" },
      { "command": "bun run lint", "exitCode": 0, "observation": "No warnings or errors" }
    ],
    "interactiveChecks": [
      { "action": "Navigate to /en/login, enter KATAL-001, submit", "observed": "Redirected to /en/dashboard, session cookie set, header shows authenticated state" },
      { "action": "Navigate to /id/login, enter invalid code XXXXX, submit", "observed": "Error message in Indonesian: 'Kode akses tidak valid', stayed on login page" },
      { "action": "Click logout button", "observed": "Redirected to /en/login, session cleared, visiting /en/dashboard redirects back to login" },
      { "action": "Resize to 375px width, test login flow", "observed": "Login form fills full width, submit button accessible, no horizontal scroll" }
    ]
  },
  "tests": {
    "added": [
      { "file": "src/app/api/auth/__tests__/login.test.ts", "cases": [
        { "name": "returns 200 with session for valid code", "verifies": "VAL-FOUND-005" },
        { "name": "returns 401 for invalid code", "verifies": "VAL-FOUND-002" },
        { "name": "returns 401 for expired code", "verifies": "VAL-FOUND-003" },
        { "name": "returns 400 for empty code", "verifies": "VAL-FOUND-004" },
        { "name": "rejects SQL injection attempts", "verifies": "VAL-FOUND-042" }
      ]},
      { "file": "src/app/[locale]/(auth)/login/__tests__/page.test.tsx", "cases": [
        { "name": "renders login form with code input", "verifies": "VAL-FOUND-001" },
        { "name": "shows validation error for empty submit", "verifies": "VAL-FOUND-004" },
        { "name": "shows error message for invalid code", "verifies": "VAL-FOUND-002" },
        { "name": "renders in current locale language", "verifies": "VAL-FOUND-034" }
      ]}
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature depends on a database table or API endpoint that doesn't exist yet and isn't part of this feature
- The preconditions listed in the feature are not met
- A shadcn/ui component needed is not installed and `bunx shadcn@latest add` fails
- Tests reveal bugs in previously completed features
- Requirements in the feature description are ambiguous or contradictory
- EXIF stripping library is not available or doesn't work with bun
