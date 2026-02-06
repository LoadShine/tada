/**
 * AI Service Types
 * 
 * Type definitions for the AI service layer.
 */

import { AIModel } from '@/config/aiProviders';

/**
 * Options for creating an AI request payload.
 */
export interface RequestOptions {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    useJsonFormat?: boolean;
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
}

/**
 * Interface for AI provider adapters.
 * Each provider (OpenAI, Claude, Gemini, etc.) implements this interface.
 */
export interface AIProviderAdapter {
    /** Unique identifier for this provider */
    id: string;

    /** Human-readable name */
    name: string;

    /** Creates the request payload for this provider */
    createPayload(options: RequestOptions): unknown;

    /** Extracts content from a non-streaming response */
    extractContent(response: unknown): string;

    /** Extracts delta from a streaming chunk */
    extractStreamDelta(chunk: unknown): string | null;

    /** Parses available models from the provider's list models response */
    parseModels?(data: unknown): AIModel[];

    /** Returns headers for API requests */
    getHeaders(apiKey: string): Record<string, string>;

    /** Returns the chat completion endpoint */
    getChatEndpoint(baseUrl?: string): string;

    /** Returns the list models endpoint */
    getModelsEndpoint?(baseUrl?: string): string;
}

/**
 * Result of an AI task analysis.
 */
export interface AiTaskAnalysis {
    title: string;
    content?: string;
    subtasks: { dueDate?: string; title: string }[];
    tags: string[];
    priority: number | null;
    dueDate: string | null;
}

/**
 * Result of an AI list suggestion.
 */
export interface AiListSuggestion {
    listName: string;
    confidence: 'high' | 'medium' | 'low';
    reason?: string;
}

/**
 * Options for retry behavior.
 */
export interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    retryOn?: (error: Error) => boolean;
}

/**
 * Cache entry for AI responses.
 */
export interface CacheEntry<T> {
    result: T;
    timestamp: number;
}
