# Chatbot Architecture & Prompt Engineering

This document explains how the Euexia chatbot works, from user input to model response, with detailed breakdown of how prompts are constructed and modified at each step.

## Overview: The 4-Step RAG Pipeline

```
User Message
    ↓
[STEP 1] Question Condensation (condenseQuestion)
    ↓
[STEP 2] Context Retrieval (retrieveContext)
    ↓
[STEP 3] Response Generation (generateChatResponse)
    ↓
[STEP 4] Post-Processing (postProcess)
    ↓
Final Response
```

---

## STEP 1: Question Condensation

**File:** `backend/src/services/rag/questionCondenser.ts`  
**Purpose:** Convert follow-up questions (e.g., "how will these affect my disease?") into standalone questions that include context from the conversation.

### Input
- `recentHistory`: Last 6 messages (3 exchanges) from chat history
- `currentQuestion`: The user's current message

### Process

1. **Truncate long messages** to prevent overwhelming the condenser:
   - Assistant messages: max 200 chars
   - User messages: max 150 chars
   - Cuts at sentence boundaries

2. **Build condensation prompt:**
```typescript
const prompt = `Given this patient-doctor conversation, rephrase the patient's latest question into a STANDALONE question. The standalone question must make sense on its own without the conversation — include the specific topics, foods, medications, or conditions being discussed.

Chat History:
Patient: suggest me some healthy meals
Doctor: Here are some meal ideas: iron-rich foods, low-sodium diet...
Patient: how will these affect my disease?

Latest Question: how will these affect my disease?

IMPORTANT: The standalone question must reference specific items from the conversation (e.g., specific meals, medications, conditions mentioned). Output ONLY the rephrased question.

Standalone Question:`;
```

3. **Call MedGemma** with:
   - `max_new_tokens: 100`
   - `temperature: 0.1` (low for consistency)
   - `repetition_penalty: 1.1`

4. **Output:** Standalone question like:
   ```
   "How will iron-rich foods and low-sodium diet affect left ventricular failure and anemia?"
   ```

### Why This Step?
- Follow-up questions like "these meals" or "that medication" need context
- Vector search works better with complete, standalone questions
- The condensed question is used for retrieval, not the original

---

## STEP 2: Context Retrieval

**File:** `backend/src/services/rag/retriever.ts`  
**Purpose:** Find relevant patient data from uploaded documents, consultations, and checklist items.

### Input
- `userId`: Current user
- `standaloneQuestion`: The condensed question from Step 1
- `consultationId`: Optional, to scope to one consultation

### Process

#### 2.1 Embed the Question
```typescript
const queryEmbedding = await embedText(standaloneQuestion);
// Uses @xenova/transformers with model 'Xenova/all-MiniLM-L6-v2'
// Returns 384-dimensional vector
```

#### 2.2 Vector Search (3-Tier Fallback)

**Tier 1: Atlas Vector Search** (if index exists)
```typescript
ContextChunk.aggregate([
  {
    $vectorSearch: {
      index: 'context_embedding_index',
      path: 'embedding',
      queryVector: queryEmbedding,
      numCandidates: 60,
      limit: 10,
      filter: { userId, sourceType: ['consultation_summary', 'upload_summary', 'checklist_item'] }
    }
  }
])
```

**Tier 2: Cosine Similarity Fallback** (if Atlas fails)
- Fetches all chunks from MongoDB
- Scores each by cosine similarity to query embedding
- Returns top 10 most similar

**Tier 3: Direct Consultation Lookup** (if no chunks found)
- Loads `aggregatedSummary` or `checklistParagraph` directly from Consultation document
- This handles cases where indexing never ran

#### 2.3 MMR Reranking
- **Maximal Marginal Relevance** balances relevance + diversity
- Prevents returning 5 nearly-identical chunks
- Lambda = 0.6 (60% relevance, 40% diversity)

#### 2.4 Text Deduplication
- Removes chunks with >60% word overlap
- Prevents redundant information

#### 2.5 Always-Include Structured Data
Always adds these sections regardless of vector search results:

```typescript
const contextString = [
  'PATIENT_MEDICAL_CONTEXT:',
  '[1] Retrieved chunk 1...',
  '[2] Retrieved chunk 2...',
  '',
  'PATIENT_ACTIVE_TASKS:',
  '○ Take Bisoprolol: Take 1 tablet (2.5mg) every morning...',
  '✓ Check blood pressure: Monitor daily...',
  '',
  'GAME_PROGRESS:',
  'Level 5 | XP 1200 | Streak 7',
].join('\n');
```

### Output
- `contextString`: Assembled context (max ~7200 chars)
- `tokenEstimate`: Estimated token count
- `topChunkIds`: IDs of chunks used

---

## STEP 3: Response Generation

**File:** `backend/src/services/rag/langchainMedGemma.ts`  
**Purpose:** Generate the actual chatbot response using MedGemma.

### Input
- `systemPrompt`: Built from context string + rules
- `userMessage`: The condensed question from Step 1
- `conversationHistory`: Last 4 messages (2 exchanges) for continuity

### Process

#### 3.1 Build System Prompt

**File:** `backend/src/controllers/chat.controller.ts` → `buildSystemPrompt()`

```typescript
function buildSystemPrompt(contextString: string): string {
  return [
    'You are Euexia Doctor Assistant — a helpful, knowledgeable medical follow-up chatbot.',
    '',
    'RULES (follow strictly):',
    '1. You MUST ALWAYS provide a helpful answer. NEVER refuse...',
    '2. For patient-specific questions: use the patient context below...',
    '3. For general health questions: provide evidence-based general advice...',
    '4. Give concrete, specific advice...',
    '5. Use bullet points for lists...',
    '6. Never repeat the same sentence or point twice.',
    '7. If patient-specific info is missing, provide general guidance...',
    '8. CONVERSATION CONTINUITY: When patient refers to something from recent conversation, refer back to what was discussed.',
    '9. Answer ONLY the question asked. Do not add unrelated information...',
    '',
    contextString,  // ← The retrieved context from Step 2
  ].join('\n');
}
```

#### 3.2 Build Generation Prompt

**File:** `backend/src/services/rag/langchainMedGemma.ts` → `buildPrompt()`

```typescript
function buildPrompt(request: MedGemmaChatRequest): string {
  const parts = [];
  
  // 1. System prompt (rules + patient context)
  parts.push(`System: ${request.systemPrompt}`);
  
  // 2. Recent conversation history (for continuity)
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    parts.push('');
    parts.push('Recent conversation:');
    for (const turn of request.conversationHistory) {
      const role = turn.role === 'user' ? 'Patient' : 'Doctor';
      // Truncate: assistant 250 chars, user 150 chars
      const content = truncateForHistory(turn.content, maxLen);
      parts.push(`${role}: ${content}`);
    }
  }
  
  // 3. Current user question
  parts.push('');
  parts.push(`Patient: ${request.userMessage}`);
  parts.push('');
  parts.push('Doctor:');
  
  return parts.join('\n');
}
```

#### 3.3 Final Prompt Structure (Example)

```
System: You are Euexia Doctor Assistant — a helpful, knowledgeable medical follow-up chatbot.

RULES (follow strictly):
1. You MUST ALWAYS provide a helpful answer...
2. For patient-specific questions...
...
8. CONVERSATION CONTINUITY: When patient refers to something from recent conversation...
9. Answer ONLY the question asked...

PATIENT_MEDICAL_CONTEXT:
[1] Patient presents with left ventricular failure and iron deficiency anemia...
[2] Medications: Bisoprolol 2.5mg daily, Omeprazole 40mg before breakfast...

PATIENT_ACTIVE_TASKS:
○ Take Bisoprolol: Take 1 tablet (2.5mg) every morning with breakfast...
✓ Check blood pressure: Monitor daily, target <130/80...

GAME_PROGRESS:
Level 5 | XP 1200 | Streak 7

Recent conversation:
Patient: suggest me some healthy meals
Doctor: Here are some meal ideas: iron-rich foods, low-sodium diet, high-fiber options...
Patient: how will these affect my disease?

Patient: How will iron-rich foods and low-sodium diet affect left ventricular failure and anemia?

Doctor:
```

#### 3.4 Call MedGemma

```typescript
const result = await invokeTextModel(prompt, {
  max_new_tokens: 512,        // Max response length
  temperature: 0.3,          // Low = more focused, less creative
  repetition_penalty: 1.2,   // Penalize repeating phrases
  return_full_text: false,    // Don't echo the prompt
});
```

