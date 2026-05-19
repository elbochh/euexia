import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { GoogleAuth } from 'google-auth-library';
import { extractMedicationNames } from '../services/agents/medicationExtractor';

type ChatRole = 'system' | 'user' | 'assistant';

interface TimedResult<T> {
  value: T;
  ms: number;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface ModelCallResult {
  text: string;
  usage: TokenUsage;
}

interface ModelConfig {
  label: string;
  model: string;
  provider: 'vertex' | 'openai';
  inputUsdPer1M?: number;
  outputUsdPer1M?: number;
  pricingSource?: string;
}

interface ChecklistEvent {
  title: string;
  description: string;
  category: string;
  xpReward?: number;
  coinReward?: number;
  unlockAt?: string;
  groupId?: string;
  sequenceId?: string;
  starGroupId?: string;
  orderInGroup?: number;
}

interface WorkflowResult {
  runIndex: number;
  label: string;
  model: string;
  ok: boolean;
  error?: string;
  timings: Record<string, number>;
  usage: Record<string, TokenUsage>;
  totalUsage: TokenUsage;
  estimatedCostUsd: number | null;
  totalMs: number;
  pdfChars: number;
  summary: string;
  carePlan: string;
  rawChecklist: string;
  events: ChecklistEvent[];
  metrics: QualityMetrics;
}

interface AggregateResult {
  label: string;
  model: string;
  runs: number;
  completedRuns: number;
  jsonValidRuns: number;
  medicationPerfectRuns: number;
  checklistQualityRuns: number;
  fullDetailRuns: number;
  avgTotalMs: number;
  minTotalMs: number;
  maxTotalMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgTotalTokens: number;
  totalEstimatedCostUsd: number | null;
  avgEstimatedCostUsd: number | null;
}

interface QualityMetrics {
  jsonValid: boolean;
  eventCount: number;
  medicationEventCount: number;
  singleMedicationEventCount: number;
  groupedMedicationEventCount: number;
  duplicateTitleCount: number;
  medicationRecall: string;
  medicationRecallCount: number;
  medicationRecallTotal: number;
  missingMedications: string[];
  followUpRecall: string;
  followUpRecallCount: number;
  followUpRecallTotal: number;
  missingFollowUps: string[];
  hallucinatedMedicationSignals: string[];
  scheduleSignals: {
    twoWeekMedicationCourse: boolean;
    twiceDailyExpandedOrMentioned: boolean;
    nightlySimvastatinMentioned: boolean;
    inrMonitoringMentioned: boolean;
  };
}

const DEFAULT_PDF =
  'C:/Users/jasem/Downloads/UH Bristol Electronic Discharge Summary Sample (1).pdf';

const EXPECTED_MEDICATIONS = [
  { name: 'Bisoprolol', aliases: ['bisoprolol'] },
  { name: 'Alendronic Acid', aliases: ['alendronic acid', 'alendronic'] },
  { name: 'Adcal-D3', aliases: ['adcal-d3', 'adcal', 'calcium'] },
  { name: 'Omeprazole', aliases: ['omeprazole'] },
  {
    name: 'Glyceryl Trinitrate',
    aliases: ['glyceryl trinitrate', 'gtn', 'nitroglycerin'],
  },
  { name: 'Warfarin Sodium', aliases: ['warfarin', 'warfarin sodium'] },
  { name: 'Folic Acid', aliases: ['folic acid'] },
  { name: 'Ramipril', aliases: ['ramipril'] },
  { name: 'Simvastatin', aliases: ['simvastatin'] },
  { name: 'Gliclazide m/r', aliases: ['gliclazide'] },
];

const EXPECTED_FOLLOW_UPS = [
  { name: 'Repeat FBC every two weeks', terms: ['fbc', 'every two weeks'] },
  { name: 'Contact Dr Deep if Hb falls below 8.00', terms: ['dr deep', 'hb', '8'] },
  { name: 'Colonoscopy to be arranged', terms: ['colonoscopy'] },
  { name: '6 week follow-up with Dr Wide', terms: ['dr wide', '6 week'] },
  { name: '8 week follow-up with Dr Deep', terms: ['dr deep', '8 week'] },
  { name: 'Home oxygen provision', terms: ['home oxygen'] },
];

function getArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function normalizeGemmaModelId(model: string): string {
  if (model.startsWith('gemma-4-') || model.startsWith('gemma3') || model.startsWith('gemma-3')) {
    return `google/${model}`;
  }
  return model;
}

function normalizeGoogleModelId(model: string): string {
  if (model.startsWith('gemini-') || model.startsWith('gemma-')) return `google/${model}`;
  return model;
}

function hrMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

function emptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

function normalizeUsage(raw: any): TokenUsage {
  if (!raw) return emptyUsage();
  const inputTokens = Number(raw.input_tokens ?? raw.prompt_tokens ?? 0);
  const outputTokens = Number(raw.output_tokens ?? raw.completion_tokens ?? 0);
  const totalTokens = Number(raw.total_tokens ?? inputTokens + outputTokens);
  return { inputTokens, outputTokens, totalTokens };
}

function estimateCost(config: ModelConfig, usage: TokenUsage): number | null {
  if (typeof config.inputUsdPer1M !== 'number' || typeof config.outputUsdPer1M !== 'number') {
    return null;
  }
  return (usage.inputTokens / 1_000_000) * config.inputUsdPer1M
    + (usage.outputTokens / 1_000_000) * config.outputUsdPer1M;
}

async function timed<T>(fn: () => Promise<T>): Promise<TimedResult<T>> {
  const start = process.hrtime.bigint();
  const value = await fn();
  return { value, ms: Math.round(hrMs(start)) };
}

function getVertexEndpoint(): string {
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is required.');

  const location = process.env.GOOGLE_VERTEX_LOCATION || 'global';
  const host =
    location === 'global'
      ? 'https://aiplatform.googleapis.com'
      : `https://${location}-aiplatform.googleapis.com`;

  return `${host}/v1/projects/${project}/locations/${location}/endpoints/openapi/chat/completions`;
}

async function getAccessToken(): Promise<string> {
  if (process.env.GOOGLE_VERTEX_ACCESS_TOKEN) {
    return process.env.GOOGLE_VERTEX_ACCESS_TOKEN;
  }

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!token) throw new Error('Could not obtain Google Cloud access token.');
  return token;
}

