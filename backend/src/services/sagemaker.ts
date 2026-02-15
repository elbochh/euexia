import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} from '@aws-sdk/client-sagemaker-runtime';
import { sagemakerConfig } from '../config/sagemaker';

const sageClient = new SageMakerRuntimeClient({ region: sagemakerConfig.region });
type Provider = 'openai' | 'sagemaker';

function getProvider(mode: 'text' | 'vision' | 'asr' | 'image_generation'): Provider {
  if (mode === 'text') return (process.env.AI_TEXT_PROVIDER as Provider) || 'openai';
  if (mode === 'vision') return (process.env.AI_VISION_PROVIDER as Provider) || 'openai';
  if (mode === 'asr') return (process.env.AI_ASR_PROVIDER as Provider) || 'openai';
  return (process.env.AI_IMAGE_GENERATION_PROVIDER as Provider) || 'openai';
}

export interface SageMakerResponse {
  text: string;
  raw?: any;
}

/**
 * Invoke OpenAI text model for text-based medical analysis.
 * Kept under the same function name to avoid touching all agent files.
 */
export async function invokeTextModel(prompt: string): Promise<SageMakerResponse> {
  if (sagemakerConfig.useMock) {
    return mockTextResponse(prompt);
  }
  const provider = getProvider('text');
  if (provider === 'sagemaker') {
    if (!sagemakerConfig.endpoints.medGemmaText) {
      throw new Error('AI_TEXT_PROVIDER=sagemaker but SAGEMAKER_MEDGEMMA_TEXT_ENDPOINT is missing');
    }
    const command = new InvokeEndpointCommand({
      EndpointName: sagemakerConfig.endpoints.medGemmaText,
      ContentType: 'application/json',
      Body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 2048,
          temperature: 0.2,
        },
      }),
    });
    const response = await sageClient.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Body));
    return { text: result[0]?.generated_text || result.generated_text || '', raw: result };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini';
  if (!apiKey) {
    return mockTextResponse(prompt);
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are a precise medical assistant. Return clear, faithful outputs without fabricating facts.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI text call failed: ${response.status} ${body}`);
  }

  const result: any = await response.json();
  return { text: result?.choices?.[0]?.message?.content || '', raw: result };
}

/**
 * Invoke MedGemma multimodal model for image + text analysis (chest X-rays, medical images)
 */
export async function invokeImageModel(
  imageBase64: string,
  prompt: string
): Promise<SageMakerResponse> {
  if (sagemakerConfig.useMock) {
    return mockImageResponse(prompt);
  }
  const provider = getProvider('vision');
  if (provider === 'sagemaker') {
    if (!sagemakerConfig.endpoints.medGemmaImage) {
      throw new Error('AI_VISION_PROVIDER=sagemaker but SAGEMAKER_MEDGEMMA_IMAGE_ENDPOINT is missing');
    }
    const command = new InvokeEndpointCommand({
      EndpointName: sagemakerConfig.endpoints.medGemmaImage,
      ContentType: 'application/json',
      Body: JSON.stringify({
        inputs: {
          image: imageBase64,
          text: prompt || 'Analyze this medical image and provide findings.',
        },
        parameters: {
          max_new_tokens: 2048,
          temperature: 0.2,
        },
      }),
    });
    const response = await sageClient.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Body));
    return { text: result[0]?.generated_text || result.generated_text || '', raw: result };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini';
  if (!apiKey) {
    return mockImageResponse(prompt);
  }

  const imageUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI vision call failed: ${response.status} ${body}`);
  }

  const result: any = await response.json();
  return { text: result?.choices?.[0]?.message?.content || '', raw: result };
}

/**
 * Voice transcription helper.
 * If real audio bytes are not available, falls back to mock text.
 */
