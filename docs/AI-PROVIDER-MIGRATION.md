# AI Provider Migration Guide

## What Changed?

### Architecture Improvements

#### Before (Hardcoded Anthropic)
```typescript
// ❌ mentor/chat.ts - only worked with Claude
const Anthropic = await import("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await client.messages.create({...});
```

#### After (Provider-Agnostic)
```typescript
// ✅ mentor/chat.ts - works with any AI_PROVIDER
import { getProvider } from "../providers";
// Uses router to load correct provider implementation
const response = await callProviderForMentor(userMessage);
```

### Files Changed

Fixed 3 previously hardcoded files:

1. **`src/lib/ai/mentor/chat.ts`**
   - `mentorChat()` - now routes through provider system
   - `simplifyMission()` - uses `callProviderForJSON()`
   - `summarizeReflection()` - uses `callProviderForJSON()`
   - Added `callProviderForMentor()` helper
   - Added `callProviderForJSON()` helper

2. **`src/lib/ai/parent-report.ts`**
   - `generateAIReport()` - now provider-agnostic
   - Added `callProviderForReport()` helper
   - Supports all 7 AI providers

3. **`src/lib/ai/tag-classifier.ts`**
   - `classifyTags()` - now provider-agnostic
   - Added `callProviderForTags()` helper
   - Consistent with other AI functions

### New Files Added

1. **`src/lib/ai/providers/vertex-ai.ts`** (NEW)
   - Complete Vertex AI (Gemini) implementation
   - Full AIProvider interface support
   - Image analysis with base64 encoding
   - Text & image moderation
   - All AI tasks (artifact, story, quest, clustering)

2. **`src/lib/ai/rate-limit.ts`** (NEW)
   - Rate limiting per minute & hour
   - Circuit breaker pattern
   - Status monitoring for admin dashboards
   - Exponential backoff support

3. **`.env.example`** (UPDATED)
   - All AI_PROVIDER options documented
   - Configuration for each provider
   - Rate limiting settings
   - Feature flags

4. **`docs/AI-ARCHITECTURE.md`** (NEW)
   - Comprehensive architecture guide
   - Vertex AI setup instructions
   - Provider configuration matrix
   - Safety & moderation details

### Updated Files

1. **`package.json`**
   - Added: `@google-cloud/vertexai: ^0.2.0`

2. **`src/lib/ai/providers/index.ts`**
   - Added: `vertex-ai` routing

## Migration Path for Developers

### If you're using mentor chat:

```typescript
// No changes needed! Works automatically
import { mentorChat } from "@/lib/ai/mentor/chat";
const response = await mentorChat(message, frustration, mission, history, false);
// Uses AI_PROVIDER automatically
```

### If you're adding new AI features:

```typescript
// Use the provider routing pattern:
import { getProvider } from "@/lib/ai/providers";

async function myNewAIFeature(input: MyInput): Promise<MyOutput> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockImplementation(input);
  }

  // Call the generic provider
  const userMessage = buildUserMessage(input);
  const systemPrompt = buildSystemPrompt();
  
  // THIS WON'T WORK - AIProvider doesn't have generic generateText
  // Instead, use direct provider calls like in mentor/chat.ts:
  
  return callProviderForMyFeature(systemPrompt, userMessage, maxTokens);
}

async function callProviderForMyFeature(
  system: string,
  user: string,
  maxTokens: number,
): Promise<unknown> {
  const provider = process.env.AI_PROVIDER ?? "openai";

  if (provider === "anthropic") {
    const Anthropic = await import("@anthropic-ai/sdk");
    const client = new Anthropic.default({...});
    // ... implementation
  }
  
  if (provider === "vertex-ai") {
    const { VertexAI } = await import("@google-cloud/vertexai");
    // ... implementation
  }
  
  // etc for other providers
}
```

## Configuration Changes Required

### Development (.env.local)

```bash
# Was:
ANTHROPIC_API_KEY=sk-ant-...

# Now (pick one):
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OR
AI_PROVIDER=vertex-ai
GOOGLE_CLOUD_PROJECT=my-project
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

### Production

See `.env.example` for complete reference. Set in your environment:

```bash
# Select provider
AI_PROVIDER=vertex-ai