async function invokeVertexChat(
  model: string,
  messages: Array<{ role: ChatRole; content: string }>,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<ModelCallResult> {
  const token = await getAccessToken();
  const response = await fetch(getVertexEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 4096,
      stream: false,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Vertex ${model} failed: ${response.status} ${body.slice(0, 700)}`);
  }

  const parsed = JSON.parse(body);
  return {
    text: parsed?.choices?.[0]?.message?.content || '',
    usage: normalizeUsage(parsed?.usage),
  };
}

async function invokeOpenAIResponses(
  model: string,
  messages: Array<{ role: ChatRole; content: string }>,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<ModelCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for the OpenAI benchmark.');
  }

  const input = messages.map((message) => ({
    role: message.role === 'system' ? 'developer' : message.role,
    content: message.content,
  }));

  const payload: Record<string, any> = {
    model,
    input,
    max_output_tokens: options.maxTokens ?? 4096,
    reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || 'low' },
    text: { verbosity: process.env.OPENAI_TEXT_VERBOSITY || 'low' },
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI ${model} failed: ${response.status} ${body.slice(0, 700)}`);
  }

  const parsed = JSON.parse(body);
  let text = '';
  if (typeof parsed.output_text === 'string' && parsed.output_text.trim()) {
    text = parsed.output_text;
  } else {
    const parts: string[] = [];
    for (const item of parsed.output || []) {
      for (const content of item.content || []) {
        if (typeof content.text === 'string') parts.push(content.text);
      }
    }
    text = parts.join('\n').trim();
  }

  return { text, usage: normalizeUsage(parsed?.usage) };
}

