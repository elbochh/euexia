import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} from '@aws-sdk/client-sagemaker-runtime';
import { sagemakerConfig } from '../config/sagemaker';

// The SDK automatically picks up credentials from:
//   1. Environment variables (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
//   2. Shared credentials file (~/.aws/credentials) — set by `aws configure`
//   3. EC2/ECS instance role (when deployed)
// So no explicit keys are needed here — your `aws cli` login is enough.
const client = new SageMakerRuntimeClient({ region: sagemakerConfig.region });

export interface SageMakerResponse {
  text: string;
  raw?: any;
}

/**
 * Invoke MedGemma text model for text-based medical analysis
 */
export async function invokeTextModel(prompt: string): Promise<SageMakerResponse> {
  if (sagemakerConfig.useMock) {
    return mockTextResponse(prompt);
  }

  const command = new InvokeEndpointCommand({
    EndpointName: sagemakerConfig.endpoints.medGemmaText,
    ContentType: 'application/json',
    Body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 2048,
        temperature: 0.3,
        top_p: 0.9,
      },
    }),
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.Body));
  return { text: result[0]?.generated_text || result.generated_text || '', raw: result };
}

/**
 * Invoke MedGemma multimodal model for image + text analysis
 */
export async function invokeImageModel(
  imageBase64: string,
  prompt: string
): Promise<SageMakerResponse> {
  if (sagemakerConfig.useMock) {
    return mockImageResponse(prompt);
  }

  const command = new InvokeEndpointCommand({
    EndpointName: sagemakerConfig.endpoints.medGemmaImage,
    ContentType: 'application/json',
    Body: JSON.stringify({
      inputs: {
        image: imageBase64,
        text: prompt,
      },
      parameters: {
        max_new_tokens: 2048,
        temperature: 0.3,
      },
    }),
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.Body));
  return { text: result[0]?.generated_text || result.generated_text || '', raw: result };
}

/**
 * Invoke MedASR model for voice transcription
 */
export async function invokeAsrModel(audioBase64: string): Promise<SageMakerResponse> {
  if (sagemakerConfig.useMock) {
    return mockAsrResponse();
  }

  const command = new InvokeEndpointCommand({
    EndpointName: sagemakerConfig.endpoints.medAsr,
    ContentType: 'application/json',
    Body: JSON.stringify({
      inputs: audioBase64,
      parameters: {},
    }),
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.Body));
  return { text: result.text || result.transcription || '', raw: result };
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
