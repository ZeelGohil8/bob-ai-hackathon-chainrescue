/**
 * watsonxService — thin wrapper around IBM watsonx.ai text generation.
 *
 * Uses the official @ibm-cloud/watsonx-ai SDK.
 * Falls back to a stub response when credentials are not set (local dev / CI).
 */

const { WatsonXAI } = require('@ibm-cloud/watsonx-ai');
const logger = require('../utils/logger');

const MODEL_ID = process.env.WATSONX_MODEL_ID || 'ibm/granite-13b-instruct-v2';

let _client = null;

function getClient() {
  if (_client) return _client;

  const apiKey = process.env.WATSONX_API_KEY;
  const serviceUrl = process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com';

  if (!apiKey) {
    logger.warn('WATSONX_API_KEY not set — watsonx.ai calls will use stub responses.');
    return null;
  }

  _client = WatsonXAI.newInstance({ version: '2024-05-31', serviceUrl });
  return _client;
}

/**
 * Generate text from watsonx.ai given a prompt.
 * Returns the generated text string.
 */
async function generateText(prompt, { maxNewTokens = 512, temperature = 0.3 } = {}) {
  const client = getClient();
  const projectId = process.env.WATSONX_PROJECT_ID;

  if (!client || !projectId) {
    // Stub for dev/testing — clearly labelled
    logger.info('watsonxService: returning stub response (no credentials configured).');
    return `[STUB] AI analysis not available — configure WATSONX_API_KEY and WATSONX_PROJECT_ID.\n\nPrompt received:\n${prompt}`;
  }

  const params = {
    input: prompt,
    modelId: MODEL_ID,
    projectId,
    parameters: {
      decoding_method: 'greedy',
      max_new_tokens: maxNewTokens,
      temperature,
      repetition_penalty: 1.1,
    },
  };

  const response = await client.generateText(params);
  const result = response.result?.results?.[0]?.generated_text || '';
  return result.trim();
}

module.exports = { generateText };
