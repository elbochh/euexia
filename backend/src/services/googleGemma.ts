import { GoogleAuth } from 'google-auth-library';

const vertexAuth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

export interface ModelResponse {
  text: string;
  raw?: any;
}

export interface TextGenerationOptions {
  max_new_tokens?: number;
  temperature?: number;
  return_full_text?: boolean;
  repetition_penalty?: number;
}

function useMockAgents(): boolean {
  return process.env.USE_MOCK_AGENTS !== 'false';
}

function getVertexEndpoint(): string {
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (!project) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required for Gemma 4 on Vertex AI');
  }

  const location = process.env.GOOGLE_VERTEX_LOCATION || 'global';
  const host = location === 'global'
    ? 'https://aiplatform.googleapis.com'
    : `https://${location}-aiplatform.googleapis.com`;

  return `${host}/v1/projects/${project}/locations/${location}/endpoints/openapi/chat/completions`;
}

async function getVertexAccessToken(): Promise<string> {
  if (process.env.GOOGLE_VERTEX_ACCESS_TOKEN) {
    return process.env.GOOGLE_VERTEX_ACCESS_TOKEN;
  }

  const client = await vertexAuth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!token) {
    throw new Error('Could not obtain Google Cloud access token for Vertex AI');
  }
  return token;
}

async function invokeGemmaChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: any }>,
  options?: TextGenerationOptions
): Promise<ModelResponse> {
  const model = process.env.GOOGLE_VERTEX_MODEL || 'google/gemma-4-26b-a4b-it-maas';
  const token = await getVertexAccessToken();

  const response = await fetch(getVertexEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.max_new_tokens ?? 2048,
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vertex AI Gemma call failed: ${response.status} ${body}`);
  }

  const result: any = await response.json();
  return { text: result?.choices?.[0]?.message?.content || '', raw: result };
}

export async function invokeTextModel(
  prompt: string,
  options?: TextGenerationOptions
): Promise<ModelResponse> {
  if (useMockAgents()) {
    return mockTextResponse(prompt);
  }

  return invokeGemmaChat([
    {
      role: 'system',
      content: 'You are a precise medical assistant. Return clear, faithful outputs without fabricating facts.',
    },
    { role: 'user', content: prompt },
  ], options);
}

export async function invokeImageModel(
  imageBase64: string,
  prompt: string
): Promise<ModelResponse> {
  if (useMockAgents()) {
    return mockImageResponse(prompt);
  }

  const imageUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`;

  return invokeGemmaChat([
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    },
  ]);
}

export async function invokeAsrModel(_audioBase64: string): Promise<ModelResponse> {
  if (useMockAgents()) {
    return mockAsrResponse();
  }

  throw new Error('Voice transcription is disabled. Add Google Speech-to-Text before enabling voice uploads.');
}

function mockTextResponse(prompt: string): ModelResponse {
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
      ]),
    };
  }

  if (prompt.includes('checklist') || prompt.includes('paragraph')) {
    return {
      text: 'Based on your consultation, here is your care plan: Take Amoxicillin 500mg three times daily with meals for the next 10 days. Monitor your blood pressure every morning before breakfast and record the readings. Walk for at least 30 minutes each day and schedule a follow-up appointment in 2 weeks.',
    };
  }

  return {
    text: 'Medical Summary: The patient presented with elevated blood pressure readings and mild fatigue. The physician prescribed Amoxicillin and recommended lifestyle modifications including dietary changes, regular exercise, hydration, blood work, and follow-up.',
  };
}

function mockImageResponse(_prompt: string): ModelResponse {
  return {
    text: 'Medical Image Analysis: The uploaded medical document shows a consultation report with blood pressure, medication instructions, lifestyle recommendations, lab orders, and follow-up guidance.',
  };
}

function mockAsrResponse(): ModelResponse {
  return {
    text: 'The doctor said I should take my medication three times a day with food, watch my salt intake, walk for 30 minutes every day, drink plenty of water, get blood work done this week, and return in two weeks for follow-up.',
  };
}
