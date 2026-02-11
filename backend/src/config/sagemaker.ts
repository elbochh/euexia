export const sagemakerConfig = {
  region: process.env.AWS_REGION || 'us-east-1',

  // When true, all AI agents return mock responses (no AWS calls)
  useMock: process.env.USE_MOCK_AGENTS !== 'false', // default: true (mock on)

  // Provider switches (mode-by-mode). Defaults are handled in service layer.
  // Set to either "openai" or "sagemaker":
  // - AI_TEXT_PROVIDER
  // - AI_VISION_PROVIDER
  // - AI_ASR_PROVIDER
  // - AI_IMAGE_GENERATION_PROVIDER
  //
  // Related model env vars for OpenAI path:
  // - OPENAI_TEXT_MODEL (default: gpt-4.1-mini)
  // - OPENAI_VISION_MODEL (default: gpt-4.1-mini)
  // - OPENAI_ASR_MODEL
  // - OPENAI_IMAGE_MODEL (default: gpt-image-1)
  //
  // Related endpoint env vars for SageMaker path:
  // - SAGEMAKER_MEDGEMMA_TEXT_ENDPOINT
  // - SAGEMAKER_MEDGEMMA_IMAGE_ENDPOINT
  // - SAGEMAKER_MEDASR_ENDPOINT
  // - SAGEMAKER_MAP_IMAGE_GEN_ENDPOINT

  // SageMaker inference endpoint URLs
  // Once models are deployed, these are the HTTPS invoke URLs for each endpoint.
  // Format: https://runtime.sagemaker.<region>.amazonaws.com/endpoints/<endpoint-name>/invocations
  // Or if using SageMaker endpoint names, the SDK resolves them automatically.
  endpoints: {
    medAsr: process.env.SAGEMAKER_MEDASR_ENDPOINT || '',
    medGemmaText: process.env.SAGEMAKER_MEDGEMMA_TEXT_ENDPOINT || '',
    medGemmaImage: process.env.SAGEMAKER_MEDGEMMA_IMAGE_ENDPOINT || '',
  },
};
