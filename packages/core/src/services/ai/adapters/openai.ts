/**
 * OpenAI-Compatible Provider Adapter
 * 
 * Base adapter for OpenAI and OpenAI-compatible providers.
 * Most providers (OpenRouter, Deepseek, Custom, etc.) can use this adapter.
 */

import { AIModel } from '@/config/aiProviders';
import { AIProviderAdapter, RequestOptions } from '../types';

export class OpenAIAdapter implements AIProviderAdapter {
    id = 'openai';
    name = 'OpenAI';

    protected baseEndpoint = 'https://api.openai.com/v1';

    createPayload(options: RequestOptions): unknown {
        const payload: Record<string, unknown> = {
            model: options.model,
            messages: [
                { role: 'system', content: options.systemPrompt },
                { role: 'user', content: options.userPrompt }
            ],
            temperature: options.temperature ?? 0.5,
            stream: options.stream ?? false
        };

        if (options.useJsonFormat) {
            payload.response_format = { type: 'json_object' };
        }

        if (options.maxTokens) {
            payload.max_tokens = options.maxTokens;
        }

        return payload;
    }

    extractContent(response: unknown): string {
        const data = response as { choices?: { message?: { content?: string } }[] };
        return data.choices?.[0]?.message?.content ?? '';
    }

    extractStreamDelta(chunk: unknown): string | null {
        const data = chunk as { choices?: { delta?: { content?: string } }[] };
        return data.choices?.[0]?.delta?.content ?? null;
    }

    parseModels(data: unknown): AIModel[] {
        const response = data as { data?: { id: string }[] };
        if (!response.data || !Array.isArray(response.data)) {
            return [];
        }
        return response.data.map(model => ({
            id: model.id,
            name: model.id
        }));
    }

    getHeaders(apiKey: string): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
    }

    getChatEndpoint(baseUrl?: string): string {
        return `${baseUrl || this.baseEndpoint}/chat/completions`;
    }

    getModelsEndpoint(baseUrl?: string): string {
        return `${baseUrl || this.baseEndpoint}/models`;
    }
}

/**
 * OpenRouter adapter - uses OpenAI API format but different endpoint
 */
export class OpenRouterAdapter extends OpenAIAdapter {
    id = 'openrouter';
    name = 'OpenRouter';
    protected baseEndpoint = 'https://openrouter.ai/api/v1';
}

/**
 * DeepSeek adapter
 */
export class DeepSeekAdapter extends OpenAIAdapter {
    id = 'deepseek';
    name = 'DeepSeek';
    protected baseEndpoint = 'https://api.deepseek.com';
}

/**
 * Custom/Self-hosted adapter
 */
export class CustomAdapter extends OpenAIAdapter {
    id = 'custom';
    name = 'Custom';
    protected baseEndpoint = '';

    getChatEndpoint(baseUrl?: string): string {
        if (!baseUrl) throw new Error('Base URL is required for custom provider');
        const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        return `${cleanUrl}/chat/completions`;
    }

    getModelsEndpoint(baseUrl?: string): string {
        if (!baseUrl) throw new Error('Base URL is required for custom provider');
        const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        return `${cleanUrl}/models`;
    }
}
