# Chatbot Prompt Structure - Visual Breakdown

This document shows the **exact structure** of prompts sent to MedGemma at each step.

---

## Step 1: Question Condensation Prompt

**Purpose:** Convert "how will these affect my disease?" → "How will iron-rich foods and low-sodium diet affect left ventricular failure and anemia?"

```
Given this patient-doctor conversation, rephrase the patient's latest question into a STANDALONE question. The standalone question must make sense on its own without the conversation — include the specific topics, foods, medications, or conditions being discussed.

Chat History:
Patient: suggest me some healthy meals
Doctor: Here are some meal ideas: iron-rich foods, low-sodium diet, high-fiber options. Iron-rich foods include red meat, poultry, fish, beans, lentils, spinach. Low-sodium diet means limiting processed foods, canned goods, fast food. High-fiber options include whole grains, fruits, vegetables. [...]
Patient: how will these affect my disease?

Latest Question: how will these affect my disease?

IMPORTANT: The standalone question must reference specific items from the conversation (e.g., specific meals, medications, conditions mentioned). Output ONLY the rephrased question.

Standalone Question:
```

**Model Output:**
```
How will iron-rich foods, low-sodium diet, and high-fiber meals affect left ventricular failure and anemia?
```

---

## Step 2: Context Retrieval (No Prompt - Database Query)

**Purpose:** Find relevant patient data

**Process:**
1. Embed condensed question → `[0.123, -0.456, 0.789, ...]` (384 dimensions)
2. Vector search MongoDB → Find top 10 similar chunks
3. MMR rerank → Select 5 diverse chunks
4. Assemble context string

**Output Context String:**
```
PATIENT_MEDICAL_CONTEXT:
[1] Patient diagnosed with left ventricular failure (LVF) and iron deficiency anemia. Recommended medications include Bisoprolol 2.5mg daily for heart rate control and Omeprazole 40mg before breakfast for stomach protection. Dietary recommendations focus on iron-rich foods, low-sodium intake, and high-fiber options to support both conditions.

[2] Medications: Bisoprolol 2.5mg orally once daily with breakfast. Omeprazole 40mg capsule 30 minutes before breakfast on empty stomach. Continue both for 2 weeks, then follow-up appointment.

PATIENT_ACTIVE_TASKS:
○ Take Bisoprolol: Take 1 tablet (2.5mg) every morning with breakfast. Swallow with a full glass of water. Do not skip doses — this helps control your heart rate. Continue for 2 weeks. (daily, 0/14)
✓ Check blood pressure: Monitor daily, target <130/80. Record readings in the morning before medications. (daily, 5/14)
○ Follow low-sodium diet: Limit processed foods, canned goods, fast food. Aim for less than 2g sodium per day. Focus on fresh produce, lean protein, whole grains. (daily, 0/14)

GAME_PROGRESS:
Level 5 | XP 1200 | Streak 7
```

---

## Step 3: Response Generation Prompt (FINAL PROMPT TO MEDGEMMA)

**This is the actual prompt sent to the MedGemma model.**

```
System: You are Euexia Doctor Assistant — a helpful, knowledgeable medical follow-up chatbot.

RULES (follow strictly):
1. You MUST ALWAYS provide a helpful answer. NEVER refuse or say "I cannot help" or "no information available".
2. For patient-specific questions (medications, diagnoses, appointments): use the patient context below. Never invent patient-specific medications, doses, or diagnoses.
3. For general health questions (nutrition, exercise, wellness, meals, recipes): provide evidence-based general advice. Prioritize patient context if relevant, but ALWAYS answer even without it.
4. Give concrete, specific advice — include food names, exercise types, exact actions, quantities.
5. Use bullet points for lists. Keep answers complete but focused (no filler).
6. Never repeat the same sentence or point twice.
7. If patient-specific info is missing for a specific question, provide helpful general guidance and briefly note they should consult their doctor for personalized details.
8. CONVERSATION CONTINUITY: When the patient refers to something from the recent conversation (e.g., "these meals", "that medication", "those exercises"), refer back to what was specifically discussed. Do NOT change topic or ignore the reference.
9. Answer ONLY the question asked. Do not add unrelated information about medications when asked about food, or vice versa.

PATIENT_MEDICAL_CONTEXT:
[1] Patient diagnosed with left ventricular failure (LVF) and iron deficiency anemia. Recommended medications include Bisoprolol 2.5mg daily for heart rate control and Omeprazole 40mg before breakfast for stomach protection. Dietary recommendations focus on iron-rich foods, low-sodium intake, and high-fiber options to support both conditions.

[2] Medications: Bisoprolol 2.5mg orally once daily with breakfast. Omeprazole 40mg capsule 30 minutes before breakfast on empty stomach. Continue both for 2 weeks, then follow-up appointment.

PATIENT_ACTIVE_TASKS:
○ Take Bisoprolol: Take 1 tablet (2.5mg) every morning with breakfast. Swallow with a full glass of water. Do not skip doses — this helps control your heart rate. Continue for 2 weeks. (daily, 0/14)
✓ Check blood pressure: Monitor daily, target <130/80. Record readings in the morning before medications. (daily, 5/14)
○ Follow low-sodium diet: Limit processed foods, canned goods, fast food. Aim for less than 2g sodium per day. Focus on fresh produce, lean protein, whole grains. (daily, 0/14)

GAME_PROGRESS:
Level 5 | XP 1200 | Streak 7

Recent conversation:
Patient: suggest me some healthy meals
Doctor: Here are some meal ideas: iron-rich foods, low-sodium diet, high-fiber options. Iron-rich foods include red meat, poultry, fish, beans, lentils, spinach. Low-sodium diet means limiting processed foods, canned goods, fast food. High-fiber options include whole grains, fruits, vegetables.

Patient: How will iron-rich foods, low-sodium diet, and high-fiber meals affect left ventricular failure and anemia?

Doctor:
```

