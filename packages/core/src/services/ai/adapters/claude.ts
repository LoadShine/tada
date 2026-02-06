/**
 * Claude (Anthropic) Provider Adapter
 */

import { AIModel } from '@/config/aiProviders';
import { AIProviderAdapter, RequestOptions } from '../types';

export class ClaudeAdapter implements AIProviderAdapter {
    id = 'claude';
    name = 'Claude (Anthropic)';

    private baseEndpoint = 'https://api.anthropic.com/v1';

    createPayload(options: RequestOptions): unknown {
        return {
            model: options.model,
            system: options.systemPrompt,
            messages: [
                { role: 'user', content: options.userPrompt }
            ],
            max_tokens: options.maxTokens ?? 4096,
            stream: options.stream ?? false
        };
    }

    extractContent(response: unknown): string {
        const data = response as { content?: { type: string; text?: string }[] };
        const textBlock = data.content?.find(block => block.type === 'text');
        return textBlock?.text ?? '';
    }

    extractStreamDelta(chunk: unknown): string | null {
        const data = chunk as { type?: string; delta?: { type?: string; text?: string } };
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
            return data.delta.text ?? null;
        }
        return null;
    }

    parseModels(data: unknown): AIModel[] {
        // Claude doesn't have a models endpoint, return predefined list
        return [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
        ];
    }

    getHeaders(apiKey: string): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        };
    }

    getChatEndpoint(): string {
        return `${this.baseEndpoint}/messages`;
    }

    getModelsEndpoint(): string {
        // Claude doesn't have a models endpoint
        throw new Error('Claude does not support dynamic model fetching');
    }
}
