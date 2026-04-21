# Euexia — AI-Powered Post-Consultation Care Companion

> Full-stack, multi-agent, multi-modal healthcare AI platform that turns raw consultation material (voice, image, PDF, text) into a structured, gamified daily care plan, with a RAG-based medical chatbot grounded in each user's own records.

**Stack:** TypeScript · Next.js 15 · React 19 · Node.js · Express · MongoDB Atlas (Vector Search) · AWS SageMaker · AWS Elastic Beanstalk · AWS Amplify · AWS S3 · Google MedGemma · OpenAI GPT-4.1 · LangChain · PixiJS

**Source:** https://github.com/elbochh/euexia

---

## Problem

Digital health apps have a well-documented engagement problem. Median 30-day retention across 93 mental-health apps is ~3.3% [[1]](#references), and a scoping review of 18 studies covering 525,824 participants reports a median ~70% drop-off within the first 100 days [[2]](#references). The result in post-consultation care: missed medications, skipped follow-ups, weak continuity of care.

Euexia tackles the follow-through gap: extract every clinically meaningful instruction from a consultation with domain-tuned medical models, schedule it as daily quests, and wrap it in a gamification layer inspired by Yu-kai Chou's Octalysis framework [[3]](#references) to sustain engagement past the novelty phase.

---

## What it does

- **Multi-modal intake** — voice recordings, photos of prescriptions, PDF discharge summaries, and free text.
- **Agentic extraction pipeline** — parallel specialized agents (voice, image, PDF, text) extract a structured care plan with exact drug names, doses, timings, and durations.
- **Event-based scheduling** — recurring instructions like *"twice daily for 7 days"* are expanded into 14 individual, time-stamped events with sequential unlocks and per-day grouping.
- **RAG medical chatbot ("Dr. Gemma")** — condenses follow-ups, retrieves from MongoDB Atlas Vector Search, reranks with MMR, and generates grounded answers with refusal-aware retry.
- **Gamified progression** — PixiJS adventure map with day-based checkpoints, XP, coins, streaks, themes, leaderboard, and a character/skin store (accomplishment, ownership, scarcity, social influence).
- **Cloud-native deployment** — backend on AWS Elastic Beanstalk, frontend on AWS Amplify, inference on AWS SageMaker, data on MongoDB Atlas.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                │
│          Next.js 15 · React 19 · TypeScript · Tailwind               │
│        PixiJS game canvas · Three.js · Framer Motion · Zustand       │
│                     Deployed on AWS Amplify                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │  HTTPS (Next.js proxy rewrite)
┌────────────────────────────▼────────────────────────────────────────┐
│                              BACKEND                                 │
│       Node.js · Express · TypeScript · JWT auth · Mongoose           │
│                Deployed on AWS Elastic Beanstalk                     │
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Consultation Pipeline                     │   │
│  │                                                               │   │
│  │  Upload ──► Voice / Image / PDF / Text agents (parallel)      │   │
│  │       │     └─► SageMaker (MedGemma · MedASR)                 │   │
│  │       ▼                                                       │   │
│  │   Rule-based medication extractor (deterministic safety net)  │   │
│  │       ▼                                                       │   │
│  │   Summary aggregator (MedGemma) ──► care-plan paragraph       │   │
│  │       ▼                                                       │   │
│  │   Checklist event structurer (GPT-4.1 JSON mode)              │   │
│  │       ▼                                                       │   │
│  │   Event expansion + scheduling + group/sequence logic         │   │
│  │       ▼                                                       │   │
│  │   Map spec generator (algorithmic + optional AI)              │   │
│  │       ▼                                                       │   │
│  │   RAG indexer (fire-and-forget) ──► ContextChunk collection   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   RAG Chatbot ("Dr. Gemma")                   │   │
│  │                                                               │   │
│  │  User msg ──► Question condenser (MedGemma, T=0.1)            │   │
│  │       ▼                                                       │   │
│  │   embedText (Xenova MiniLM-L6-v2, 384 dims)                   │   │
│  │       ▼                                                       │   │
│  │   Atlas $vectorSearch  ──fallback──►  in-memory cosine        │   │
│  │       ▼                                                       │   │
│  │   MMR reranking (λ=0.6) + text dedup                          │   │
│  │       ▼                                                       │   │
│  │   + Always-include structured data (active tasks, progress)   │   │
│  │       ▼                                                       │   │
│  │   MedGemma generation + refusal detection + retry             │   │
│  │       ▼                                                       │   │
│  │   Post-processor (dedup, stop-token trim, length cap)         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    AI INFERENCE  (AWS SageMaker)                     │
│                                                                      │
│   · MedGemma (text)    → clinical summaries, RAG chat generation     │
│   · MedGemma (vision)  → prescriptions, lab reports, scans           │
│       on ml.g5.2xlarge (NVIDIA A10G · 24 GB VRAM · 8 vCPU · 32 GiB)  │
│   · MedASR             → doctor–patient audio transcription          │
│       on ml.c5.large  (~2 vCPU · 4 GiB RAM)                          │
│   · GPT-4.1            → structured checklist JSON generation        │
│                                                                      │
│   Provider-agnostic — route each modality to SageMaker or OpenAI     │
│   via env-driven switches (AI_TEXT_PROVIDER, AI_VISION_PROVIDER, …). │
└──────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                            DATA LAYER                                │
│   MongoDB Atlas                                                      │
│   · Users · Consultations · ChecklistItems · ChatMessages            │
│   · GameProgress · Map · ContextChunk (with Atlas Vector Search)     │
└──────────────────────────────────────────────────────────────────────┘
```

GPU-backed generation workloads are split from CPU-efficient ASR to keep inference cost rational for a student/hackathon budget while preserving quality.

---

## AI pipeline — the interesting parts

### Consultation processing

Uploads run through type-specific agents **in parallel**, each prompt-engineered for maximum specificity (exact drug names, doses, timings, thresholds — no paraphrasing). Outputs are merged by a summary aggregator that is contractually required to include every medication surfaced by a deterministic rule-based extractor, which acts as a safety net against probabilistic omissions from the LLM.

The care-plan paragraph is then handed to a **checklist event structurer** (GPT-4.1 in JSON mode) that expands recurrence into individual events: *"twice daily for 7 days"* becomes 14 timestamped events with `sequenceId`, `orderInGroup`, and `starGroupId` for sequential unlocking and day-level grouping. A post-validator cross-checks the output against the source and patches in any missed medications.

### RAG chatbot

1. **Question condensation** — follow-ups like *"how will these affect my disease?"* are rewritten into standalone queries using MedGemma at low temperature.
2. **Retrieval** — condensed query embedded locally (MiniLM-L6-v2, 384d) → **MongoDB Atlas `$vectorSearch`**, with a graceful **in-memory cosine** fallback and a direct document lookup as a last resort.
3. **Reranking** — **Maximal Marginal Relevance** (λ = 0.6) + text-level dedup (60% word-overlap threshold).
4. **Generation + post-processing** — MedGemma generates the answer; refusal patterns trigger a more permissive retry; output is de-duplicated at sentence level, stripped of role labels / code fences, and capped at 12 lines / 1200 chars.

All top-K, token budgets, thresholds, and model choices are driven by env vars — the pipeline is tunable without code changes.

### Gamification

Checklist events are grouped by `starGroupId` (typically per day) and placed on an adventure map with 3–6 stars, themed by the dominant category (nutrition → jungle, medications → city, recovery → desert) and rendered via PixiJS with Kenney hex tiles and custom sprite sheets. XP/coin rewards are multiplied by a streak multiplier (capped at 2×); streaks, levels, and theme unlocks are handled in a single transactional reward engine.

---

## Measured performance

End-to-end timing on a representative discharge-summary upload:

| Stage | Time |
|---|---|
| DB create | 346 ms |
| Uploads (parallel agents) | 50,277 ms |
| Summary aggregation | 50,553 ms |
| Checklist event structuring | 91,860 ms |
| DB persist checklist | 93 ms |
| Map spec generation | 74 ms |
| **Total** | **~193 s** |

Chatbot latency for prompts like *"how is my progress so far"* and *"is there any food or liquids to avoid with my medicines?"* averages **~16 s**. Orchestration overhead is minimal; the bottleneck is model inference — an honest, known target for future optimization (streaming responses, smaller distilled variants, batched tool calls).

---

## Tech stack

**Frontend** Next.js 15, React 19, TypeScript, Tailwind CSS, Zustand, PixiJS, Three.js, Framer Motion, Axios

**Backend** Node.js, Express, TypeScript, Mongoose, JWT auth, bcrypt, Multer, pdf-parse

**AI / ML** Google **MedGemma** (text + vision), **MedASR** (speech-to-text), **HeAR**, **MedSigLIP**, OpenAI **GPT-4.1** (JSON-structured tasks / fallback), `@xenova/transformers` (local `all-MiniLM-L6-v2`), `@langchain/core`, prompt engineering, multi-agent orchestration

**Data / Retrieval** MongoDB Atlas, **Atlas Vector Search** (`$vectorSearch`), cosine-similarity fallback, MMR reranking, recursive semantic chunking, RAG

**AWS** **SageMaker Runtime** (multiple inference endpoints on ml.g5.2xlarge / ml.c5.large), **Elastic Beanstalk**, **Amplify**, **S3**, **CloudWatch**, IAM-scoped credentials

**DevOps** Monorepo, GitHub Actions (deploy workflows), Next.js API rewrite proxy, env-driven provider switching (`AI_TEXT_PROVIDER`, `AI_VISION_PROVIDER`, `AI_ASR_PROVIDER`, `AI_IMAGE_GENERATION_PROVIDER`)

---

## Project layout

```
euexia/
├─ amplify.yml                  # Amplify monorepo build spec
├─ backend/
│  ├─ Procfile                  # Elastic Beanstalk entrypoint
│  ├─ .ebextensions/            # EB runtime config
│  ├─ CHATBOT_ARCHITECTURE.md   # Full RAG pipeline write-up
│  ├─ PROMPT_STRUCTURE.md       # Per-agent prompt breakdown
│  ├─ SAGEMAKER_COST_OPTIMIZATION.md
│  └─ src/
│     ├─ index.ts
│     ├─ config/                # DB + SageMaker config
│     ├─ controllers/           # auth · upload · checklist · chat · game
│     ├─ middleware/            # JWT auth
│     ├─ models/                # User · Consultation · ChecklistItem ·
│     │                         # ContextChunk · ChatMessage · GameProgress · Map
│     ├─ routes/
│     ├─ services/
│     │  ├─ sagemaker.ts        # Unified AI invocation (SageMaker or OpenAI)
│     │  ├─ gamification.ts     # XP · coins · streaks · levels · themes
│     │  ├─ agents/             # voice · image · pdf · text · summary · checklist
│     │  ├─ rag/                # retriever · indexer · embeddings · condenser ·
│     │  │                     # langchainMedGemma · textSplitter · contextPolicy
│     │  └─ mapSpec/            # Algorithmic map generator
│     └─ scripts/               # testMedGemma, testDalleMap, etc.
└─ frontend/
   └─ src/
      ├─ app/                   # dashboard · upload · checklist · consultations · leaderboard
      ├─ components/            # game (PixiJS canvas) · chat · upload · checklist · ui
      ├─ hooks/ · lib/ · stores/
```

---

## Running locally

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas — Atlas is required for `$vectorSearch`; otherwise the cosine fallback is used)
- Optional: AWS account with SageMaker endpoints, and/or an OpenAI API key

### Backend

```bash
cd backend
npm install
cp .env.example .env    # fill in values — JWT_SECRET is required
npm run dev             # ts-node + nodemon on :5000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev             # Next.js on :3000
```

### Environment variables (highlights)

```bash
# Core
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...                       # REQUIRED — no insecure fallback
FRONTEND_URL=https://your-amplify-app.amplifyapp.com

# AI provider switches
AI_TEXT_PROVIDER=sagemaker           # or "openai"
AI_VISION_PROVIDER=sagemaker
AI_ASR_PROVIDER=sagemaker
AI_IMAGE_GENERATION_PROVIDER=openai

# AWS SageMaker endpoints
AWS_REGION=us-east-1
SAGEMAKER_MEDGEMMA_TEXT_ENDPOINT=medgemma-text-endpoint
SAGEMAKER_MEDGEMMA_IMAGE_ENDPOINT=medgemma-image-endpoint
SAGEMAKER_MEDASR_ENDPOINT=medasr-endpoint

# OpenAI (structured tasks / fallback)
OPENAI_API_KEY=sk-...
OPENAI_CHECKLIST_MODEL=gpt-4.1-mini

# RAG tuning
MONGODB_VECTOR_INDEX=context_embedding_index
RAG_EMBED_MODEL=Xenova/all-MiniLM-L6-v2
RAG_EMBED_DIM=384
RAG_VECTOR_TOP_K=10
RAG_CHAT_MAX_NEW_TOKENS=512
RAG_CHAT_TEMPERATURE=0.3
RAG_CHAT_OUTPUT_MAX_CHARS=1200
```

---

## Design notes & engineering learnings

- **Separating understanding from retrieval.** Condensing follow-ups into standalone questions before retrieval dramatically improves vector recall on conversational phrasing like *"how about those?"*.
- **Belt-and-braces extraction.** Medical LLMs silently drop medications. A deterministic regex extractor runs *before* the LLM summary, and a post-validator patches anything the model missed. Clinical completeness matters more than stylistic elegance.
- **Graceful degradation.** Vector search falls back to in-memory cosine, which falls back to a direct consultation lookup — the chatbot is never left without context.
- **Provider-agnostic inference.** One `invokeTextModel` / `invokeImageModel` / `invokeAsrModel` surface lets every agent run on SageMaker in production and OpenAI in development without touching agent code.
- **Cost vs. quality.** Checklist structuring uses GPT-4.1 because its JSON-mode reliability beat MedGemma; everything clinical (summarization, Q&A, vision) stays on MedGemma. See `backend/SAGEMAKER_COST_OPTIMIZATION.md` for the serverless-inference / scale-to-zero analysis.
- **Known limitations.** Pipeline latency is model-bound (~3 min end-to-end, ~16 s per chat turn). The roadmap is streaming generation, prompt/caching optimization, and evaluating distilled smaller variants for the condenser and structurer.

---

## References

1. Baumel A, Muench F, Edan S, Kane JM. *Objective User Engagement With Mental Health Apps: Systematic Search and Panel-Based Usage Analysis.* JMIR 2019;21(9):e14567. doi:10.2196/14567
2. Kidman PG, Curtis RG, Watson A, Maher CA. *When and Why Adults Abandon Lifestyle Behavior and Mental Health Mobile Apps: Scoping Review.* JMIR 2024;26:e56897. doi:10.2196/56897
3. Chou Y-K. *Actionable Gamification: Beyond Points, Badges, and Leaderboards.* Octalysis Media; 2016.

---

## Acknowledgements

- **Google MedGemma** — the clinical backbone of every agent.
- **Kenney** (kenney.nl) — CC0 hex-tile and character assets.
- **MongoDB Atlas Vector Search** — the retrieval substrate for RAG.

---

*Built end-to-end — backend, frontend, AI orchestration, AWS deployment, and game rendering.*
