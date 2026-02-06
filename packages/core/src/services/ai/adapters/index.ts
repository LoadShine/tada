/**
 * Provider Adapters Index
 * 
 * Exports all provider adapters and factory function.
 */

export { OpenAIAdapter, OpenRouterAdapter, DeepSeekAdapter, CustomAdapter } from './openai';
export { ClaudeAdapter } from './claude';
export { GeminiAdapter } from './gemini';
export { OllamaAdapter } from './ollama';

import { AIProviderAdapter } from '../types';
import { OpenAIAdapter, OpenRouterAdapter, DeepSeekAdapter, CustomAdapter } from './openai';
import { ClaudeAdapter } from './claude';
import { GeminiAdapter } from './gemini';
import { OllamaAdapter } from './ollama';

// Registry of all adapters
const adapters: Record<string, AIProviderAdapter> = {
    openai: new OpenAIAdapter(),
    openrouter: new OpenRouterAdapter(),
    deepseek: new DeepSeekAdapter(),
    claude: new ClaudeAdapter(),
    gemini: new GeminiAdapter(),
    ollama: new OllamaAdapter(),
    custom: new CustomAdapter(),
};

// Add aliases for common providers that use OpenAI-compatible API
const openAICompatibleProviders = [
    'groq', 'together', 'perplexity', 'mistral', 'cohere',
    'moonshot', 'qwen', 'zhipu', 'minimax', 'baichuan', 'doubao'
];

openAICompatibleProviders.forEach(id => {
    if (!adapters[id]) {
        const adapter = new OpenAIAdapter();
        adapter.id = id;
        adapters[id] = adapter;
    }
});

/**
 * Gets the adapter for a given provider ID.
 * Falls back to OpenAI adapter for unknown providers.
 */
export function getAdapter(providerId: string): AIProviderAdapter {
    return adapters[providerId] || adapters.openai;
}

/**
 * Registers a new adapter.
 */
export function registerAdapter(adapter: AIProviderAdapter): void {
    adapters[adapter.id] = adapter;
}