async function invokeModel(
  config: ModelConfig,
  messages: Array<{ role: ChatRole; content: string }>,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<ModelCallResult> {
  if (config.provider === 'openai') {
    return invokeOpenAIResponses(config.model, messages, options);
  }
  return invokeVertexChat(config.model, messages, options);
}

function buildPdfSummaryPrompt(pdfText: string): string {
  return `You are a clinical AI assistant. Below is text extracted from a medical PDF discharge summary.

Write a detailed medical summary that captures all concrete information, especially:
- medications from tables: drug, dose, frequency, route, duration, GP action
- diagnoses and main problems
- tests and lab work
- follow-up appointments
- monitoring instructions and warning thresholds
- equipment, referrals, patient-specific accessibility needs

Preserve exact numbers, dates, names, doses, and durations. Do not invent facts.

Extracted PDF text:
${pdfText}

Detailed medical summary:`;
}

function buildCarePlanPrompt(summary: string, knownMeds: string): string {
  const medSection = knownMeds
    ? `\nMandatory medication list detected from source. Every item must be included:\n${knownMeds}\n`
    : '';

  return `You are a clinical AI assistant. Merge the summary into one clear, patient-friendly care-plan paragraph.

Goals:
- Preserve every concrete medical detail.
- Include all medication name, dose, route, frequency, duration, and GP action.
- Include follow-up appointments, tests, warning thresholds, equipment, referrals, and accessibility notes.
- Do not invent new medications or diagnoses.
${medSection}
Summary:
${summary}

Final care-plan paragraph:`;
}

function buildChecklistPrompt(carePlan: string, nowIso: string): string {
  return `Convert this care plan into a JSON array of scheduled checklist events.

Rules:
1. Include medications, appointments, tests, monitoring, equipment/referral steps, and lifestyle/general care actions.
2. Expand recurring medication frequencies when reasonable:
   - once daily for 2 weeks -> 14 events
   - twice daily for 2 weeks -> 28 events
   - every night for 2 weeks -> 14 events
   - when required medications may be one "use when needed" event.
3. unlockAt must be ISO 8601. Day 1 starts at "${nowIso}".
4. sequenceId groups repeated events for the same medication/routine.
5. starGroupId groups events by calendar day.
6. title should be short action + item name only.
7. description must include dose, route, frequency, duration, and key instruction.
8. Output only JSON. No markdown.

Each event shape:
{
  "title": "string",
  "description": "string",
  "category": "medication|nutrition|exercise|monitoring|appointment|test|lifestyle|general",
  "xpReward": 5,
  "coinReward": 3,
  "unlockAt": "ISO 8601",
  "groupId": "string",
  "sequenceId": "string",
  "starGroupId": "string",
  "orderInGroup": 0
}

Care plan:
${carePlan}

JSON array only:`;
}

function extractJsonArray(raw: string): ChecklistEvent[] {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  const start = text.indexOf('[');
  if (start === -1) throw new Error('No JSON array found.');

  let inString = false;
  let escaped = false;
  let depth = 0;
  let end = -1;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '[') depth += 1;
    if (ch === ']') depth -= 1;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }

  if (end === -1) {
    const lastObject = text.lastIndexOf('}');
    if (lastObject === -1) throw new Error('Truncated JSON with no complete object.');
    text = `${text.slice(start, lastObject + 1)}]`;
  } else {
    text = text.slice(start, end);
  }

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('Parsed JSON is not an array.');
  return parsed
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      title: String(item.title || ''),
      description: String(item.description || ''),
      category: String(item.category || 'general'),
      xpReward: Number(item.xpReward || 10),
      coinReward: Number(item.coinReward || 5),
      unlockAt: item.unlockAt ? String(item.unlockAt) : undefined,
      groupId: item.groupId ? String(item.groupId) : undefined,
      sequenceId: item.sequenceId ? String(item.sequenceId) : undefined,
      starGroupId: item.starGroupId ? String(item.starGroupId) : undefined,
      orderInGroup: Number(item.orderInGroup || 0),
    }));
}

function textForEvents(events: ChecklistEvent[], extra = ''): string {
  return `${extra}\n${events.map((e) => `${e.title} ${e.description}`).join('\n')}`.toLowerCase();
}

function includesAll(text: string, terms: string[]): boolean {
  return terms.every((term) => text.includes(term.toLowerCase()));
}

