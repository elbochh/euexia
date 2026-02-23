/**
 * Test script for UH Bristol Discharge Summary
 * 
 * This script tests the checklist generation pipeline with the sample
 * discharge summary to verify all 10 medications are extracted.
 * 
 * Run with: npx ts-node src/scripts/testDischargeSummary.ts
 */

import { processPdf } from '../services/agents/pdfAgent';
import { aggregateSummaries } from '../services/agents/summaryAgent';
import { structureChecklistAsEvents, validateChecklistCompleteness } from '../services/agents/checklistAgent';

// Sample discharge summary text (extracted from PDF)
const DISCHARGE_SUMMARY_TEXT = `
University Hospitals Bristol NHS Foundation Trust

LEX LUTHER
UHBristol NHS | NHS number: | Hospital Number: RA70006014
Discharge Summary

Patient Identification
LEX LUTHER
10 HOLMES HILL ROAD
BRISTOL BS5 7HH

Appointment Date: 08/10/2009 08:00
Sex: Male
Date Of Birth / Age: 05/06/1974, 35 Years
NHS number: RA70006014

Presenting Symptoms
Admitted with dyspnoea and chest pain 19/01/09. In pulmonary oedema- Episode of Melaena during admission

Diagnosis relating to this admission - Left Ventricular Failure
Secondary diagnosis and co-morbidity - Anaemia (Iron deficient)

Examinations/Investigations/Results/Histology - CT Colonography performed

Procedures/Operations /Complications
OGD showed iron stained stool only. This showed diverticular disease. Unable to perform colonoscopy due to increased SOB

Details of medical/surgical management
Started on Bipap Isoket and Frusemide with improvement. Troponin negative

Rationale for significant changes in treatment - No Change

Consultant on admission - Dr Long
Consultant on Discharge - Dr Short
Consultant for follow-up - Dr Wide & Dr Deep

Action for Primary care team e.g. GP,Practice Nurse
Repeat FBC every two weeks. Contact Dr Deep if the Hb falls below 8.00

Details of other agencies involved e.g. Social services, Occupational Therapy
Occupational and Physiotherapy referral

Provision of equipment e.g. wheelchair - Home Oxygen

General advice given to the patient/family
Patient and family seen by the community team
Patient aware of their condition - Yes

Outstanding Hospital Investigations - Colonoscopy to be arranged

Hospital Outpatient Follow up
6 weeks with Dr Wide and 8 weeks with Dr Deep

Hospital Inpatient follow up / planned procedures - Queen Days Unit to be arranged

Infection status
MRSA negative
CD difficile Negative

Allergies and Sensitivities - None Known

Medicines reconciliation: Document all medication changed, started or stopped with rationale
Folic acid to be increased to raise the iron level

TTO completed by (Bleep and Contact number) - Dr Nutt Bleep 3456
Discharge summary completed by - Dr Nutt

Instructions to dispense
Please can you print all instructions in large font as the patient is partially blind

TTOs

TTO Drug | Dose | Frequency | Route | Duration | GP Action | Source | Signatory | Amended
Bisoprolol | 2.5mg | Once daily | Orally | 2 weeks | Please review | Pharmacy to dispense | harveyn
Alendronic Acid | 70mg | Once daily | Orally | 2 weeks | Please review | Pharmacy to dispense | harveyn
Adcal-D3 | Two tablets | Twice daily | Orally | 2 weeks | Stop after course is finished | Medication on Ward | harveyn
Omeprazole | 40mg | Once daily | Orally | 2 weeks | Please review | At Home | harveyn
Glyceryl Trinitrate 400 micrograms per dose Spray | Two doses | When required | Sublingual | Two weeks | Please review | Medication on Ward | harveyn
Warfarin Sodium | as per INR | Once daily | Orally | two weeks | Check INR | Medication on Ward | harveyn
Folic Acid | 5mg | Twice daily | Orally | Two weeks | Please review | Pharmacy to dispense | harveyn
Ramipril | 7.5mg | Once daily | Orally | Two weeks | Please review | Pre-pack from Ward | harveyn
Simvastatin | 40mg | Every night | Orally | Two weeks | Please review | Medication on Ward | harveyn
Gliclazide m/r | 120mg | Once daily | Orally | Two weeks | Please review | Medication on Ward | harveyn

Checked By: Nick Harvey, 15/10/2009 14:29
`;

// Expected medications from the TTO table
const EXPECTED_MEDICATIONS = [
  'Bisoprolol',
  'Alendronic Acid',
  'Adcal-D3',
  'Omeprazole',
  'Glyceryl Trinitrate',
  'Warfarin',
  'Folic Acid',
  'Ramipril',
  'Simvastatin',
  'Gliclazide',
];

