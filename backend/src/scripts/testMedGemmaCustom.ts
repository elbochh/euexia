/**
 * Test MedGemma with your own custom prompt
 * 
 * Usage:
 *   npm run test:medgemma-custom "Your prompt here"
 *   Or: npx ts-node src/scripts/testMedGemmaCustom.ts "Your prompt here"
 * 
 * Example:
 *   npm run test:medgemma-custom "What are the side effects of ibuprofen?"
 */

import dotenv from 'dotenv';
dotenv.config();

import { invokeTextModel } from '../services/sagemaker';

async function testCustomPrompt() {
  // Get prompt from command line arguments
  const prompt = process.argv.slice(2).join(' ');

  if (!prompt) {
    console.log('❌ Please provide a prompt as an argument');
    console.log('\nUsage:');
    console.log('  npm run test:medgemma-custom "Your prompt here"');
    console.log('  Or: npx ts-node src/scripts/testMedGemmaCustom.ts "Your prompt here"');
    console.log('\nExample:');
    console.log('  npm run test:medgemma-custom "What are the side effects of ibuprofen?"');
    process.exit(1);
  }

  console.log('🧪 Testing MedGemma with your custom prompt...\n');
  console.log('📝 Your prompt:');
  console.log(`"${prompt}"\n`);
  console.log('⏳ Calling MedGemma endpoint...\n');
  console.log('─'.repeat(60));
  console.log('');

  try {
    const startTime = Date.now();
    const result = await invokeTextModel(prompt);
    const duration = Date.now() - startTime;

    console.log('✅ Response from MedGemma:');
    console.log('');
    console.log(result.text);
    console.log('');
    console.log('─'.repeat(60));
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log('✅ Success!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('Full error details:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testCustomPrompt().catch(console.error);
