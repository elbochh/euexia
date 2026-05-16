import dotenv from 'dotenv';
dotenv.config();

import { invokeTextModel } from '../services/googleGemma';

async function testCustomPrompt() {
  const prompt = process.argv.slice(2).join(' ');

  if (!prompt) {
    console.log('Usage: npm run test:gemma-custom "Your prompt here"');
    process.exit(1);
  }

  const startTime = Date.now();
  const result = await invokeTextModel(prompt);
  const duration = Date.now() - startTime;

  console.log(result.text);
  console.log(`\nResponse time: ${duration}ms`);
}

testCustomPrompt().catch((error) => {
  console.error(error);
  process.exit(1);
});