function scoreQuality(events: ChecklistEvent[], rawChecklist: string, carePlan: string): QualityMetrics {
  const allText = textForEvents(events, `${rawChecklist}\n${carePlan}`);

  const missingMedications = EXPECTED_MEDICATIONS
    .filter((med) => !med.aliases.some((alias) => allText.includes(alias)))
    .map((med) => med.name);
  const medicationRecallCount = EXPECTED_MEDICATIONS.length - missingMedications.length;

  const missingFollowUps = EXPECTED_FOLLOW_UPS
    .filter((item) => !includesAll(allText, item.terms))
    .map((item) => item.name);
  const followUpRecallCount = EXPECTED_FOLLOW_UPS.length - missingFollowUps.length;

  const medicationEvents = events.filter((event) => event.category === 'medication');
  const medicationMentionCount = (text: string): number =>
    EXPECTED_MEDICATIONS.filter((med) => med.aliases.some((alias) => text.includes(alias))).length;
  const singleMedicationEventCount = medicationEvents.filter((event) => {
    const text = `${event.title} ${event.description}`.toLowerCase();
    return medicationMentionCount(text) === 1;
  }).length;
  const groupedMedicationEventCount = medicationEvents.filter((event) => {
    const text = `${event.title} ${event.description}`.toLowerCase();
    return medicationMentionCount(text) > 1;
  }).length;
  const titles = events.map((event) => event.title.toLowerCase().trim()).filter(Boolean);
  const duplicateTitleCount = titles.filter((title, index) => titles.indexOf(title) !== index).length;
  const hallucinatedMedicationSignals = medicationEvents
    .filter((event) => {
      const text = `${event.title} ${event.description}`.toLowerCase();
      return !EXPECTED_MEDICATIONS.some((med) => med.aliases.some((alias) => text.includes(alias)));
    })
    .map((event) => event.title)
    .filter((title, index, list) => title && list.indexOf(title) === index)
    .slice(0, 12);

  return {
    jsonValid: true,
    eventCount: events.length,
    medicationEventCount: medicationEvents.length,
    singleMedicationEventCount,
    groupedMedicationEventCount,
    duplicateTitleCount,
    medicationRecall: `${medicationRecallCount}/${EXPECTED_MEDICATIONS.length}`,
    medicationRecallCount,
    medicationRecallTotal: EXPECTED_MEDICATIONS.length,
    missingMedications,
    followUpRecall: `${followUpRecallCount}/${EXPECTED_FOLLOW_UPS.length}`,
    followUpRecallCount,
    followUpRecallTotal: EXPECTED_FOLLOW_UPS.length,
    missingFollowUps,
    hallucinatedMedicationSignals,
    scheduleSignals: {
      twoWeekMedicationCourse: /2\s*weeks|two\s*weeks/.test(allText),
      twiceDailyExpandedOrMentioned: /twice\s*daily|2\s*x\s*daily/.test(allText),
      nightlySimvastatinMentioned: allText.includes('simvastatin') && /night|nightly|every night/.test(allText),
      inrMonitoringMentioned: allText.includes('inr'),
    },
  };
}

async function runWorkflow(config: ModelConfig, pdfText: string): Promise<WorkflowResult> {
  const totalStart = process.hrtime.bigint();
  const timings: Record<string, number> = {};
  const usage: Record<string, TokenUsage> = {};
  let summary = '';
  let carePlan = '';
  let rawChecklist = '';
  let events: ChecklistEvent[] = [];

  try {
    const pdfSummary = await timed(() =>
      invokeModel(
        config,
        [
          {
            role: 'system',
            content: 'You are a precise clinical extraction assistant. Do not fabricate facts.',
          },
          { role: 'user', content: buildPdfSummaryPrompt(pdfText) },
        ],
        { maxTokens: 4096, temperature: 0.1 }
      )
    );
    summary = pdfSummary.value.text;
    timings.pdf_summary_ms = pdfSummary.ms;
    usage.pdf_summary = pdfSummary.value.usage;

    const medExtraction = await timed(async () => extractMedicationNames(summary).map((m) => m.rawMatch));
    timings.rule_med_extraction_ms = medExtraction.ms;
    const knownMeds = medExtraction.value.map((m, i) => `${i + 1}. ${m}`).join('\n');

    const aggregate = await timed(() =>
      invokeModel(
        config,
        [
          {
            role: 'system',
            content: 'You are a precise medical assistant. Return faithful patient-facing care plans.',
          },
          { role: 'user', content: buildCarePlanPrompt(summary, knownMeds) },
        ],
        { maxTokens: 4096, temperature: 0.1 }
      )
    );
    carePlan = aggregate.value.text;
    timings.care_plan_ms = aggregate.ms;
    usage.care_plan = aggregate.value.usage;

    const checklist = await timed(() =>
      invokeModel(
        config,
        [
          {
            role: 'system',
            content: 'Return only valid JSON arrays. Do not include markdown or commentary.',
          },
          { role: 'user', content: buildChecklistPrompt(carePlan, new Date().toISOString()) },
        ],
        { maxTokens: 8192, temperature: 0.05 }
      )
    );
    rawChecklist = checklist.value.text;
    timings.checklist_generation_ms = checklist.ms;
    usage.checklist_generation = checklist.value.usage;

    const parse = timed(async () => extractJsonArray(rawChecklist));
    const parsed = await parse;
    events = parsed.value;
    timings.json_parse_ms = parsed.ms;

    const metrics = scoreQuality(events, rawChecklist, carePlan);
    const totalUsage = Object.values(usage).reduce(addUsage, emptyUsage());
    return {
      label: config.label,
      model: config.model,
      ok: true,
      timings,
      usage,
      totalUsage,
      estimatedCostUsd: estimateCost(config, totalUsage),
      totalMs: Math.round(hrMs(totalStart)),
      pdfChars: pdfText.length,
      summary,
      carePlan,
      rawChecklist,
      events,
      metrics,
      runIndex: 1,
    };
  } catch (error: any) {
    return {
      label: config.label,
      model: config.model,
      ok: false,
      error: error?.message || String(error),
      timings,
      usage,
      totalUsage: Object.values(usage).reduce(addUsage, emptyUsage()),
      estimatedCostUsd: estimateCost(config, Object.values(usage).reduce(addUsage, emptyUsage())),
      totalMs: Math.round(hrMs(totalStart)),
      pdfChars: pdfText.length,
      summary,
      carePlan,
      rawChecklist,
      events,
      metrics: {
        jsonValid: false,
        eventCount: events.length,
        medicationEventCount: events.filter((e) => e.category === 'medication').length,
        singleMedicationEventCount: 0,
        groupedMedicationEventCount: 0,
        duplicateTitleCount: 0,
        medicationRecall: `0/${EXPECTED_MEDICATIONS.length}`,
        medicationRecallCount: 0,
        medicationRecallTotal: EXPECTED_MEDICATIONS.length,
        missingMedications: EXPECTED_MEDICATIONS.map((m) => m.name),
        followUpRecall: `0/${EXPECTED_FOLLOW_UPS.length}`,
        followUpRecallCount: 0,
        followUpRecallTotal: EXPECTED_FOLLOW_UPS.length,
        missingFollowUps: EXPECTED_FOLLOW_UPS.map((m) => m.name),
        hallucinatedMedicationSignals: [],
        scheduleSignals: {
          twoWeekMedicationCourse: false,
          twiceDailyExpandedOrMentioned: false,
          nightlySimvastatinMentioned: false,
          inrMonitoringMentioned: false,
        },
      },
      runIndex: 1,
    };
  }
}

