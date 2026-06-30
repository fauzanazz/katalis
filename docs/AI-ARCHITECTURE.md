# AI Architecture & Gemini Vertex AI Integration

## Overview

Huna AI system adalah **production-grade, multi-provider generative AI platform** yang dirancang untuk analisis bakat anak, generasi quest, dan moderasi konten dengan aman. Sistem ini mendukung multiple AI providers dengan switching dinamis dan fallback intelligent.

### Providers yang Didukung

- **OpenAI** (default): GPT-4o dengan multimodal capabilities
- **Anthropic**: Claude Sonnet untuk reasoning berkualitas tinggi
- **Google Vertex AI**: Gemini 2.0 Flash untuk latency rendah dan cost efisien
- **Google Generative AI**: Gemini API untuk development
- **OpenRouter**: Aggregator yang fleksibel untuk multiple models
- **NVIDIA NIM**: On-premises & cloud deployment options
- **Grok**: Tesla's open model
- **Mock AI**: Untuk development & testing dengan `USE_MOCK_AI=true`

## AI Features

### 1. **Artifact Analysis** (`src/lib/ai/client.ts`)
Menganalisis kreasi anak (gambar, audio) untuk mendeteksi talents dengan deep understanding.
- Multimodal analysis (image + text context)
- Talent confidence scoring
- Cross-category pattern detection

### 2. **Story Analysis**
Menganalisis cerita anak untuk narrative pattern detection dan talent identification.
- Supports written & audio transcriptions
- Identifies logical thinking, creativity, emotional intelligence
- Context-aware talent mapping

### 3. **Quest Generation** 
Membuat 7-hari learning quests yang personalized berdasarkan dream anak.
- Adapts to local context & available materials
- Progressive complexity (Day 1-7)
- Talent-aligned mission design

### 4. **Gallery Clustering**
Mengelompokkan global gallery entries by talent & geography.
- Geographic + talent-based grouping
- Child-friendly, encouraging descriptions
- Celebrates diversity across cultures

### 5. **Mentor Chat** (`src/lib/ai/mentor/chat.ts`)
Provider-agnostic Socratic questioning engine untuk Quest Buddy.
- Frustration-level adaptation
- Mission simplification on demand
- Reflection summarization

### 6. **Parent Reports** (`src/lib/ai/parent-report.ts`)
Intelligent insights tentang progress anak untuk parents.
- Talent strengths analysis
- Growth areas (positive framing)
- At-home activity recommendations

