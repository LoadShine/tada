/**
 * Google Gemini Provider Adapter
 */

import { AIModel } from '@/config/aiProviders';
import { AIProviderAdapter, RequestOptions } from '../types';

export class GeminiAdapter implements AIProviderAdapter {
    id = 'gemini';
    name = 'Google Gemini';

    createPayload(options: RequestOptions): unknown {
        const payload: Record<string, unknown> = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `${options.systemPrompt}\n\n${options.userPrompt}` }]
                }
            ],
            generationConfig: {
                temperature: options.temperature ?? 0.5
            }
        };

        if (options.useJsonFormat) {
            (payload.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
        }

        return payload;
    }

    extractContent(response: unknown): string {
        const data = response as {
            candidates?: { content?: { parts?: { text?: string }[] } }[]
        };
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }

    extractStreamDelta(chunk: unknown): string | null {
        // Gemini uses the same format for streaming
        const data = chunk as {
            candidates?: { content?: { parts?: { text?: string }[] } }[]
        };
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    }

    parseModels(data: unknown): AIModel[] {
        const response = data as { models?: { name: string; displayName?: string }[] };
        if (!response.models || !Array.isArray(response.models)) {
            return [];
        }
        return response.models
            .filter(m => m.name.includes('gemini'))
            .map(model => ({
                id: model.name.replace('models/', ''),
                name: model.displayName || model.name.replace('models/', '')
            }));
    }

    getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json'
        };
    }

    getChatEndpoint(baseUrl?: string, apiKey?: string, model?: string): string {
        const modelName = model || 'gemini-pro';
        return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    }

    getModelsEndpoint(baseUrl?: string, apiKey?: string): string {
        return `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    }
}
