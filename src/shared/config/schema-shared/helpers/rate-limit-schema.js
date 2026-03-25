// -------- Rate Limit Schema --------
export const rateLimitSchema = {
  type: 'object',
  properties: {
    maxRetries: {
      type: 'integer', minimum: 0, maximum: 20, default: 3,
      description: 'Max retry attempts on 503/429 rate limit errors (0 = no retries)'
    },
    baseDelay: {
      type: 'integer', minimum: 0, maximum: 60000, default: 1000,
      description: 'Initial delay in ms before first retry (doubles each retry)'
    },
    minRequestInterval: {
      type: 'integer', minimum: 0, maximum: 10000, default: 0,
      description: 'Minimum ms between POST requests (0 = no throttling)'
    }
  },
  additionalProperties: false
};
