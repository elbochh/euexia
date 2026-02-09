export const sagemakerConfig = {
  region: process.env.AWS_REGION || 'us-east-1',

  // When true, all AI agents return mock responses (no AWS calls)
  useMock: process.env.USE_MOCK_AGENTS !== 'false', // default: true (mock on)

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
