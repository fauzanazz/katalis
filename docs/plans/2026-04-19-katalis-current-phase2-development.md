# Katalis AI — Current State & Phase 2 Development Plan

**Date:** 2026-04-19  
**Purpose:** Convert the feature draft into an implementation-ready roadmap that is aligned with the current codebase.

---

## 1) Current State (What is already built)

## 1.1 Core Product Structure

Katalis currently ships with the 3 core pillars in production-ready MVP form:

1. **Interest Discovery Agent (Talent Scout)**
2. **Dream Catalyst Agent (7-Day Quest)**
3. **Global Squad Gallery**

The landing page also introduces a 4th role (**Parent Bridge**), but this is mostly positioning/copy right now and not yet fully implemented as a dedicated product module.

---

## 1.2 Feature-by-Feature Status

### Feature 1 — Talent Scout (Interest Discovery Agent)

**Implemented now**
- Multimodal discovery input:
  - image upload
  - audio upload/recording
  - story prompting mode (image prompts + text/voice story)
- AI-based talent analysis with confidence + reasoning output
- Discovery result persistence/history
- Privacy protections on uploads:
  - EXIF stripping for images
  - URL allowlist and input sanitization in API routes

**Partially implemented / missing**
- No native video analysis pipeline yet
- No fully automated harmful-content moderation pipeline (violence/self-harm classifier + redirect flow)
- No explicit “unknown artifact encouraging fallback response” strategy in AI output layer (current behavior is mostly retry/error states)

---

### Feature 2 — Quest Buddy (Mentor & Adaptive Roadmap)

**Implemented now**
- Quest generation from:
  - child dream
  - local context
  - detected talents
- Exactly 7 mission days generated and stored
- Sequential mission progression:
  - locked → available → in_progress → completed
- Mission completion proof photo upload
- Quest completion flow and gallery submission

**Partially implemented / missing**
- No real-time mentor chat loop per mission
- No Socratic/scaffolding dialog engine
- No frustration sensor/adaptive simplification after repeated struggle
- No daily voice reflection workflow
- No creativity bonus/badge system for child-modified plans
- No mission card UX optimized for pre-reader children (icon-first mission briefing)

---

### Feature 3 — Global Squad Gallery (Semantic Showcase)

**Implemented now**
- Gallery entry submission from completed quests
- Talent category tagging from discovery results (top confidence talent)
- Country-level geocoding and map visualization
- AI clustering of entries (talent + geography)
- Safety/reporting baseline via content flag endpoint
- Privacy protections in gallery APIs (childId stripped)

**Partially implemented / missing**
- Rich semantic auto-tag taxonomy (#EcoEngineers-style multi-tag output) is basic today
- Automated “Squad matchmaking UX” exists conceptually via clusters, but not as explicit Squad identities with progression/rituals

---

### Feature 4 — Parent Bridge (Reporting & Support)

**Implemented now**
- Present in product narrative/landing copy

**Not yet implemented as a module**
- Downloadable periodic potential reports
- Parent mentoring tips dashboard tied to child progression
- Structured parent guidance workflows

---

## 1.3 Current Child Journey Coverage

| Journey Step | Status |
|---|---|
| Greeting & Discovery | ✅ Implemented |
| Mission Briefing (7-day setup) | ✅ Implemented |
| Daily Mentoring Interaction | ⚠️ Partially (mission progression exists; chat mentorship not yet) |
| Global Showcase | ✅ Implemented |
| Next Step Growth | ⚠️ Basic progression exists; advanced continuity recommendations are limited |

---

## 2) Phase 2 Development Scope

## 2.1 Phase 2 Goal

Transform MVP from **"generate and track missions"** into **"adaptive thinking companion"** with stronger child safety, richer interaction, and parent visibility.

---

## 2.2 Phase 2 Workstreams

### Workstream A — Safety & Trust Layer (P0)

**Target outcomes**
- Automated harmful-content filtering for discovery and gallery (violence/self-harm/inappropriate content)
- Positive redirection responses for blocked content
- AI uncertainty fallback with encouraging language when recognition confidence is low
- Stronger child privacy safeguards for visual media (optional face obfuscation policy)

**Deliverables**
- Moderation service abstraction (`analyze -> moderate -> response orchestration`)
- Policy config for age-safe response styles
- Moderation logs + admin review queue

---

### Workstream B — Quest Buddy 2.0 (P1)

**Target outcomes**
- Daily interactive mentor chat tied to each mission
- Socratic scaffolding prompts (question-first guidance)
- Frustration sensor + dynamic mission simplification
- “Small Adjustment” language model that avoids failure framing
- Daily reflection mode (voice/text)

**Deliverables**
- Mission Chat UI (thread + quick-reply + voice input)
- Mentor orchestration API with context memory per mission day
- Adaptive difficulty rules engine (e.g., struggle signals, failed attempts)
- Reflection storage + summarizer

---

### Workstream C — Creativity Motivation System (P1)

**Target outcomes**
- Reward originality when child modifies or extends plan
- Reinforce “you are the creator” identity

**Deliverables**
- Badge engine (rule-based v1)
- Badge UI and progress timeline
- Events for “child diverged constructively from plan”

---

### Workstream D — Squad Gallery 2.0 (P2)

**Target outcomes**
- Better semantic tags and interest subcategories
- Explicit Squad membership experience (not just clustering backend)

**Deliverables**
- Multi-tag classifier and tag confidence ranking
- Squad domain model (name/theme/members/featured works)
- Squad feed and inspiration prompts

---

### Workstream E — Parent Bridge Module (P2)

**Target outcomes**
- Parent-facing insight reports that are practical and clear
- At-home mentoring tips matched to child profile and local materials

**Deliverables**
- Parent report generator (weekly/biweekly PDF or web export)
- Strength/growth summary cards
- Actionable home tips library + recommendation engine

---

## 3) Suggested Technical Additions for Phase 2

### 3.1 Data Model Additions
- `MentorSession`, `MentorMessage`
- `MissionAttempt`, `AdjustmentEvent`
- `ReflectionEntry` (voice/text + summary)
- `Badge`, `ChildBadge`
- `ModerationEvent`
- `ParentReport`

### 3.2 API Surface (new)
- `/api/mentor/session`
- `/api/mentor/message`
- `/api/quest/:id/mission/:missionId/adjust`
- `/api/reflection/daily`
- `/api/badges`
- `/api/moderation/check`
- `/api/parent/reports`

---

## 4) Delivery Plan (Pragmatic)

### Sprint 1–2 (P0)
- Safety/moderation pipeline
- AI fallback messaging
- Policy + logging

### Sprint 3–4 (P1)
- Quest chat UI + mentor session backend
- Scaffolding prompt templates
- Basic frustration detection and step simplification

### Sprint 5 (P1)
- Daily reflection flow
- Badge engine v1

### Sprint 6 (P2)
- Squad 2.0 semantic tags + explicit squad UX
- Parent Bridge v1 reports + home tips

---

## 5) Definition of Done for Phase 2

Phase 2 is complete when:
- Child can complete a full 7-day journey with **interactive mentor chat** and **adaptive support**
- Safety system can auto-handle harmful content with positive redirection
- Reflection and badges reinforce confidence and autonomy
- Parent can access at least one usable development report + practical mentoring tips
- Gallery experience supports explicit squad identity beyond raw clustering

---

## 6) Product Messaging Update Recommendation

Use this externally:
- **Current:** 3 production pillars + early Parent Bridge concept
- **Phase 2:** adaptive mentor chat, safety intelligence, parent insight layer

This prevents overclaiming while keeping the roadmap vision strong.