# Provide credentials
GOOGLE_CLOUD_PROJECT=production-project
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/gcp-key.json

# Optional: tune rate limiting
AI_RATE_LIMIT_PER_MINUTE=120
AI_RATE_LIMIT_PER_HOUR=2000

# Optional: verbose logging
VERBOSE_AI_LOGGING=true
```

## Testing Changes

### Test with Mock AI

```bash
# Use mock responses (no API calls)
USE_MOCK_AI=true npm run test
USE_MOCK_AI=true npm run dev
```

### Test with Vertex AI

```bash
# Setup GCP service account first
export GOOGLE_CLOUD_PROJECT=katalis-test
export AI_PROVIDER=vertex-ai
npm run dev
```

### Test Provider Switching

```bash
# Simple provider test
export AI_PROVIDER=openai
npm run dev

# Then in code:
import { getProvider } from "@/lib/ai/providers";
const p = getProvider(); // Should be OpenAI

// Switch and rerun:
export AI_PROVIDER=vertex-ai
npm run dev
// getProvider() should now be Vertex AI
```

## API Changes - NONE!

All public functions maintain the same interfaces:

```typescript
// These haven't changed:
mentorChat()
simplifyMission()
summarizeReflection()
generateAIReport()
classifyTags()
analyzeArtifact()
analyzeStory()
generateQuest()
clusterGalleryEntries()
moderateText()
moderateImage()
```

**Example: Backward Compatible**
```typescript
// Old code still works exactly the same:
const response = await mentorChat(message, level, mission, history, isGreeting);
// Now automatically uses configured AI_PROVIDER instead of hardcoded Claude
```

## Performance Implications

### Vertex AI vs Anthropic

| Metric | Vertex AI | Anthropic |
|--------|-----------|-----------|
| Latency | ~1-2s (faster) | ~2-3s |
| Cost | $0.075/1M input tokens | $3/1M tokens |
| Model Quality | Gemini 2.0 Flash (excellent) | Claude Sonnet (excellent) |
| Image Analysis | Native support | Supported |
| Rate Limits | 60 RPM (free tier) | 3.5 RPM (free tier) |

**Recommendation**: Start with Vertex AI for lower latency & costs.

## Debugging Provider Issues

### Enable verbose logging

```typescript
// In any AI function:
console.log("[AI] Provider:", process.env.AI_PROVIDER);

// Check rate limits:
import { getRateLimitStatus } from "@/lib/ai/rate-limit";
console.log(getRateLimitStatus());
```

### Check provider selection

```typescript
import { getProvider } from "@/lib/ai/providers";
const provider = getProvider();
console.log(provider.constructor.name); // Should show provider name
```

## Rollback Plan

If issues arise with new provider system:

1. **Switch back to Anthropic**:
   ```bash
   export AI_PROVIDER=anthropic
   export ANTHROPIC_API_KEY=your-key
   ```

2. **Use mock AI** (instant fallback):
   ```bash
   export USE_MOCK_AI=true
   ```

3. **Revert files** (if needed):
   ```bash
   git checkout HEAD -- src/lib/ai/mentor/chat.ts
   git checkout HEAD -- src/lib/ai/parent-report.ts
   git checkout HEAD -- src/lib/ai/tag-classifier.ts
   ```

## Checklist for Full Migration

- [ ] Read `docs/AI-ARCHITECTURE.md`
- [ ] Install Vertex AI SDK: `@google-cloud/vertexai`
- [ ] Setup GCP service account (see guide)
- [ ] Configure `.env` with `AI_PROVIDER=vertex-ai`
- [ ] Test with `USE_MOCK_AI=true npm run dev`
- [ ] Test with real Vertex AI: `npm run dev`
- [ ] Run tests: `npm run test`
- [ ] Verify rate limiting: check `getRateLimitStatus()`
- [ ] Monitor first 24 hours of production deployment
- [ ] Document any issues or metrics

## Questions?

See `docs/AI-ARCHITECTURE.md` for:
- Detailed setup instructions
- All provider documentation
- Rate limiting reference  
- Troubleshooting guide
- Cost estimation

---

**Migration Status**: ✅ Complete  
**Date**: May 2026  
**Breaking Changes**: None (fully backward compatible)
