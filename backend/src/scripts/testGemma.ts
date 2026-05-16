import dotenv from 'dotenv';
dotenv.config();

import { invokeTextModel } from '../services/googleGemma';

async function testGemma() {
  console.log('Testing Gemma 4 text model\n');

  const prompts = [
    'What are common symptoms of high blood pressure?',
    `You are a medical AI assistant. Create a detailed medical summary from this consultation:
Patient visited for routine checkup. Blood pressure was 145/92 mmHg.
Prescribed Amoxicillin 500mg three times daily with meals for 10 days.
Recommended increased vegetables, reduced sodium, 30 minutes of daily walking,
hydration, CBC and metabolic panel, and follow-up in 2 weeks.

Medical Summary:`,
    `Based on this medical consultation, create a JSON checklist of tasks.
Return a JSON array of checklist items with title, description, frequency,
category, xpReward, and coinReward. JSON only.`,
  ];

  for (const prompt of prompts) {
    const result = await invokeTextModel(prompt);
    console.log('Prompt:');
    console.log(prompt);
    console.log('\nResponse:');
    console.log(result.text);
    console.log('\n---\n');
  }
}

testGemma().catch((error) => {
  console.error(error);
  process.exit(1);
});