export async function invokeAsrModel(audioBase64: string): Promise<SageMakerResponse> {
  if (sagemakerConfig.useMock) {
    return mockAsrResponse();
  }
  const provider = getProvider('asr');
  if (provider === 'sagemaker') {
    if (!sagemakerConfig.endpoints.medAsr) {
      throw new Error('AI_ASR_PROVIDER=sagemaker but SAGEMAKER_MEDASR_ENDPOINT is missing');
    }
    const command = new InvokeEndpointCommand({
      EndpointName: sagemakerConfig.endpoints.medAsr,
      ContentType: 'application/json',
      Body: JSON.stringify({
        inputs: audioBase64,
        parameters: {
          chunk_length_s: 20,  // MedASR-specific: batch audio in 20-second chunks
          stride_length_s: 2,  // MedASR-specific: 2-second overlap between chunks
        },
      }),
    });
    const response = await sageClient.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Body));
    return { text: result.text || result.transcription || '', raw: result };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return mockAsrResponse();
  }

  try {
    // Best effort: assume input is base64 audio. If not valid, fallback to mock response.
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    if (!audioBuffer.length) {
      return mockAsrResponse();
    }

    const form = new FormData();
    form.append('model', process.env.OPENAI_ASR_MODEL || 'gpt-4o-mini-transcribe');
    form.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI ASR call failed: ${response.status} ${body}`);
    }

    const result: any = await response.json();
    return { text: result?.text || '', raw: result };
  } catch (error) {
    console.warn('ASR fallback used:', error);
    return mockAsrResponse();
  }
}

/**
 * Image generation abstraction to keep a single switch point per mode.
 * Returns either b64 payload or URL based payload.
 */
export async function invokeImageGenerationModel(params: {
  prompt: string;
  previousImageBuffer?: Buffer;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  quality?: 'standard' | 'high' | 'medium' | 'low' | 'auto';
}): Promise<{ b64_json?: string; url?: string; raw?: any }> {
  const provider = getProvider('image_generation');
  if (provider === 'sagemaker') {
    const endpoint = process.env.SAGEMAKER_MAP_IMAGE_GEN_ENDPOINT;
    if (!endpoint) {
      throw new Error('AI_IMAGE_GENERATION_PROVIDER=sagemaker but SAGEMAKER_MAP_IMAGE_GEN_ENDPOINT is missing');
    }
    const command = new InvokeEndpointCommand({
      EndpointName: endpoint,
      ContentType: 'application/json',
      Body: JSON.stringify({
        prompt: params.prompt,
        image_base64: params.previousImageBuffer?.toString('base64') || null,
        size: params.size || '1024x1024',
      }),
    });
    const response = await sageClient.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Body));
    return { b64_json: result?.b64_json, url: result?.url, raw: result };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY missing');
  }
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const size = params.size || '1024x1024';
  const quality = params.quality || (model === 'gpt-image-1' ? 'high' : 'standard');

  if (params.previousImageBuffer && model === 'gpt-image-1') {
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', params.prompt);
    form.append('size', size);
    form.append('quality', quality);
    form.append('n', '1');
    form.append('image', new Blob([new Uint8Array(params.previousImageBuffer)], { type: 'image/png' }), 'previous-map.png');
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI image edit failed: ${response.status} ${body}`);
    }
    const data: any = await response.json();
    return { b64_json: data?.data?.[0]?.b64_json, url: data?.data?.[0]?.url, raw: data };
  }

  const body: any = { model, prompt: params.prompt, n: 1, size };
  if (model === 'gpt-image-1') {
    body.quality = quality;
  } else {
    body.quality = quality === 'high' ? 'standard' : quality;
    body.response_format = 'url';
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI image generation failed: ${response.status} ${err}`);
  }
  const data: any = await response.json();
  return { b64_json: data?.data?.[0]?.b64_json, url: data?.data?.[0]?.url, raw: data };
}

/**
 * Invoke HeAR model for non-speech audio analysis (lung acoustics, etc.)
 */
export async function invokeHearModel(audioBase64: string): Promise<SageMakerResponse> {
  if (sagemakerConfig.useMock) {
    return { text: 'HeAR analysis: Normal lung sounds detected. No abnormalities found.', raw: {} };
  }

  const command = new InvokeEndpointCommand({
    EndpointName: sagemakerConfig.endpoints.hear,
    ContentType: 'application/json',
    Body: JSON.stringify({
      inputs: audioBase64,
    }),
  });

  const response = await sageClient.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.Body));
  return { text: JSON.stringify(result), raw: result };
}

/**
 * Invoke MedSigLIP model for medical image classification/analysis
 */
export async function invokeMedSigLIPModel(imageBase64: string, prompt?: string): Promise<SageMakerResponse> {
  if (sagemakerConfig.useMock) {
    return { text: 'MedSigLIP analysis: Medical image classified. Features extracted successfully.', raw: {} };
  }

  const command = new InvokeEndpointCommand({
    EndpointName: sagemakerConfig.endpoints.medSigLIP,
    ContentType: 'application/json',
    Body: JSON.stringify({
      inputs: {
        image: imageBase64,
        ...(prompt && { text: prompt }),
      },
    }),
  });

  const response = await sageClient.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.Body));
  return { text: JSON.stringify(result), raw: result };
}

// ---- Mock responses for development without SageMaker ----

function mockTextResponse(prompt: string): SageMakerResponse {
  if (prompt.includes('checklist') && prompt.includes('JSON')) {
    return {
      text: JSON.stringify([
        {
          title: 'Take prescribed medication',
          description: 'Take Amoxicillin 500mg three times daily with meals',
          frequency: 'daily',
          category: 'medication',
          xpReward: 15,
          coinReward: 8,
        },
        {
          title: 'Monitor blood pressure',
          description: 'Check and record blood pressure every morning before breakfast',
          frequency: 'daily',
          category: 'monitoring',
          xpReward: 10,
          coinReward: 5,
        },
        {
          title: 'Increase vegetable intake',
          description: 'Include at least 3 servings of vegetables in daily meals',
          frequency: 'daily',
          category: 'nutrition',
          xpReward: 10,
          coinReward: 5,
        },
        {
          title: 'Follow-up appointment',
          description: 'Schedule follow-up visit with Dr. Smith in 2 weeks',
          frequency: 'once',
          category: 'appointment',
          xpReward: 25,
          coinReward: 15,
        },
        {
          title: 'Daily walking exercise',
          description: 'Walk for at least 30 minutes at a moderate pace',
          frequency: 'daily',
          category: 'exercise',
          xpReward: 12,
          coinReward: 6,
        },
        {
          title: 'Stay hydrated',
          description: 'Drink at least 8 glasses of water throughout the day',
          frequency: 'daily',
          category: 'nutrition',
          xpReward: 8,
          coinReward: 4,
        },
        {
          title: 'Get blood work done',
          description: 'Complete CBC and metabolic panel at the lab this week',
          frequency: 'once',
          category: 'test',
          xpReward: 20,
          coinReward: 12,
        },
        {
          title: 'Reduce sodium intake',
          description: 'Limit sodium to less than 2300mg per day, avoid processed foods',
          frequency: 'daily',
          category: 'nutrition',
          xpReward: 10,
          coinReward: 5,
        },
      ]),
    };
  }

  if (prompt.includes('checklist') || prompt.includes('paragraph')) {
    return {
      text: 'Based on your consultation, here is your care plan: Take Amoxicillin 500mg three times daily with meals for the next 10 days. Monitor your blood pressure every morning before breakfast and record the readings. Increase your vegetable intake to at least 3 servings per day and reduce sodium consumption to below 2300mg daily. Walk for at least 30 minutes at a moderate pace each day. Stay well-hydrated by drinking at least 8 glasses of water daily. Get blood work done (CBC and metabolic panel) this week. Schedule a follow-up appointment with Dr. Smith in 2 weeks to review your progress.',
    };
  }

  return {
    text: 'Medical Summary: The patient presented with elevated blood pressure readings (145/92 mmHg) and mild fatigue. The physician prescribed Amoxicillin 500mg for a concurrent mild infection and recommended lifestyle modifications including dietary changes (increased vegetable intake, reduced sodium), regular moderate exercise (30-minute daily walks), and adequate hydration. Blood work was ordered to establish baseline metabolic and hematological values. A follow-up appointment was scheduled in 2 weeks to reassess blood pressure and review lab results.',
  };
}

function mockImageResponse(prompt: string): SageMakerResponse {
  return {
    text: 'Medical Image Analysis: The uploaded medical document shows a standard consultation report. Key findings include: blood pressure reading of 145/92 mmHg (mildly elevated), heart rate 78 bpm (normal), temperature 98.6F (normal). The report indicates a prescription for Amoxicillin 500mg TID for 10 days, along with recommendations for lifestyle modifications including dietary changes and exercise. Lab orders include CBC and comprehensive metabolic panel.',
  };
}

function mockAsrResponse(): SageMakerResponse {
  return {
    text: 'The doctor said I should take my Amoxicillin three times a day with food. My blood pressure was a bit high at 145 over 92, so I need to watch my salt intake and eat more vegetables. I should walk for 30 minutes every day and drink plenty of water. I need to get blood work done this week and come back in two weeks for a follow-up to check how everything is going.',
  };
}
