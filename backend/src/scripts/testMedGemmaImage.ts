/**
 * Test script for MedGemma multimodal (image + text) model
 * 
 * Usage:
 * 1. Set environment variables in .env file:
 *    - SAGEMAKER_MEDGEMMA_IMAGE_ENDPOINT=medgemma-multimodal-endpoint (or same as text)
 *    - AI_VISION_PROVIDER=sagemaker
 *    - USE_MOCK_AGENTS=false
 *    - AWS_REGION=us-east-2
 * 
 * 2. Run: npm run test:medgemma-image <path-to-image>
 *    Or: npx ts-node src/scripts/testMedGemmaImage.ts <path-to-image>
 * 
 * Note: You'll need a base64-encoded image. You can create one with:
 *    node -e "console.log(require('fs').readFileSync('path/to/image.png').toString('base64'))"
 */

import dotenv from 'dotenv';
dotenv.config();

import { invokeImageModel } from '../services/sagemaker';
import * as fs from 'fs';
import * as path from 'path';

async function testMedGemmaImage() {
  console.log('🧪 Testing MedGemma Image Model...\n');

  // Check if image path provided
  const imagePath = process.argv[2];
  
  if (!imagePath) {
    console.log('❌ Please provide an image path as argument');
    console.log('Usage: npm run test:medgemma-image <path-to-image>');
    console.log('   Or: npx ts-node src/scripts/testMedGemmaImage.ts <path-to-image>');
    console.log('\nExample:');
    console.log('  npx tsx src/scripts/testMedGemmaImage.ts ./test-images/chest-xray.png');
    return;
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image not found: ${imagePath}`);
    return;
  }

  // Read and encode image
  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString('base64');
  
  console.log(`📸 Loaded image: ${imagePath} (${imageBuffer.length} bytes)\n`);

  // Test 1: Basic image analysis
  console.log('📝 Test 1: Basic medical image analysis');
  const prompt1 = 'Analyze this medical image and describe any findings, abnormalities, or notable features.';
  
  console.log(`Prompt: "${prompt1}"\n`);
  
  try {
    const result1 = await invokeImageModel(imageBase64, prompt1);
    console.log('✅ Response:');
    console.log(result1.text);
    console.log('\n---\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    console.log('\n---\n');
  }

  // Test 2: Specific medical question
  console.log('📝 Test 2: Specific medical question');
  const prompt2 = 'Is there any evidence of pneumonia, pleural effusion, or other lung abnormalities in this chest X-ray?';
  
  console.log(`Prompt: "${prompt2}"\n`);
  
  try {
    const result2 = await invokeImageModel(imageBase64, prompt2);
    console.log('✅ Response:');
    console.log(result2.text);
    console.log('\n---\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }

  console.log('✅ Testing complete!');
}

// Run the test
testMedGemmaImage().catch(console.error);