**Model Output (Raw):**
```
Iron-rich foods help address your anemia by increasing hemoglobin levels and improving oxygen delivery to your tissues. This is especially important given your left ventricular failure, as better oxygenation reduces the workload on your heart.

Low-sodium diet reduces fluid retention, which is crucial for heart failure management. Excess sodium causes your body to retain water, increasing blood volume and making your heart work harder. By limiting sodium to less than 2g per day, you'll reduce fluid buildup and ease the strain on your heart.

High-fiber meals support digestion and help maintain stable blood sugar levels, which benefits overall cardiovascular health. Fiber also helps you feel full, which can aid in maintaining a healthy weight — another important factor for heart health.

Together, these dietary changes work synergistically: iron-rich foods address the anemia, low-sodium reduces heart workload, and high-fiber supports overall cardiovascular function.
```

---

## Step 4: Post-Processing

**Input (Raw Model Output):**
```
Iron-rich foods help address your anemia by increasing hemoglobin levels and improving oxygen delivery to your tissues. This is especially important given your left ventricular failure, as better oxygenation reduces the workload on your heart.

Low-sodium diet reduces fluid retention, which is crucial for heart failure management. Excess sodium causes your body to retain water, increasing blood volume and making your heart work harder. By limiting sodium to less than 2g per day, you'll reduce fluid buildup and ease the strain on your heart.

High-fiber meals support digestion and help maintain stable blood sugar levels, which benefits overall cardiovascular health. Fiber also helps you feel full, which can aid in maintaining a healthy weight — another important factor for heart health.

Together, these dietary changes work synergistically: iron-rich foods address the anemia, low-sodium reduces heart workload, and high-fiber supports overall cardiovascular function.
```

**Post-Processing Steps:**
1. ✅ No prompt echo detected
2. ✅ No role labels to remove
3. ✅ No stop patterns found
4. ✅ No code fences
5. ✅ No Python code lines
6. ✅ Bullets normalized (none in this case)
7. ✅ No duplicate lines
8. ✅ No duplicate sentences
9. ✅ Under 12 lines (4 lines)
10. ✅ Under 1200 chars (~650 chars)

**Final Output (Sent to User):**
```
Iron-rich foods help address your anemia by increasing hemoglobin levels and improving oxygen delivery to your tissues. This is especially important given your left ventricular failure, as better oxygenation reduces the workload on your heart.

Low-sodium diet reduces fluid retention, which is crucial for heart failure management. Excess sodium causes your body to retain water, increasing blood volume and making your heart work harder. By limiting sodium to less than 2g per day, you'll reduce fluid buildup and ease the strain on your heart.

High-fiber meals support digestion and help maintain stable blood sugar levels, which benefits overall cardiovascular health. Fiber also helps you feel full, which can aid in maintaining a healthy weight — another important factor for heart health.

Together, these dietary changes work synergistically: iron-rich foods address the anemia, low-sodium reduces heart workload, and high-fiber supports overall cardiovascular function.
```

---

## Prompt Modifications Summary

| Step | Input | Modification | Output |
|------|-------|--------------|--------|
| **1. Condensation** | User message + history | Truncate history, add instructions | Standalone question |
| **2. Retrieval** | Standalone question | Embed → Search → Rerank → Assemble | Context string |
| **3. Generation** | Context + question + history | Build system prompt + conversation history | Final prompt to MedGemma |
| **4. Post-Process** | Raw model output | Strip artifacts, deduplicate, truncate | Clean response |