function ms(value: number | undefined): string {
  return typeof value === 'number' ? value.toLocaleString() : 'n/a';
}

function tokens(value: number | undefined): string {
  return typeof value === 'number' ? value.toLocaleString() : 'n/a';
}

function usd(value: number | null | undefined): string {
  return typeof value === 'number' ? `$${value.toFixed(5)}` : 'n/a';
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isMedicationPerfect(result: WorkflowResult): boolean {
  return (
    result.ok &&
    result.metrics.jsonValid &&
    result.metrics.medicationRecallCount === result.metrics.medicationRecallTotal &&
    result.metrics.hallucinatedMedicationSignals.length === 0
  );
}

function isChecklistQualityPass(result: WorkflowResult): boolean {
  return (
    isMedicationPerfect(result) &&
    result.metrics.singleMedicationEventCount >= EXPECTED_MEDICATIONS.length &&
    result.metrics.duplicateTitleCount === 0
  );
}

function isFullDetailPass(result: WorkflowResult): boolean {
  return (
    isChecklistQualityPass(result) &&
    result.metrics.followUpRecallCount === result.metrics.followUpRecallTotal
  );
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

function sampleEvents(events: ChecklistEvent[]): string {
  return events
    .slice(0, 12)
    .map((event, index) => `${index + 1}. ${event.title} - ${event.description}`)
    .join('\n');
}

function resultTable(results: WorkflowResult[]): string {
  const rows = results.map((r) =>
    [
      r.label,
      r.model,
      r.runIndex,
      r.ok ? 'yes' : 'no',
      ms(r.totalMs),
      ms(r.timings.pdf_summary_ms),
      ms(r.timings.care_plan_ms),
      ms(r.timings.checklist_generation_ms),
      tokens(r.totalUsage.inputTokens),
      tokens(r.totalUsage.outputTokens),
      tokens(r.totalUsage.totalTokens),
      usd(r.estimatedCostUsd),
      r.metrics.jsonValid ? 'yes' : 'no',
      r.metrics.eventCount,
      r.metrics.singleMedicationEventCount,
      r.metrics.groupedMedicationEventCount,
      r.metrics.duplicateTitleCount,
      r.metrics.medicationRecall,
      r.metrics.followUpRecall,
      r.metrics.hallucinatedMedicationSignals.length,
    ].join(' | ')
  );

  return [
    '| Model | Model ID | Run | Completed | Total ms | PDF summary ms | Care plan ms | Checklist ms | Input tokens | Output tokens | Total tokens | Est. cost | JSON valid | Events | Single-med events | Grouped-med events | Duplicate titles | Medication recall | Follow-up recall | Extra med signals |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...rows.map((row) => `| ${row} |`),
  ].join('\n');
}

function aggregateResults(results: WorkflowResult[]): AggregateResult[] {
  const groups = new Map<string, WorkflowResult[]>();
  for (const result of results) {
    const key = `${result.label}|${result.model}`;
    groups.set(key, [...(groups.get(key) || []), result]);
  }

  return Array.from(groups.values()).map((group) => {
    const successful = group.filter((result) => result.ok);
    const costs = group
      .map((result) => result.estimatedCostUsd)
      .filter((value): value is number => typeof value === 'number');
    const totalCost = costs.length > 0 ? costs.reduce((sum, value) => sum + value, 0) : null;
    const times = successful.map((result) => result.totalMs);

    return {
      label: group[0].label,
      model: group[0].model,
      runs: group.length,
      completedRuns: successful.length,
      jsonValidRuns: group.filter((result) => result.metrics.jsonValid).length,
      medicationPerfectRuns: group.filter(isMedicationPerfect).length,
      checklistQualityRuns: group.filter(isChecklistQualityPass).length,
      fullDetailRuns: group.filter(isFullDetailPass).length,
      avgTotalMs: avg(times),
      minTotalMs: times.length ? Math.min(...times) : 0,
      maxTotalMs: times.length ? Math.max(...times) : 0,
      avgInputTokens: avg(successful.map((result) => result.totalUsage.inputTokens)),
      avgOutputTokens: avg(successful.map((result) => result.totalUsage.outputTokens)),
      avgTotalTokens: avg(successful.map((result) => result.totalUsage.totalTokens)),
      totalEstimatedCostUsd: totalCost,
      avgEstimatedCostUsd: totalCost == null ? null : totalCost / group.length,
    };
  });
}

function aggregateTable(results: WorkflowResult[]): string {
  const rows = aggregateResults(results).map((r) =>
    [
      r.label,
      r.model,
      `${r.completedRuns}/${r.runs}`,
      `${r.jsonValidRuns}/${r.runs}`,
      `${r.medicationPerfectRuns}/${r.runs}`,
      `${r.checklistQualityRuns}/${r.runs}`,
      `${r.fullDetailRuns}/${r.runs}`,
      ms(Math.round(r.avgTotalMs)),
      ms(r.minTotalMs),
      ms(r.maxTotalMs),
      tokens(Math.round(r.avgInputTokens)),
      tokens(Math.round(r.avgOutputTokens)),
      tokens(Math.round(r.avgTotalTokens)),
      usd(r.avgEstimatedCostUsd),
      usd(r.totalEstimatedCostUsd),
    ].join(' | ')
  );

  return [
    '| Model | Model ID | Completed | JSON valid | Medication-perfect | Checklist-quality pass | Full-detail pass | Avg ms | Min ms | Max ms | Avg input tokens | Avg output tokens | Avg total tokens | Avg cost | Total cost |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...rows.map((row) => `| ${row} |`),
  ].join('\n');
}

function detailsFor(result: WorkflowResult): string {
  const m = result.metrics;
  return `## ${result.label}

- Model: \`${result.model}\`
- Completed: ${yesNo(result.ok)}
- Total workflow time: ${ms(result.totalMs)} ms
- Total input tokens: ${tokens(result.totalUsage.inputTokens)}
- Total output tokens: ${tokens(result.totalUsage.outputTokens)}
- Total tokens: ${tokens(result.totalUsage.totalTokens)}
- Estimated cost: ${usd(result.estimatedCostUsd)}
- Pricing source: ${result.estimatedCostUsd === null ? 'not available' : result.model.includes('gpt') ? 'OpenAI official pricing page' : 'third-party Vertex Gemma listing; confirm with Google Cloud billing'}
- Medication recall: ${m.medicationRecall}
- Follow-up recall: ${m.followUpRecall}
- JSON valid: ${yesNo(m.jsonValid)}
- Events generated: ${m.eventCount}
- Medication events generated: ${m.medicationEventCount}
- Single-medication events: ${m.singleMedicationEventCount}
- Grouped-medication events: ${m.groupedMedicationEventCount}
- Duplicate checklist titles: ${m.duplicateTitleCount}
- Two-week medication course preserved: ${yesNo(m.scheduleSignals.twoWeekMedicationCourse)}
- Twice-daily medication signal preserved: ${yesNo(m.scheduleSignals.twiceDailyExpandedOrMentioned)}
- Simvastatin nightly signal preserved: ${yesNo(m.scheduleSignals.nightlySimvastatinMentioned)}
- INR monitoring signal preserved: ${yesNo(m.scheduleSignals.inrMonitoringMentioned)}
- Missing medications: ${m.missingMedications.length ? m.missingMedications.join(', ') : 'none'}
- Missing follow-up items: ${m.missingFollowUps.length ? m.missingFollowUps.join(', ') : 'none'}
- Possible extra medication-like checklist titles: ${
    m.hallucinatedMedicationSignals.length ? m.hallucinatedMedicationSignals.join(', ') : 'none'
  }

### Sample generated checklist events

\`\`\`text
${sampleEvents(result.events) || result.error || 'No events generated.'}
\`\`\`

### Care-plan excerpt

\`\`\`text
${result.carePlan.slice(0, 1800) || result.summary.slice(0, 1800) || result.error || 'No care plan generated.'}
\`\`\`
`;
}

function buildReport(pdfPath: string, pdfParseMs: number, results: WorkflowResult[]): string {
  const aggregates = aggregateResults(results);
  const gemmaAgg = aggregates.find((r) => r.label === 'Gemma 4');
  const referenceAgg = aggregates.find((r) => r.label !== 'Gemma 4');
  const speedLine =
    gemmaAgg && referenceAgg && gemmaAgg.avgTotalMs > 0 && referenceAgg.avgTotalMs > 0
      ? `Across ${Math.max(gemmaAgg.runs, referenceAgg.runs)} run(s), Gemma 4 averaged ${ms(
          Math.round(gemmaAgg.avgTotalMs)
        )} ms; ${referenceAgg.label} averaged ${ms(
          Math.round(referenceAgg.avgTotalMs)
        )} ms. Gemma 4 was ${(referenceAgg.avgTotalMs / gemmaAgg.avgTotalMs).toFixed(2)}x faster on average.`
      : 'At least one model did not complete, so speed comparison is incomplete.';
  const qualityLine =
    gemmaAgg && referenceAgg
      ? `Gemma 4 achieved medication-perfect checklist generation in ${gemmaAgg.medicationPerfectRuns}/${gemmaAgg.runs} runs and full-detail pass in ${gemmaAgg.fullDetailRuns}/${gemmaAgg.runs} runs. ${referenceAgg.label} achieved medication-perfect checklist generation in ${referenceAgg.medicationPerfectRuns}/${referenceAgg.runs} runs and full-detail pass in ${referenceAgg.fullDetailRuns}/${referenceAgg.runs} runs.`
      : 'At least one model did not complete, so quality comparison is incomplete.';
  const costLine =
    gemmaAgg?.avgEstimatedCostUsd != null && referenceAgg?.avgEstimatedCostUsd != null
      ? `Estimated average workflow cost was ${usd(gemmaAgg.avgEstimatedCostUsd)} for Gemma 4 and ${usd(
          referenceAgg.avgEstimatedCostUsd
        )} for ${referenceAgg.label}; Gemma 4 was about ${(referenceAgg.avgEstimatedCostUsd / gemmaAgg.avgEstimatedCostUsd).toFixed(1)}x cheaper using the listed token rates.`
      : 'Cost comparison is incomplete because one model is missing pricing or usage data.';

  return `# Euexia Model Workflow Benchmark

Generated: ${new Date().toISOString()}

## Purpose

This benchmark tests whether Gemma 4 is a strong practical model for Euexia's post-consultation workflow compared with a frontier reference model. The experiment uses the same UH Bristol discharge summary PDF and runs the core agentic workflow:

1. Extract PDF text locally with \`pdf-parse\`.
2. Ask the model to produce a detailed discharge-summary extraction.
3. Run deterministic medication pre-extraction.
4. Ask the model to produce a patient-friendly care plan.
5. Ask the model to generate scheduled checklist events as JSON.
6. Parse and score the checklist for medication recall, follow-up recall, schedule signals, JSON validity, and latency.

## Input

- PDF: \`${pdfPath}\`
- Extracted PDF parse time: ${ms(pdfParseMs)} ms

## Summary

${speedLine}

${qualityLine}

${costLine}

The key interpretation for the Kaggle submission should be conservative: this is not a universal LLM benchmark. It is a task-specific Euexia benchmark for post-consultation care-plan extraction and checklist generation.

## Results Table

${aggregateTable(results)}

## Per-Run Results

${resultTable(results)}

## Notes On Model Selection

- Gemma 4 is the implementation model used by Euexia through Vertex AI Model-as-a-Service.
- Gemini 3 Pro Preview can be used as a high-capability Google reference model when project access permits.
- GPT-5.4 mini can be included as an external frontier-reference model by setting \`OPENAI_API_KEY\` and running with \`--include-openai\`.
- GPT-5.4 mini cost estimate uses OpenAI's public API pricing: $0.75 / 1M input tokens and $4.50 / 1M output tokens.
- Gemma 4 cost estimate uses the public LLMReference listing for Gemma 4 26B A4B on GCP Vertex AI: $0.15 / 1M input tokens and $0.60 / 1M output tokens. Treat this as an estimate unless confirmed in Google Cloud billing.
- If \`gemini-3-pro-preview\` is unavailable in the project, rerun with \`GEMINI_VERTEX_MODEL=gemini-3-flash-preview\` and label the comparison as Gemini 3 Flash rather than Gemini 3 Pro.

${results.map(detailsFor).join('\n')}
`;
}

async function main() {
  const pdfPath = path.resolve(getArg('--pdf', DEFAULT_PDF));
  const reportPath = path.resolve(
    getArg('--report', path.join(process.cwd(), '..', 'Gemma4_vs_Gemini3_Workflow_Benchmark.md'))
  );
  const gemmaModel = normalizeGemmaModelId(
    getArg('--gemma-model', process.env.GOOGLE_VERTEX_MODEL || 'google/gemma-4-26b-a4b-it-maas')
  );
  const geminiModel = normalizeGoogleModelId(
    getArg('--gemini-model', process.env.GEMINI_VERTEX_MODEL || 'gemini-3-pro-preview')
  );
  const includeOpenAI =
    process.argv.includes('--include-openai') ||
    process.env.INCLUDE_OPENAI_BENCHMARK === 'true' ||
    Boolean(process.env.OPENAI_API_KEY);
  const skipGemini = process.argv.includes('--skip-gemini');
  const openAIModel = getArg('--openai-model', process.env.OPENAI_MODEL || 'gpt-5.4-mini');
  const runs = Math.max(1, Number(getArg('--runs', process.env.BENCHMARK_RUNS || '1')));

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  console.log(`Reading PDF: ${pdfPath}`);
  const parsedPdf = await timed(async () => pdfParse(fs.readFileSync(pdfPath)));
  const pdfText = parsedPdf.value.text.trim();
  console.log(`Extracted ${pdfText.length} chars in ${Math.round(parsedPdf.ms)} ms`);

  const configs: ModelConfig[] = [
    {
      label: 'Gemma 4',
      model: gemmaModel,
      provider: 'vertex',
      inputUsdPer1M: Number(process.env.GEMMA_INPUT_USD_PER_1M || 0.15),
      outputUsdPer1M: Number(process.env.GEMMA_OUTPUT_USD_PER_1M || 0.60),
    },
  ];
  if (!skipGemini) {
    configs.push({
      label: geminiModel.includes('flash') ? 'Gemini 3 Flash' : 'Gemini 3 Pro',
      model: geminiModel,
      provider: 'vertex',
      inputUsdPer1M: geminiModel.includes('flash') ? 0.5 : 2,
      outputUsdPer1M: geminiModel.includes('flash') ? 3 : 12,
    });
  }
  if (includeOpenAI) {
    configs.push({
      label: 'GPT-5.4 mini',
      model: openAIModel,
      provider: 'openai',
      inputUsdPer1M: Number(process.env.OPENAI_INPUT_USD_PER_1M || 0.75),
      outputUsdPer1M: Number(process.env.OPENAI_OUTPUT_USD_PER_1M || 4.5),
    });
  }

  const results: WorkflowResult[] = [];
  for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
    for (const config of configs) {
      console.log(`\nRun ${runIndex}/${runs}: ${config.label} (${config.model})...`);
      const result = await runWorkflow(config, pdfText);
      result.runIndex = runIndex;
      results.push(result);
      if (result.ok) {
        console.log(
          `${config.label} run ${runIndex}: ${result.totalMs} ms, meds ${result.metrics.medicationRecall}, follow-ups ${result.metrics.followUpRecall}, events ${result.metrics.eventCount}`
        );
      } else {
        console.log(`${config.label} run ${runIndex} failed: ${result.error}`);
      }
    }
  }

  const report = buildReport(pdfPath, parsedPdf.ms, results);
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\nWrote report: ${reportPath}`);

  const hasFailure = results.some((r) => !r.ok);
  if (hasFailure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
