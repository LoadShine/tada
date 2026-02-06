/**
 * AI Service Module
 * 
 * Unified exports for AI service functionality.
 */

// Types
export type {
    RequestOptions,
    AIProviderAdapter,
    AiTaskAnalysis,
    AiListSuggestion,
    RetryOptions,
    CacheEntry
} from './types';

// Cache
export { aiCache, withCache } from './cache';

// Retry
export { withRetry, createRetryWrapper } from './retry';

// Adapters
export { getAdapter, registerAdapter } from './adapters';
export {
    OpenAIAdapter,
    OpenRouterAdapter,
    DeepSeekAdapter,
    CustomAdapter,
    ClaudeAdapter,
    GeminiAdapter,
    OllamaAdapter
} from './adapters';