---

## Key Prompt Components

### System Prompt Structure
```
[Role Definition]
  ↓
[Rules (9 rules)]
  ↓
[Patient Context]
  ↓
[Conversation History]
  ↓
[Current Question]
  ↓
[Response Start Token]
```

### Context String Structure
```
PATIENT_MEDICAL_CONTEXT:
[1] Chunk 1...
[2] Chunk 2...
...

PATIENT_ACTIVE_TASKS:
○ Task 1...
✓ Task 2...
...

GAME_PROGRESS:
Level X | XP Y | Streak Z
```

### Conversation History Structure
```
Recent conversation:
Patient: [truncated to 150 chars]
Doctor: [truncated to 250 chars]
Patient: [truncated to 150 chars]
Doctor: [truncated to 250 chars]
```

---

## Token Budget Breakdown (Approximate)

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt (rules) | ~200 | Fixed |
| Patient context | ~400-800 | Variable, depends on retrieval |
| Conversation history | ~100-200 | Last 4 messages, truncated |
| Current question | ~20-50 | Condensed question |
| **Total Input** | **~720-1250** | |
| **Model Output** | **~100-400** | Max 512 tokens |

**Total Request:** ~820-1650 tokens

---

## How to Modify Prompts

### Change System Rules
**File:** `backend/src/controllers/chat.controller.ts` → `buildSystemPrompt()`

```typescript
function buildSystemPrompt(contextString: string): string {
  return [
    'You are Euexia Doctor Assistant...',
    '',
    'RULES:',
    '1. [Your rule here]',
    '2. [Another rule]',
    // Add more rules...
    '',
    contextString,
  ].join('\n');
}
```

### Change Conversation History Format
**File:** `backend/src/services/rag/langchainMedGemma.ts` → `buildPrompt()`

```typescript
if (request.conversationHistory && request.conversationHistory.length > 0) {
  parts.push('');
  parts.push('Recent conversation:');
  for (const turn of request.conversationHistory) {
    // Modify how history is formatted here
    parts.push(`${role}: ${content}`);
  }
}
```

### Change Context Format
**File:** `backend/src/services/rag/retriever.ts` → `retrieveContext()`

```typescript
const contextString = [
  'PATIENT_MEDICAL_CONTEXT:',  // Change this label
  retrievedSection,
  '',
  'PATIENT_ACTIVE_TASKS:',      // Change this label
  checklistLines.join('\n'),
  // Add more sections...
].join('\n');
```

### Change Condensation Instructions
**File:** `backend/src/services/rag/questionCondenser.ts` → `condenseQuestion()`

```typescript
const prompt = `Given this patient-doctor conversation, rephrase...
  // Modify instructions here
  Chat History:
  ${historyText}
  ...
`;
```

---

## Testing Prompt Changes

### 1. Add Logging
In `langchainMedGemma.ts` → `generateChatResponse()`:
```typescript
const prompt = buildPrompt(request);
console.log('=== FINAL PROMPT ===');
console.log(prompt);
console.log('=== END PROMPT ===');
```

### 2. Test with Simple Question
```bash
# Send: "what medications do I take?"
# Check logs for:
# - Condensed question
# - Retrieved context
# - Final prompt
# - Model output (raw)
# - Post-processed output
```

### 3. Test Conversation Continuity
```bash
# Message 1: "suggest healthy meals"
# Message 2: "how will these affect my disease?"
# Check that Message 2 includes Message 1 in history
```

---

## Common Prompt Issues

### Issue: Model ignores patient context
**Check:**
- Is context string being included in system prompt?
- Is context too long (getting truncated)?
- Are chunks actually relevant?

**Fix:**
- Add explicit instruction: "Use the patient context below to answer"
- Reduce context length if too long
- Improve retrieval (check similarity scores)

### Issue: Model changes topic mid-conversation
**Check:**
- Is conversation history being included?
- Are history messages truncated too aggressively?

**Fix:**
- Increase history truncation limits
- Add explicit rule: "Answer ONLY the question asked"

### Issue: Model refuses to answer
**Check:**
- System prompt rule #1 (should force answer)
- Is refusal detection working?

**Fix:**
- Retry logic should handle this automatically
- Check retry prompt is simpler/more forceful

---

## Prompt Engineering Tips

1. **Be explicit:** Don't assume the model will infer what you want
2. **Use examples:** Show the model what good output looks like
3. **Order matters:** Put important rules first
4. **Keep it focused:** Too many rules can confuse the model
5. **Test incrementally:** Change one thing at a time
6. **Monitor token usage:** Longer prompts = less room for response