### 7. **Content Moderation**
Safety-first text & image moderation untuk child safety.
- Conservative approach: flag on doubt
- Context-aware (distinguishes children's artwork from harmful content)
- Provider-agnostic implementation

### 8. **Tag Classification** (`src/lib/ai/tag-classifier.ts`)
Semantic tagging untuk gallery entries & talent categorization.
- Cross-category tags
- Confidence scoring
- Skill-specific labeling

## Setup: Google Cloud Vertex AI

### Prerequisites

```bash
# Install Google Cloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize and authenticate
gcloud init
gcloud auth application-default login
```

### Configuration

**1. Create Service Account (Recommended)**

```bash
# Set your project
export PROJECT_ID=your-project-id
gcloud config set project $PROJECT_ID

# Create service account
gcloud iam service-accounts create katalis-ai \
  --display-name="Huna AI Service Account"

# Grant Vertex AI permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:katalis-ai@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Create & download key
gcloud iam service-accounts keys create service-key.json \
  --iam-account=katalis-ai@${PROJECT_ID}.iam.gserviceaccount.com
```

**2. Set Environment Variables**

```bash
export GOOGLE_CLOUD_PROJECT=your-project-id
export GOOGLE_CLOUD_LOCATION=us-central1  # or your preferred region
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-key.json
export AI_PROVIDER=vertex-ai
export VERTEX_AI_MODEL=gemini-2.0-flash   # or gemini-1.5-pro
```

**3. In .env file**

```env
# AI Provider
AI_PROVIDER=vertex-ai

# Vertex AI Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-key.json
VERTEX_AI_MODEL=gemini-2.0-flash

# Rate limiting
AI_RATE_LIMIT_PER_MINUTE=60
AI_RATE_LIMIT_PER_HOUR=1000
```

### Available Models

```
gemini-2.0-flash      # Latest, fastest, recommended
gemini-1.5-pro        # Most capable for complex reasoning
gemini-1.5-flash      # Balanced performance/cost
```

## Provider Switching

### Dynamic Provider Selection

```typescript
// Automatically loads based on AI_PROVIDER env var
import { getProvider } from "@/lib/ai/providers";

const provider = getProvider();
const result = await provider.analyzeArtifact(input);
```

### Supported Environment Values

```bash
AI_PROVIDER=openai          # Default: GPT-4o
AI_PROVIDER=anthropic       # Claude Sonnet
AI_PROVIDER=google          # Google Generative AI
AI_PROVIDER=vertex-ai       # Vertex AI (Gemini)
AI_PROVIDER=openrouter      # OpenRouter
AI_PROVIDER=nvidia          # NVIDIA NIM
AI_PROVIDER=grok            # Grok
AI_PROVIDER=mock            # Mock responses for dev
```

## Code Architecture

### Provider Interface

```typescript
// src/lib/ai/types.ts
export interface AIProvider {
  analyzeArtifact(input: AnalysisInput): Promise<AnalysisOutput>;
  analyzeStory(input: StoryAnalysisInput): Promise<StoryAnalysisOutput>;
  generateQuest(input: QuestGenerationInput): Promise<QuestGenerationOutput>;
  clusterGalleryEntries(entries: ClusterEntry[]): Promise<ClusteringOutput>;
  moderateText(content: string): Promise<ModerationResult>;
  moderateImage(imageUrl: string): Promise<ModerationResult>;
}
```

### Provider Implementations

```
src/lib/ai/providers/
├── index.ts          # Provider router & loader
├── vertex-ai.ts      # Google Cloud Vertex AI ✨ NEW
├── anthropic.ts      # Claude
├── openai.ts         # GPT-4o
├── google.ts         # Generative AI
├── openrouter.ts     # OpenRouter
├── nvidia.ts         # NVIDIA NIM
├── grok.ts           # Grok
└── ...
```

### Provider-Agnostic Functions

#### Mentor Chat (Multi-provider)

```typescript
// src/lib/ai/mentor/chat.ts
export async function mentorChat(
  childMessage: string | null,
  frustrationLevel: FrustrationLevel,
  missionContext: {...},
  chatHistory: Array<{role, content}>,
  isGreeting: boolean,
): Promise<MentorResponse>
// Uses callProviderForMentor() internally to support all providers
```

#### Parent Reports (Multi-provider)

```typescript
// src/lib/ai/parent-report.ts
export async function generateAIReport(input: ReportInput): Promise<ReportOutput>
// Uses callProviderForReport() to delegate to current AI_PROVIDER
```

#### Tag Classification (Multi-provider)

```typescript
// src/lib/ai/tag-classifier.ts
export async function classifyTags(
  talentCategory: string,
  questContext?: string,
): Promise<TagClassificationOutput>
// Uses callProviderForTags() for provider abstraction
```

## Rate Limiting

### Configuration

```env
# Max requests per minute (default: 60)
AI_RATE_LIMIT_PER_MINUTE=60

# Max requests per hour (default: 1000)
AI_RATE_LIMIT_PER_HOUR=1000
```

### Usage

```typescript
import { withRateLimit, getRateLimitStatus } from "@/lib/ai/rate-limit";

// Wrap AI calls with rate limiting
async function safeMentorChat(message: string) {
  return withRateLimit(
    () => mentorChat(message, "none", {...}, [], false),
    "mentor-chat"  // Provider ID for circuit breaker
  );
}

// Monitor rate limiting
const status = getRateLimitStatus();
// Returns: { requestsLastMinute, requestsLastHour, canMakeRequest, breakers, ... }
```

### Circuit Breaker Pattern

- **Closed**: Normal operation, requests allowed
- **Open**: Provider failing, requests rejected immediately
- **Half-open**: Testing recovery after 60s timeout

## Safety & Moderation

### Child Safety First

All prompts include explicit safety guardrails:

```typescript
// From prompts across all providers
const TEXT_MODERATION_PROMPT = `
  Be CONSERVATIVE: when in doubt, flag for review rather than allowing.
  Children's safety is paramount.
`;

const IMAGE_MODERATION_PROMPT = `
  IMPORTANT CONTEXT: This app is for children's OWN creative work.
  Do NOT flag normal children's artwork.
  Only flag genuinely harmful content.
`;
```

### Moderation Result Mapping

```typescript
// Normalized across all providers
interface ModerationResult {
  allowed: boolean;
  status: "approved" | "flagged" | "error";
  category?: string; // violence, sexual, hate, etc.
  severity?: string; // low, medium, high, critical
  confidence: number; // 0.0-1.0
  reasoning: string;
}
```

## Prompt Consistency

All system prompts emphasize:

1. **Warm, encouraging tone** for children
2. **No negative language** (never Say "fail", "wrong", "mistake")  
3. **Socratic questioning** first, direct answers never
4. **Context awareness** (local resources, cultural sensitivity)
5. **JSON-only responses** for reliable parsing & validation with Zod

### Example: Artifact Analysis Prompt (All Providers)

```
You are an expert child development specialist...
CRITICAL: Go beyond surface-level categorization...
Detect 2-4 talents per artifact...
Be encouraging but honest.
Respond ONLY with valid JSON:
{
  "talents": [
    {
      "name": "Talent Name",
      "confidence": 0.85,
      "reasoning": "Detailed explanation..."
    }
  ]
}
```

## Validation with Zod

All AI responses are validated:

```typescript
// src/lib/ai/schemas.ts
import { z } from "zod";

export const AnalysisOutputSchema = z.object({
  talents: z.array(
    z.object({
      name: z.string().min(1),
      confidence: z.number().min(0).max(1),
      reasoning: z.string().min(10),
    })
  ),
});

// Provider response is validated before returning
const validated = AnalysisOutputSchema.parse(aiResponse);
```

## Mock AI for Development

### Quick Local Testing

```bash
# Use mock AI for instant responses (no API calls)
USE_MOCK_AI=true npm run dev
```

### Mock Implementations

```
src/lib/ai/mock/
├── multimodal-analysis.ts   # Fake artifact analysis
├── story-analysis.ts        # Fake story analysis
├── quest-generation.ts      # Fake quest generation
├── clustering.ts            # Fake gallery clustering
├── tag-classifier.ts        # Fake tag classification
├── parent-report.ts         # Fake parent reports
└── ...
```

## Deployment Checklist

### Before Production

- [ ] Set `USE_MOCK_AI=false` in production
- [ ] Configure `AI_PROVIDER` for your chosen provider
- [ ] Set all required API keys in secure secret management
- [ ] Test rate limiting with realistic load
- [ ] Set up monitoring/alerting for circuit breaker state
- [ ] Document AI provider selection rationale
- [ ] Test failover between providers (if multiple configured)

### Vertex AI Specific

- [ ] Service account has `aiplatform.user` role
- [ ] Region configured for your workload
- [ ] Model availability verified in region
- [ ] Service account key rotated regularly
- [ ] Audit logging enabled in GCP console

### Cost Optimization

```bash
# Vertex AI pricing (as of 2024):
# - Input: $0.075 / 1M tokens
# - Output: $0.3 / 1M tokens
# - Caching: 50% discount on cached input tokens

# Estimate monthly costs for 1000 artifacts/day:
# = 365K artifacts/year × avg 500 tokens = 182.5M tokens
# = ~$15-20/month (heavily depends on output token length)
```

## Troubleshooting

### Issue: "GOOGLE_CLOUD_PROJECT environment variable is required"

```bash
# Solution: Set environment variable
export GOOGLE_CLOUD_PROJECT=your-project-id
# Or in .env file:
GOOGLE_CLOUD_PROJECT=your-project-id
```

### Issue: "Failed to fetch image for analysis"

```typescript
// Ensure image URL is publicly accessible
// or use base64-encoded data URI
```

### Issue: Circuit breaker constantly open

```typescript
// Check rate limiting status
import { getRateLimitStatus } from "@/lib/ai/rate-limit";
console.log(getRateLimitStatus());

// May indicate:
// 1. Rate limit exceeded (increase limit or spread load)
// 2. Provider API errors (check API status)
// 3. Auth issues (verify API key/credentials)
```

### Issue: Inconsistent responses between providers

- Each provider has slightly different reasoning
- Use consistent prompts (already done in code)
- Validate with Zod schemas (catches format issues)
- Testing with mock AI first to verify logic

## Migration from Single Provider

### Old (Hardcoded Anthropic)
```typescript
// ❌ BEFORE
const Anthropic = await import("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
```

### New (Provider-agnostic)
```typescript
// ✅ AFTER
// In mentor/chat.ts, parent-report.ts, tag-classifier.ts:
const response = await callProviderForJSON(systemPrompt, userMessage, maxTokens);
// Automatically routes to configured AI_PROVIDER
```

## Next Steps

1. **Enable monitoring**: Log AI calls & costs per provider
2. **A/B testing**: Compare provider quality/cost
3. **Async processing**: Offload heavy computations to job queue
4. **Caching**: Cache frequently-requested analyses
5. **Fine-tuning**: Custom models for Katalis-specific patterns

## Support & Resources

- **Vertex AI Docs**: https://cloud.google.com/vertex-ai/docs
- **Gemini API Docs**: https://ai.google.dev
- **Rate Limiting Reference**: See `src/lib/ai/rate-limit.ts`
- **Provider Implementations**: `src/lib/ai/providers/`

---

**Last Updated**: May 2026  
**Status**: Production-ready with multi-provider support  
**Maintainer**: Huna AI Team
