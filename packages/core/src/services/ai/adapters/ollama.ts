/**
 * Ollama (Local) Provider Adapter
 */

import { AIModel } from '@/config/aiProviders';
import { AIProviderAdapter, RequestOptions } from '../types';

export class OllamaAdapter implements AIProviderAdapter {
    id = 'ollama';
    name = 'Ollama (Local)';

    private defaultBaseUrl = 'http://localhost:11434';

    createPayload(options: RequestOptions): unknown {
        return {
            model: options.model,
            messages: [
                { role: 'system', content: options.systemPrompt },
                { role: 'user', content: options.userPrompt }
            ],
            stream: options.stream ?? false,
            options: {
                temperature: options.temperature ?? 0.5
            }
        };
    }

    extractContent(response: unknown): string {
        const data = response as { message?: { content?: string } };
        return data.message?.content ?? '';
    }

    extractStreamDelta(chunk: unknown): string | null {
        const data = chunk as { done?: boolean; message?: { content?: string } };
        if (data.done) return null;
        return data.message?.content ?? null;
    }

    parseModels(data: unknown): AIModel[] {
        const response = data as { models?: { name: string }[] };
        if (!response.models || !Array.isArray(response.models)) {
            return [];
        }
        return response.models.map(model => ({
            id: model.name,
            name: model.name
        }));
    }

    getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json'
        };
    }

    getChatEndpoint(baseUrl?: string): string {
        const url = baseUrl || this.defaultBaseUrl;
        const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        return `${cleanUrl}/api/chat`;
    }

    getModelsEndpoint(baseUrl?: string): string {
        const url = baseUrl || this.defaultBaseUrl;
        const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        return `${cleanUrl}/api/tags`;
    }
}