#### 3.5 Refusal Detection & Retry

If the model refuses (detected by patterns like "I cannot help", "no information available"), automatically retries with a simpler prompt:

```typescript
// Retry prompt (simpler, more forceful)
const retryPrompt = [
  'System: You are a helpful, knowledgeable health assistant.',
  'You must ALWAYS provide a useful answer. Give evidence-based general health advice.',
  'Be specific and practical...',
  '',
  'Recent conversation: [same history]',
  '',
  'Patient: [question]',
  '',
  'Doctor:',
].join('\n');

// Retry with higher temperature (0.5) to encourage response
```

---

## STEP 4: Post-Processing

**File:** `backend/src/services/rag/langchainMedGemma.ts` → `postProcess()`

### Process

1. **Strip prompt echo** (if model echoed the prompt)
2. **Remove role labels** ("Assistant:", "Doctor:", "Final Answer:")
3. **Truncate at stop patterns** (cuts at "Assistant:", "User:", etc.)
4. **Remove code fences** (```...```)
5. **Filter Python/code lines** (removes `def`, `import`, `return`, etc.)
6. **Normalize bullets** (`*` → `•`)
7. **Fuzzy deduplication**:
   - Line-level: removes near-duplicate lines (80% word overlap)
   - Sentence-level: removes near-duplicate sentences within paragraphs
8. **Cap at 12 lines** (prevents overly long responses)
9. **Hard cap at 1200 chars** (cuts at last complete sentence)

### Output
Clean, deduplicated, properly formatted response ready for the user.

---

## Complete Flow Example

### User Input
```
"how will these meals affect my disease?"
```

### Step 1: Condensation
**Input to condenser:**
```
Chat History:
Patient: suggest me some healthy meals
Doctor: Here are meal ideas: iron-rich foods, low-sodium diet, high-fiber options...

Latest Question: how will these meals affect my disease?
```

**Output:**
```
"How will iron-rich foods, low-sodium diet, and high-fiber meals affect left ventricular failure and anemia?"
```

### Step 2: Context Retrieval
**Query embedding:** [384-dimensional vector]

**Retrieved chunks:**
- Consultation summary about LVF and anemia
- Medication list (Bisoprolol, Omeprazole)
- Checklist items (dietary recommendations)

**Assembled context:**
```
PATIENT_MEDICAL_CONTEXT:
[1] Patient diagnosed with left ventricular failure and iron deficiency anemia...
[2] Medications: Bisoprolol 2.5mg daily, Omeprazole 40mg before breakfast...

PATIENT_ACTIVE_TASKS:
○ Take Bisoprolol: Take 1 tablet (2.5mg) every morning...
```

### Step 3: Generation
**Final prompt sent to MedGemma:**
```
System: You are Euexia Doctor Assistant...

RULES:
1. You MUST ALWAYS provide a helpful answer...
8. CONVERSATION CONTINUITY: When patient refers to something from recent conversation...
9. Answer ONLY the question asked...

PATIENT_MEDICAL_CONTEXT:
[1] Patient diagnosed with left ventricular failure...
...

Recent conversation:
Patient: suggest me some healthy meals
Doctor: Here are meal ideas: iron-rich foods, low-sodium diet...

Patient: How will iron-rich foods, low-sodium diet, and high-fiber meals affect left ventricular failure and anemia?

Doctor:
```

**Model output (raw):**
```
Iron-rich foods help address your anemia by increasing hemoglobin levels. Low-sodium diet reduces fluid retention, easing the workload on your heart. High-fiber options support digestion and overall cardiovascular health.
```

### Step 4: Post-Processing
**After post-processing:**
```
Iron-rich foods help address your anemia by increasing hemoglobin levels. Low-sodium diet reduces fluid retention, easing the workload on your heart. High-fiber options support digestion and overall cardiovascular health.
```

**Final response to user:**
```
Iron-rich foods help address your anemia by increasing hemoglobin levels. Low-sodium diet reduces fluid retention, easing the workload on your heart. High-fiber options support digestion and overall cardiovascular health.
```

---

## Key Design Decisions

