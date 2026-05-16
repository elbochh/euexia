import dotenv from 'dotenv';
dotenv.config();

import { invokeImageModel } from '../services/googleGemma';
import * as fs from 'fs';

async function testGemmaImage() {
  const imagePath = process.argv[2];

  if (!imagePath) {
    console.log('Usage: npm run test:gemma-image <path-to-image>');
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`);
  }

  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  const result = await invokeImageModel(
    imageBase64,
    'Analyze this medical image or document and extract the visible clinical details.'
  );

  console.log(result.text);
}

testGemmaImage().catch((error) => {
  console.error(error);
  process.exit(1);
});