async function testDischargeSummary() {
  console.log('=== Testing UH Bristol Discharge Summary ===\n');
  
  try {
    // Step 1: Process PDF
    console.log('Step 1: Processing PDF text...');
    const pdfSummary = await processPdf(DISCHARGE_SUMMARY_TEXT);
    console.log(`✓ PDF summary length: ${pdfSummary.length} chars\n`);
    console.log('PDF Summary preview:', pdfSummary.substring(0, 500), '...\n');
    
    // Step 2: Aggregate summaries
    console.log('Step 2: Aggregating summaries...');
    const aggregatedSummary = await aggregateSummaries([pdfSummary]);
    console.log(`✓ Aggregated summary length: ${aggregatedSummary.length} chars\n`);
    console.log('Aggregated Summary preview:', aggregatedSummary.substring(0, 800), '...\n');
    
    // Clean paragraph
    const checklistParagraph = aggregatedSummary
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^[\s]*[-•*]\s*/gm, '- ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // Step 3: Generate checklist
    console.log('Step 3: Generating checklist events...');
    const eventData = await structureChecklistAsEvents(checklistParagraph);
    console.log(`✓ Generated ${eventData.length} events\n`);
    
    // Step 4: Validate
    console.log('Step 4: Validating checklist completeness...\n');
    const checklistItemData = eventData.map((e) => ({
      title: e.title,
      description: e.description,
      frequency: 'once',
      category: e.category,
      xpReward: e.xpReward,
      coinReward: e.coinReward,
      unlockAfterHours: 0,
      cooldownHours: 0,
      totalRequired: 1,
      durationDays: 0,
      timeOfDay: 'any',
    }));
    
    const validation = validateChecklistCompleteness(checklistItemData, checklistParagraph);
    
    // Step 5: Report results
    console.log('=== TEST RESULTS ===\n');
    
    const medicationItems = checklistItemData.filter(i => i.category === 'medication');
    console.log(`Total items generated: ${checklistItemData.length}`);
    console.log(`Medication items: ${medicationItems.length}`);
    console.log(`Expected medications: ${EXPECTED_MEDICATIONS.length}\n`);
    
    console.log('Generated medication titles:');
    medicationItems.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.title}`);
    });
    console.log('');
    
    console.log('Expected medications:');
    EXPECTED_MEDICATIONS.forEach((med, i) => {
      console.log(`  ${i + 1}. ${med}`);
    });
    console.log('');
    
    // Check which expected medications were found
    const foundMeds: string[] = [];
    const missingMeds: string[] = [];
    
    EXPECTED_MEDICATIONS.forEach(expected => {
      const found = medicationItems.some(item => 
        item.title.toLowerCase().includes(expected.toLowerCase()) ||
        item.description.toLowerCase().includes(expected.toLowerCase())
      );
      if (found) {
        foundMeds.push(expected);
      } else {
        missingMeds.push(expected);
      }
    });
    
    console.log('=== MEDICATION COVERAGE ===');
    console.log(`✓ Found: ${foundMeds.length}/${EXPECTED_MEDICATIONS.length} medications`);
    foundMeds.forEach(med => console.log(`  ✓ ${med}`));
    
    if (missingMeds.length > 0) {
      console.log(`\n❌ Missing: ${missingMeds.length} medications`);
      missingMeds.forEach(med => console.log(`  ❌ ${med}`));
    }
    
    console.log('\n=== VALIDATION RESULTS ===');
    if (validation.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      validation.warnings.forEach(w => console.log(`   - ${w}`));
    }
    
    if (validation.missing.length > 0) {
      console.log('\n❌ MISSING MEDICATIONS:');
      validation.missing.forEach(m => console.log(`   - ${m}`));
    }
    
    if (validation.suggestions.length > 0) {
      console.log('\n💡 SUGGESTIONS:');
      validation.suggestions.forEach(s => console.log(`   - ${s}`));
    }
    
    // Check for appointments and tests
    const appointmentItems = checklistItemData.filter(i => i.category === 'appointment');
    const testItems = checklistItemData.filter(i => i.category === 'test');
    
    console.log('\n=== OTHER ITEMS ===');
    console.log(`Appointment items: ${appointmentItems.length} (expected: 2 - Dr Wide 6 weeks, Dr Deep 8 weeks)`);
    appointmentItems.forEach(item => console.log(`  - ${item.title}: ${item.description.substring(0, 100)}`));
    
    console.log(`\nTest items: ${testItems.length} (expected: FBC every two weeks, Colonoscopy)`);
    testItems.forEach(item => console.log(`  - ${item.title}: ${item.description.substring(0, 100)}`));
    
    // Final verdict
    console.log('\n=== FINAL VERDICT ===');
    const coverage = (foundMeds.length / EXPECTED_MEDICATIONS.length) * 100;
    console.log(`Medication coverage: ${coverage.toFixed(1)}% (${foundMeds.length}/${EXPECTED_MEDICATIONS.length})`);
    
    if (coverage >= 90) {
      console.log('✅ EXCELLENT: Most medications captured');
    } else if (coverage >= 70) {
      console.log('⚠️  GOOD: Most medications captured, but some missing');
    } else {
      console.log('❌ POOR: Many medications missing - needs improvement');
    }
    
    if (missingMeds.length > 0) {
      console.log(`\n❌ Action required: Fix extraction for: ${missingMeds.join(', ')}`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

// Run test if executed directly
if (require.main === module) {
  testDischargeSummary()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

export { testDischargeSummary };
