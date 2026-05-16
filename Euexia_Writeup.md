# Euexia Writeup

## Summary

Euexia is a mobile-first post-consultation support system that turns medical follow-up into a gamified daily journey. Instead of leaving patients with static discharge papers and low motivation to continue, Euexia transforms care plans into day-based checkpoints, actionable tasks, and progress rewards. The system combines a lightweight game experience (map progression, character customization, and leaderboard) with an agentic backend workflow that converts unstructured consultation inputs (voice, text, image, PDF) into structured daily checklists.

From the engineering side, Euexia uses a hybrid AI stack: Gemma 4 on Google Vertex AI for clinical summarization, multimodal document interpretation, checklist event structuring, and contextual chat, with MedASR retained for speech handling. The output is persisted in MongoDB and reused in a RAG-powered "Dr. Gemma" chat assistant for contextual follow-up support.

The result is a product that addresses two known barriers in health apps: (1) poor long-term engagement and (2) weak translation of clinical information into day-to-day behavior. Euexia’s core contribution is not only AI extraction, but behaviorally informed delivery of care tasks through game design.

---

## Problem statement

A major challenge in digital health is not app installation, but sustained user engagement. Real-world usage studies show that retention drops quickly, even for mental health and behavior-change apps.

Two findings motivate Euexia:

1. **Low long-term engagement in real-world mental health apps**  
   Baumel et al. (2019) found that while installs can be high, sustained use is limited. Reported medians were roughly **3.9% retention at day 15** and **3.3% retention at day 30** across 93 popular apps.

2. **Steep early abandonment in health behavior apps**  
   Kidman et al. (2024) reported a strong early drop-off pattern, with a median of about **70% of users abandoning within the first 100 days** (18 studies, 525,824 participants).

Together, these findings highlight a clear gap: many health apps provide information, but fail to sustain behavioral follow-through. In post-consultation contexts, this can mean missed medication adherence, delayed follow-ups, and weak continuity of care.

Euexia addresses this by combining:
- agentic extraction of consultation instructions into structured daily tasks,
- and gamified mechanics designed to support continued engagement beyond initial app novelty.

---

## Approach

### Gamified experience

Euexia’s front-end experience is intentionally designed around recurring motivation loops rather than one-time content consumption. The app includes three primary interaction surfaces:

**[PLACEHOLDER — Figure A: Map screen screenshot]**

- **Map progression screen:** Care tasks are grouped into day-based checkpoints. Completing tasks advances the player along the map, reinforcing a visible sense of progress.
- **Why it exists:** It converts abstract medical adherence into concrete daily wins and progression.

**[PLACEHOLDER — Figure B: Upload consultation screenshot]**

- **Consultation upload screen:** Users can upload **voice, text, image, and PDF** consultation content. This lowers friction and supports realistic patient behavior (different users store medical information in different formats).
- **Why it exists:** Multi-modal ingestion ensures the system can capture care instructions as they naturally occur.

**[PLACEHOLDER — Figure C: Store + leaderboard screenshot]**

- **Store and leaderboard:** Users earn coins through completed tasks, unlock character skins, and compare progress with others on a leaderboard.
- **Why it exists:** It supports long-term return behavior through rewards and social motivation.

This design is aligned with Yu-kai Chou’s **Octalysis** framework (gamification and human motivation), especially:

- **Accomplishment:** Checkpoint completion and visible map advancement.
- **Ownership:** User-selected characters/skins that represent personal progress.
- **Scarcity:** Tiered skin pricing (easy, medium, rare/expensive) creating delayed but meaningful goals.
- **Social influence:** Leaderboard visibility and comparative progress.

In short, the game layer is not cosmetic; it operationalizes adherence motivation through repeatable human drivers.

### Post consultation Agentic Workflow

**[PLACEHOLDER — Figure D: Agentic workflow diagram]**

The backend pipeline is structured as an agentic sequence with explicit responsibility boundaries:

1. **Input processing (parallel):**
   - Voice -> speech transcription + medical summary
   - Text -> medical summary
   - Image -> medical summary
   - PDF -> medical summary

2. **Summary aggregation:**  
   Multi-source summaries are merged into a single care-plan paragraph.

3. **Checklist structuring:**  
   The care-plan paragraph is transformed into structured, scheduled checklist events.

4. **Persistence + gameplay translation:**  
   Events are saved to MongoDB and mapped to day-based game checkpoints.

5. **RAG chat support:**  
   A "Dr. Gemma" assistant retrieves user-specific context from stored consultation/checklist/chat data and generates contextual responses.

#### Model usage split (clear responsibilities)

- **Gemma 4 (Vertex AI):**
  - Text summarization / aggregation
  - Image document interpretation
  - Chat generation in RAG flow

- **MedASR (SageMaker):**
  - Voice transcription path

- **Rule-based validators and fallbacks:**
  - Medication completeness checks, checklist normalization, deduplication, and safe fallback tasks when model output is malformed

#### Deployment profile

- **Gemma 4 MaaS endpoint:** `gemma-4-26b-a4b-it-maas` on Vertex AI
  - Serverless Model-as-a-Service path, so the application does not need to provision or manage a GPU endpoint for the competition submission.

- **Voice endpoint:** `ml.c5.large`  
  - Approx. **2 vCPU, 4 GiB RAM** (CPU-oriented cost-efficient endpoint for ASR flow)

This split keeps heavier generation on managed Gemma 4 infrastructure while using smaller CPU capacity where appropriate.

---

## Results

### User experience speed

For a discharge-summary example upload, observed backend pipeline timing was:

```text
╔════════════════════════════════════════╗
║       PIPELINE TIMING SUMMARY          ║
╠════════════════════════════════════════╣
║  0_db_create              346ms  █
║  1_uploads_parallel     50277ms  ████████████████████
║  2_aggregate            50553ms  ████████████████████
║  3_checklist_events     91860ms  ████████████████████
║  4_db_checklist            93ms
║  5_map_spec                74ms
╠════════════════════════════════════════╣
║  TOTAL                    193361ms          ║
╚════════════════════════════════════════╝
```

Interpretation:
- The largest contributors are semantic processing steps (parallel upload analysis, aggregation, and checklist event generation).
- Database and map-spec persistence overhead is comparatively minimal.

For chat response latency in Dr. Gemma:
- Prompt: **“how is my progress so far”** -> ~**16 seconds**
- Prompt: **“Is there any type of food or liquids to avoid with my medicines?”** -> ~**16 seconds**

These measurements indicate a functional but still optimizable interactive experience for AI-heavy steps, while non-AI orchestration overhead remains low.

---

## Conclusion

Euexia demonstrates a practical architecture for post-consultation continuity: multimodal consultation ingestion, agentic care-plan structuring, and behavior-oriented delivery through gamification. The approach directly addresses a key failure mode in health apps—rapid abandonment—by combining clinical task clarity with sustained motivation mechanics (progression, ownership, scarcity, and social comparison).

The current system is operational and coherent end-to-end: users can upload consultation content, receive day-structured tasks, progress through a map, and ask contextual follow-up questions through a RAG assistant. Future work should focus on reducing heavy-step latency, formal retention studies, and longitudinal outcomes on adherence.

---

## References

1. Baumel A, Muench F, Edan S, Kane JM. *Objective User Engagement With Mental Health Apps: Systematic Search and Panel-Based Usage Analysis.* J Med Internet Res. 2019;21(9):e14567. doi:10.2196/14567

2. Kidman PG, Curtis RG, Watson A, Maher CA. *When and Why Adults Abandon Lifestyle Behavior and Mental Health Mobile Apps: Scoping Review.* J Med Internet Res. 2024;26:e56897. doi:10.2196/56897