### Why Question Condensation?
- Follow-up questions need context to be searchable
- Vector search works better with complete, standalone questions
- Separates conversation understanding from retrieval

### Why 3-Tier Retrieval?
- **Tier 1 (Atlas):** Fast, scalable (if configured)
- **Tier 2 (Cosine):** Works without Atlas index setup
- **Tier 3 (Direct):** Fallback if indexing failed

### Why Include Conversation History in Generation?
- Model needs to know what "these meals" refers to
- Without history, model has zero memory of previous turns
- Enables coherent multi-turn conversations

### Why Post-Processing?
- MedGemma sometimes generates code, markdown artifacts, duplicates
- Post-processing ensures clean, user-friendly output
- Fuzzy deduplication prevents repeated information

### Why MMR Reranking?
- Prevents returning 5 nearly-identical chunks
- Balances relevance (answer the question) + diversity (cover different topics)

---

## Environment Variables

```bash
# Generation
RAG_CHAT_MAX_NEW_TOKENS=512        # Max response length
RAG_CHAT_TEMPERATURE=0.3            # Lower = more focused
RAG_CHAT_REPETITION_PENALTY=1.2    # Higher = less repetition
RAG_CHAT_OUTPUT_MAX_CHARS=1200     # Hard cap on response length

# Retrieval
RAG_CONTEXT_TOKEN_BUDGET=1800      # Max tokens for context
RAG_VECTOR_TOP_K=10                # Number of chunks to retrieve
MONGODB_VECTOR_INDEX=context_embedding_index  # Atlas index name

# Embeddings
RAG_EMBED_DIM=384                  # Embedding dimension
RAG_EMBED_MODEL=Xenova/all-MiniLM-L6-v2  # Local embedding model
```

---

## Files Involved

1. **`chat.controller.ts`** - Main entry point, orchestrates the 4-step pipeline
2. **`questionCondenser.ts`** - Step 1: Condenses follow-up questions
3. **`retriever.ts`** - Step 2: Retrieves patient context
4. **`langchainMedGemma.ts`** - Step 3 & 4: Generates and post-processes response
5. **`indexer.ts`** - Indexes patient data into ContextChunk collection
6. **`embeddingService.ts`** - Generates embeddings using local HF model
7. **`sagemaker.ts`** - Calls MedGemma endpoint on AWS SageMaker

---

## Debugging

### Check What Context Was Retrieved
```typescript
console.log(`[RAG] Context preview: ${context.contextString.substring(0, 200)}...`);
```

### Check Condensed Question
```typescript
console.log('[RAG] Condensed question:', standaloneQuestion);
```

### Check Final Prompt (add logging)
In `langchainMedGemma.ts` → `buildPrompt()`, add:
```typescript
console.log('[RAG] Final prompt:', prompt);
```

### Check Post-Processing
The `postProcess()` function logs warnings for code removal, truncation, etc.

---

## Common Issues & Solutions

### Issue: Chatbot doesn't have patient data
- **Check:** Are context chunks being indexed? (see `indexer.ts`)
- **Check:** Is vector search working? (check logs for "Atlas Vector Search unavailable")
- **Solution:** Cosine fallback should work, but verify chunks exist in DB

### Issue: Chatbot ignores conversation history
- **Check:** Is `conversationHistory` being passed to `generateChatResponse()`?
- **Check:** Are messages being truncated too aggressively?
- **Solution:** Increase truncation limits in `truncateForHistory()`

### Issue: Responses are too short or cut off
- **Check:** `RAG_CHAT_MAX_NEW_TOKENS` (default 512)
- **Check:** `RAG_CHAT_OUTPUT_MAX_CHARS` (default 1200)
- **Solution:** Increase these values

### Issue: Model refuses to answer
- **Check:** Refusal detection patterns in `isRefusal()`
- **Check:** System prompt rules (should force model to always answer)
- **Solution:** Retry logic should handle this automatically

---

## Future Improvements

1. **Better conversation memory:** Use sliding window or summarization for long conversations
2. **Streaming responses:** Stream tokens as they're generated
3. **Multi-modal:** Support image questions (already have MedGemma-image endpoint)
4. **Citation:** Show which chunks were used to generate the answer
5. **Confidence scores:** Indicate when answer is based on patient data vs. general knowledge
