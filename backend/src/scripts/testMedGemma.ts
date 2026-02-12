/**
 * Test script for MedGemma text model
 * 
 * Usage:
 * 1. Set environment variables in .env file:
 *    - SAGEMAKER_MEDGEMMA_TEXT_ENDPOINT=medgemma-multimodal-endpoint
 *    - AI_TEXT_PROVIDER=sagemaker
 *    - USE_MOCK_AGENTS=false
 *    - AWS_REGION=us-east-2
 * 
 * 2. Run: npm run test:medgemma
 *    Or: npx ts-node src/scripts/testMedGemma.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { invokeTextModel } from '../services/sagemaker';

async function testMedGemma() {
  console.log('🧪 Testing MedGemma Text Model...\n');

  // Test 1: Simple medical question
  console.log('📝 Test 1: Simple medical question');
  console.log('Prompt: "What are the symptoms of high blood pressure?"\n');
  
  try {
    const result1 = await invokeTextModel('What are the symptoms of high blood pressure?');
    console.log('✅ Response:');
    console.log(result1.text);
    console.log('\n---\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    console.log('\n---\n');
  }

  // Test 2: Medical summary generation
  console.log('📝 Test 2: Medical summary generation');
  const consultationText = `
    Patient visited for routine checkup. Blood pressure was 145/92 mmHg (elevated).
    Prescribed Amoxicillin 500mg three times daily with meals for 10 days.
    Recommended lifestyle changes: increase vegetable intake, reduce sodium,
    walk 30 minutes daily, stay hydrated. Ordered CBC and metabolic panel.
    Follow-up appointment scheduled in 2 weeks.
  `;
  
  const prompt2 = `You are a medical AI assistant. Create a detailed medical summary from this consultation:
${consultationText}

Medical Summary:`;

  console.log('Prompt: Medical summary generation\n');
  
  try {
    const result2 = await invokeTextModel(prompt2);
    console.log('✅ Response:');
    console.log(result2.text);
    console.log('\n---\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    console.log('\n---\n');
  }

  // Test 3: Checklist generation (JSON format)
  console.log('📝 Test 3: Checklist generation (JSON)');
  const prompt3 = `Based on this medical consultation, create a JSON checklist of tasks:
${consultationText}

Return a JSON array of checklist items with: title, description, frequency, category, xpReward, coinReward.
JSON only, no other text:`;

  console.log('Prompt: Checklist generation\n');
  
  try {
    const result3 = await invokeTextModel(prompt3);
    console.log('✅ Response:');
    console.log(result3.text);
    console.log('\n---\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }

  console.log('✅ Testing complete!');
}

// Run the test
testMedGemma().catch(console.error);
