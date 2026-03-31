---
name: ai-feature-worker
description: Implements features involving AI integration (OpenAI GPT-4o, Anthropic Claude) with mock layer architecture for the Katalis platform.
---

# AI Feature Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features that involve:
- OpenAI GPT-4o multimodal analysis (image/audio artifact analysis)
- Anthropic Claude reasoning (quest generation, story analysis)
- AI-powered clustering or categorization
- Prompt engineering and response parsing
- Mock AI response design

## Required Skills

- **agent-browser**: MUST be invoked for UI verification after implementation. Verify loading states, result display, error handling, and retry flows.

## Work Procedure

### 1. Understand the Feature
- Read `mission.md`, `AGENTS.md`, and `.factory/library/architecture.md`
- Read the feature description, expectedBehavior, and verificationSteps
- Read `.factory/library/environment.md` for AI configuration details
- Understand which AI provider is used (OpenAI vs Anthropic) and what the expected input/output is

### 2. Design the AI Interface
Before writing tests, design the contract between the app and AI:
- Define the input schema (what gets sent to the AI)
- Define the output schema (what the AI returns — use Zod for validation)
- Define the prompt template
- Document these in a comment block at the top of the AI client file

Example:
```typescript
// Input: { imageUrl: string, locale: "en" | "id" }
// Output: { talents: Array<{ name: string, confidence: number, reasoning: string }> }
// Prompt: "Analyze this child's artwork. Look beyond surface..."
```

### 3. Create Mock Responses First
- Create realistic mock response files in `src/lib/ai/mock/`
- Each mock should return deterministic JSON matching the output schema
- Create multiple mock variants for different scenarios (success, different talent types)
- Mock responses should be realistic — use actual talent names and detailed reasoning
- For bilingual support: create both English and Indonesian mock responses if the feature requires locale-aware content

Example mock file structure:
```
src/lib/ai/mock/
├── multimodal-analysis.ts    # GPT-4o image analysis mock
├── story-analysis.ts         # Claude story analysis mock
├── quest-generation.ts       # Claude quest generation mock
└── clustering.ts             # AI clustering mock
```

### 4. Write Tests (TDD - Red Phase)
- Write failing tests covering:
  - AI client: mock toggle works, correct provider called, response parsed correctly
  - API route: request validation, AI integration, error handling, timeout
  - UI: loading state shown during analysis, results displayed correctly, error state with retry
  - Edge cases: AI returns unexpected format, network failure, timeout
- Run `bun run test` to confirm tests fail

### 5. Implement AI Client
- Create the AI client module (e.g., `src/lib/ai/openai.ts`)
- Implement the mock/real toggle using `USE_MOCK_AI` env var:
  ```typescript
  export async function analyzeArtifact(input: AnalysisInput): Promise<AnalysisOutput> {
    if (process.env.USE_MOCK_AI === "true") {
      return getMockAnalysis(input);
    }
    // Real API call
    return callOpenAI(input);
  }
  ```
- Parse and validate the response with Zod (both mock and real paths)
- Handle errors gracefully: timeout, rate limit, invalid response, network failure

### 6. Implement API Route
- Create the API route handler
- Validate input with Zod
- Call the AI client
- Sanitize any user-provided text in the input (XSS prevention)
- Return structured JSON response

### 7. Implement UI
- Build the user interface components
- Show clear loading states during AI processing (spinner + encouraging text)
- Display results with talent names and reasoning
- Implement error states with retry button
- Add translations for all UI text
- Ensure the submit button is disabled during processing (prevent duplicate requests)

### 8. Run Validators
- `bun run test` — all tests passing
- `bun run typecheck` — zero errors
- `bun run lint` — zero errors

### 9. Manual Verification with agent-browser
- Start dev server: `PORT=3100 bun run dev`
- Invoke `agent-browser` to verify:
  - Happy path: submit input → see loading → see results
  - Error path: simulate failure → see error message → retry
  - Loading state: verify UI is responsive during analysis, submit disabled
  - Results display: talent names, confidence, reasoning are all visible
  - Both locales: test in /en/ and /id/
  - Mobile viewport: test at 375px width

### 10. Commit
- Stage all changes including mock files
- Clear commit message

## Example Handoff

```json
{
  "salientSummary": "Built GPT-4o multimodal analysis with mock layer. Designed prompt for deep talent detection (beyond surface-level). Created 3 mock response variants. Ran `bun run test` (8 passing), verified full analysis flow via agent-browser in both locales.",
  "whatWasImplemented": "Multimodal analysis pipeline: POST /api/discovery/analyze endpoint accepting image URL, OpenAI GPT-4o client with mock toggle, 3 mock response files (engineering-talent.json, artistic-talent.json, narrative-talent.json), Zod schemas for input/output validation, analysis results component with talent cards showing name/confidence/reasoning, loading spinner with 'Analyzing your creation...' text, error state with retry button. Mock responses include detailed reasoning (e.g., 'Focus on mechanical joints and cable routing suggests engineering/mechanics interest rather than artistic composition').",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "bun run test", "exitCode": 0, "observation": "8 tests passing: analyze-route.test.ts (4), openai-client.test.ts (2), analysis-results.test.tsx (2)" },
      { "command": "bun run typecheck", "exitCode": 0, "observation": "No errors" },
      { "command": "bun run lint", "exitCode": 0, "observation": "Clean" }
    ],
    "interactiveChecks": [
      { "action": "Upload test image at /en/discover, wait for analysis", "observed": "Loading spinner shown with 'Analyzing your creation...', after 1s mock delay results appear with 3 talent cards" },
      { "action": "Check results at /id/discover after analysis", "observed": "UI labels in Indonesian, talent reasoning in English (AI-generated content not translated)" },
      { "action": "Trigger error by temporarily breaking mock, click retry", "observed": "Error message 'Something went wrong. Let's try again!' with retry button, retry succeeds" },
      { "action": "Submit and immediately try to submit again", "observed": "Submit button disabled during analysis, preventing duplicate requests" }
    ]
  },
  "tests": {
    "added": [
      { "file": "src/app/api/discovery/__tests__/analyze.test.ts", "cases": [
        { "name": "returns 200 with talent analysis for valid image", "verifies": "VAL-DISC-010" },
        { "name": "returns 500 with friendly error on AI failure", "verifies": "VAL-DISC-013" },
        { "name": "validates request body with Zod", "verifies": "request validation" },
        { "name": "sanitizes input to prevent XSS", "verifies": "VAL-DISC-046" }
      ]},
      { "file": "src/lib/ai/__tests__/openai-client.test.ts", "cases": [
        { "name": "returns mock response when USE_MOCK_AI=true", "verifies": "mock toggle" },
        { "name": "validates response schema with Zod", "verifies": "response parsing" }
      ]}
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- AI mock response schema doesn't match what the UI expects (schema mismatch between features)
- The storage client or upload flow is not yet implemented (needed for artifact analysis)
- The discovery/quest data model is missing fields needed for AI input/output
- Real AI API key is needed but only mock is available (flag and continue with mock)
- Prompt design requires domain expertise decisions (what constitutes "deep" talent analysis)
