/**
 * Medication Extractor — rule-based (no AI).
 *
 * Scans raw text for medication names using dose patterns and a comprehensive
 * drug-name dictionary. This runs BEFORE the AI summary agent so we know
 * exactly which medications exist in the source and can force the model to
 * include all of them.
 *
 * Why rule-based?  AI models (especially smaller ones) probabilistically
 * drop items from long lists.  A deterministic regex pass catches everything.
 */

export interface ExtractedMedication {
  name: string;           // e.g. "Simvastatin"
  rawMatch: string;       // the full matched fragment, e.g. "Simvastatin 40mg Every night"
}

/* ------------------------------------------------------------------ */
/*  Common drug-name patterns                                          */
/* ------------------------------------------------------------------ */

// These are checked case-insensitively against the raw text.
// Intentionally broad — better to over-detect than miss one.
const KNOWN_DRUG_NAMES = [
  // Cardiovascular
  'bisoprolol', 'ramipril', 'amlodipine', 'lisinopril', 'enalapril',
  'candesartan', 'losartan', 'valsartan', 'atenolol', 'metoprolol',
  'propranolol', 'diltiazem', 'verapamil', 'doxazosin', 'nicorandil',
  'glyceryl trinitrate', 'gtn', 'isosorbide',
  // Statins
  'simvastatin', 'atorvastatin', 'rosuvastatin', 'pravastatin', 'fluvastatin',
  // Anticoagulants
  'warfarin', 'warfarin sodium', 'apixaban', 'rivaroxaban', 'edoxaban',
  'dabigatran', 'heparin', 'enoxaparin', 'dalteparin',
  // Antiplatelet
  'aspirin', 'clopidogrel', 'ticagrelor', 'prasugrel',
  // Diabetes
  'metformin', 'gliclazide', 'glipizide', 'glimepiride', 'pioglitazone',
  'sitagliptin', 'empagliflozin', 'dapagliflozin', 'canagliflozin',
  'liraglutide', 'semaglutide', 'insulin',
  // GI / PPI
  'omeprazole', 'lansoprazole', 'esomeprazole', 'pantoprazole', 'ranitidine',
  // Bone
  'alendronic acid', 'alendronate', 'risedronate', 'adcal-d3', 'adcal',
  'calcium', 'calcichew',
  // Vitamins & supplements
  'folic acid', 'vitamin d', 'vitamin b12', 'ferrous sulfate', 'ferrous fumarate',
  'thiamine', 'colecalciferol',
  // Antibiotics
  'amoxicillin', 'co-amoxiclav', 'flucloxacillin', 'clarithromycin',
  'azithromycin', 'doxycycline', 'metronidazole', 'ciprofloxacin',
  'trimethoprim', 'nitrofurantoin', 'cefalexin',
  // Pain / anti-inflammatory
  'paracetamol', 'ibuprofen', 'naproxen', 'diclofenac', 'codeine',
  'tramadol', 'morphine', 'oxycodone', 'pregabalin', 'gabapentin',
  'amitriptyline',
  // Respiratory
  'salbutamol', 'beclometasone', 'budesonide', 'fluticasone', 'montelukast',
  'tiotropium', 'ipratropium',
  // Thyroid
  'levothyroxine', 'carbimazole',
  // Mental health
  'sertraline', 'fluoxetine', 'citalopram', 'escitalopram', 'mirtazapine',
  'venlafaxine', 'duloxetine', 'paroxetine', 'quetiapine', 'olanzapine',
  'risperidone', 'aripiprazole', 'diazepam', 'lorazepam', 'zopiclone',
  // Other common
  'furosemide', 'spironolactone', 'bendroflumethiazide', 'indapamide',
  'tamsulosin', 'finasteride', 'allopurinol', 'colchicine',
];

/**
 * Dose pattern: number + unit (e.g. "40mg", "2.5 mg", "500 micrograms", "Two tablets")
 */
const DOSE_PATTERN = /\d+(?:\.\d+)?\s*(?:mg|mcg|micrograms?|g|ml|mL|tablets?|capsules?|units?|iu|puffs?|drops?|sachets?|patches?)\b/i;

/**
 * Frequency pattern
 */
const FREQ_PATTERN = /(?:once|twice|three times|four times|\d+ times)\s*(?:daily|a day|per day|weekly|a week)|(?:every|each)\s*(?:\d+\s*(?:hours?|days?)|morning|evening|night|other day)|(?:at night|at bedtime|in the morning|before breakfast|after meals?|with food|on empty stomach)/i;

/* ------------------------------------------------------------------ */
/*  Main extractor                                                     */
/* ------------------------------------------------------------------ */

/**
 * Extract medication names and context from raw text.
 * Returns a deduplicated list of medications found.
 */
export function extractMedicationNames(rawText: string): ExtractedMedication[] {
  if (!rawText || rawText.length < 20) return [];

  const textLower = rawText.toLowerCase();
  const found = new Map<string, ExtractedMedication>(); // keyed by lowercase name

  // Strategy 1: Match known drug names
  for (const drug of KNOWN_DRUG_NAMES) {
    const idx = textLower.indexOf(drug);
    if (idx === -1) continue;

    // Already found (e.g. "gtn" after "glyceryl trinitrate")
    if (found.has(drug)) continue;

    // Grab surrounding context (up to 120 chars after the name)
    const start = idx;
    const end = Math.min(rawText.length, idx + drug.length + 120);
    const rawMatch = rawText.substring(start, end).split('\n')[0].trim(); // first line only

    // Capitalise the drug name nicely
    const name = drug
      .split(/[\s-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(drug.includes('-') ? '-' : ' ');

    found.set(drug, { name, rawMatch });
  }

  // Strategy 2: Find dose patterns and look for preceding capitalised word (catches unlisted drugs)
  const doseRegex = new RegExp(
    `([A-Z][a-zA-Z\\-]{2,})\\s+${DOSE_PATTERN.source}`,
    'gi'
  );
  let match: RegExpExecArray | null;
  while ((match = doseRegex.exec(rawText)) !== null) {
    const candidateName = match[1].toLowerCase();
    // Skip common non-drug words
    if (['take', 'dose', 'total', 'maximum', 'minimum', 'patient', 'doctor', 'continue'].includes(candidateName)) continue;
    if (found.has(candidateName)) continue;

    // Grab context
    const start = match.index;
    const end = Math.min(rawText.length, match.index + match[0].length + 80);
    const rawMatch = rawText.substring(start, end).split('\n')[0].trim();

    // Only include if there's also a frequency pattern nearby (within 200 chars) — confirms it's a medication
    const nearby = rawText.substring(match.index, Math.min(rawText.length, match.index + 200));
    if (FREQ_PATTERN.test(nearby) || DOSE_PATTERN.test(nearby)) {
      found.set(candidateName, {
        name: match[1],
        rawMatch,
      });
    }
  }

  return Array.from(found.values());
}

/**
 * Format extracted medications into a string to inject into AI prompts.
 */
export function formatMedicationList(meds: ExtractedMedication[]): string {
  if (meds.length === 0) return '';
  return meds
    .map((m, i) => `  ${i + 1}. ${m.rawMatch}`)
    .join('\n');
}
