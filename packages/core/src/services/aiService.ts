import {AISettings, StoredSummary, Task} from '@/types';
import * as service from './storageService.ts';
import {AI_PROVIDERS, AIModel, AIProvider} from "@/config/aiProviders";

export interface AiTaskAnalysis {
    title: string;
    content?: string;
    subtasks: { dueDate?: string; title: string }[];
    tags: string[];
    priority: number | null;
    dueDate: string | null;
}

const getApiEndpoint = (settings: AISettings, type: 'chat' | 'models'): string => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) throw new Error(`Provider ${settings.provider} not found.`);

    let endpoint = type === 'chat' ? provider.apiEndpoint : provider.listModelsEndpoint;
    if (!endpoint) throw new Error(`Endpoint type '${type}' not available for ${provider.id}.`);

    if (provider.requiresBaseUrl && settings.baseUrl) {
        const baseUrl = settings.baseUrl.endsWith('/') ? settings.baseUrl.slice(0, -1) : settings.baseUrl;
        if (provider.id === 'ollama' && type === 'models') { // Special case for ollama model list
            return `${baseUrl}${endpoint}`;
        }
        return `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    }

    if (endpoint.includes('{apiKey}')) {
        endpoint = endpoint.replace('{apiKey}', settings.apiKey);
    }
    if (endpoint.includes('{model}')) {
        endpoint = endpoint.replace('{model}', settings.model);
    }

    return endpoint;
};

const getApiHeaders = (settings: AISettings): Record<string, string> => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) throw new Error(`Provider ${settings.provider} not found.`);
    const baseHeaders = provider.getHeaders(settings.apiKey);
    if (!baseHeaders['Content-Type']) {
        baseHeaders['Content-Type'] = 'application/json';
    }
    return baseHeaders;
};

export const fetchProviderModels = async (settings: AISettings): Promise<AIModel[]> => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider || !provider.listModelsEndpoint || !provider.parseModels) {
        throw new Error("This provider does not support dynamic model fetching.");
    }
    if (provider.requiresApiKey && !settings.apiKey) {
        throw new Error("API key is required to fetch models.");
    }

    const endpoint = getApiEndpoint(settings, 'models');
    // For Gemini model listing, headers might be different or not needed if key is in URL
    const headers = (provider.id === 'gemini') ? { 'Content-Type': 'application/json' } : provider.getHeaders(settings.apiKey);

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch models (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return provider.parseModels(data);
    } catch (error) {
        console.error(`Error fetching models for ${provider.id}:`, error);
        if (error instanceof TypeError) {
            throw new Error("Network error occurred. This might be a CORS issue or connection problem.");
        }
        throw error;
    }
};

export const testConnection = async (settings: AISettings): Promise<boolean> => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) throw new Error(`Provider ${settings.provider} not found.`);

    if (provider.requiresApiKey && !settings.apiKey) {
        throw new Error("API key is required to test connection.");
    }

    try {
        // For providers that support model listing, use that as a test
        if (provider.listModelsEndpoint) {
            await fetchProviderModels(settings);
            return true;
        }

        // For providers that don't support model listing, try a simple chat request
        let payload: any = {
            model: settings.model,
            messages: [{ role: "user", content: "Hi" }],
            max_tokens: 1,
        };

        // For Ollama with non-OpenAI-compatible body
        if (provider.id === 'ollama' && provider.requestBodyTransformer) {
            payload = provider.requestBodyTransformer(payload);
        }

        const endpoint = provider.id === 'ollama' ? `${getApiEndpoint(settings, 'chat')}/api/chat` : getApiEndpoint(settings, 'chat');

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: getApiHeaders(settings),
            body: JSON.stringify(payload),
        });

        return response.ok;
    } catch (error) {
        console.error('Connection test failed:', error);
        return false;
    }
};

const createOpenAICompatiblePayload = (model: string, systemPrompt: string, userPrompt: string, useJsonFormat: boolean, stream: boolean = false) => ({
    model,
    messages: [
        {role: "system", content: systemPrompt},
        {role: "user", content: userPrompt}
    ],
    ...(useJsonFormat && {response_format: {type: "json_object"}}),
    temperature: 0.5,
    stream,
});

const extractContentFromResponse = (data: any, providerId: AISettings['provider']): string => {
    switch (providerId) {
        case 'claude':
            return data.content?.[0]?.text ?? '';
        case 'qwen':
            return data.output?.text ?? '';
        case 'ollama':
            return data.message?.content ?? '';
        case 'gemini': // Now uses OpenAI compatibility, should be same as default
        case 'openai':
        default:
            return data.choices?.[0]?.message?.content ?? '';
    }
}

export const analyzeTaskInputWithAI = async (prompt: string, settings: AISettings, systemPrompt: string): Promise<AiTaskAnalysis> => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) throw new Error(`Provider ${settings.provider} not found.`);

    if (provider.requiresApiKey && !settings.apiKey) {
        throw new Error("API key is not set for the selected provider.");
    }

    const useJsonFormat = ['openai', 'openrouter', 'deepseek', 'custom'].includes(provider.id);
    let payload: any = createOpenAICompatiblePayload(settings.model, systemPrompt, prompt, useJsonFormat, false);

    if (provider.requestBodyTransformer) {
        payload = provider.requestBodyTransformer(payload);
    }

    const endpoint = provider.id === 'ollama' ? `${getApiEndpoint(settings, 'chat')}/api/chat` : getApiEndpoint(settings, 'chat');

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: getApiHeaders(settings),
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const content = extractContentFromResponse(data, provider.id);

        const cleanedContent = content.replace(/^```json\s*|```\s*$/g, '').trim();

        const analysis = JSON.parse(cleanedContent) as AiTaskAnalysis;
        return analysis;
    } catch (error) {
        console.error("AI Task analysis failed:", error);
        throw error;
    }
};

const extractDeltaFromStream = (data: any, providerId: AISettings['provider']): string | null => {
    switch (providerId) {
        case 'claude':
            if (data.type === 'content_block_delta' && data.delta.type === 'text_delta') {
                return data.delta.text ?? null;
            }
            return null;
        case 'qwen':
            return data.output?.text ?? null;
        case 'ollama': // For streaming, Ollama has a different structure
            return data.done ? null : data.message?.content ?? null;
        case 'gemini': // Now uses OpenAI compatibility, should be same as default
        case 'openai':
        case 'openrouter':
        case 'moonshot':
        case 'deepseek':
        case 'zhipu':
        case 'xai':
        case '302':
        case 'siliconflow':
        case 'groq':
        case 'custom':
        default:
            return data.choices?.[0]?.delta?.content ?? null;
    }
};

async function* streamResponse(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder, providerId: AISettings['provider']) {
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            if (buffer.length > 0) yield buffer;
            break;
        }
        buffer += decoder.decode(value, { stream: true });

        // Ollama sends one JSON object per line
        if (providerId === 'ollama') {
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? ''; // Keep incomplete line in buffer
            for (const line of lines) {
                if (line.trim()) yield line;
            }
        } else {
            // OpenAI-compatible SSE format
            const lines = buffer.split('\n\n');
            buffer = lines.pop() ?? ''; // Keep incomplete message in buffer
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    yield line;
                }
            }
        }
    }
}

export const streamChatCompletionForEditor = async (
    settings: AISettings,
    systemPrompt: string,
    userPrompt: string,
    signal: AbortSignal
): Promise<ReadableStream<string>> => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) throw new Error(`Provider ${settings.provider} not found.`);

    let payload: any = createOpenAICompatiblePayload(settings.model, systemPrompt, userPrompt, false, true);
    if (provider.requestBodyTransformer) {
        payload = provider.requestBodyTransformer(payload);
    }

    const endpoint = provider.id === 'ollama' ? `${getApiEndpoint(settings, 'chat')}/api/chat` : getApiEndpoint(settings, 'chat');

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: getApiHeaders(settings),
        body: JSON.stringify(payload),
        signal,
    });

    if (!response.ok || !response.body) {
        const errorBody = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    return new ReadableStream({
        async start(controller) {
            signal.addEventListener('abort', () => {
                reader.cancel();
                controller.close();
            });

            try {
                for await (const chunk of streamResponse(reader, decoder, provider.id)) {
                    if (chunk.startsWith('data: ')) {
                        const dataStr = chunk.substring(6);
                        if (dataStr === '[DONE]') break;
                        try {
                            const data = JSON.parse(dataStr);
                            const delta = extractDeltaFromStream(data, provider.id);
                            if (delta) controller.enqueue(delta);
                        } catch (e) { /* ignore parse errors on partial chunks */ }
                    } else if (provider.id === 'ollama') { // Ollama's non-SSE streaming
                        try {
                            const data = JSON.parse(chunk);
                            const delta = extractDeltaFromStream(data, provider.id);
                            if (delta) controller.enqueue(delta);
                        } catch (e) { /* ignore parse errors on partial chunks */ }
                    }
                }
            } catch (error) {
                controller.error(error);
            } finally {
                controller.close();
            }
        }
    });
};


export const generateAiSummary = async (
    taskIds: string[],
    futureTaskIds: string[],
    periodKey: string,
    listKey: string,
    settings: AISettings,
    systemPrompt: string,
    onDelta: (chunk: string) => void,
): Promise<StoredSummary> => {
    const allTasks = service.fetchTasks();
    const tasksToSummarize = allTasks.filter(t => taskIds.includes(t.id));
    const futureTasks = allTasks.filter(t => futureTaskIds.includes(t.id));

    if (tasksToSummarize.length === 0 && futureTasks.length === 0) {
        throw new Error("No tasks were provided for summary.");
    }

    const tasksString = tasksToSummarize.length > 0
        ? "## Tasks from the summary period:\n" + tasksToSummarize.map(t =>
        `- Task: "${t.title}" (Status: ${t.completed ? 'Completed' : 'Incomplete'}${t.completePercentage ? `, ${t.completePercentage}% done` : ''})\n  Notes: ${t.content || 'N/A'}`
    ).join('\n')
        : "No tasks were selected for the primary summary period.";

    const futureTasksString = futureTasks.length > 0
        ? "\n\n## Upcoming tasks for future planning context:\n" + futureTasks.map(t =>
        `- Task: "${t.title}" (Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'})`
    ).join('\n')
        : "\n\nNo specific upcoming tasks were provided for context.";

    const userPrompt = `${tasksString}${futureTasksString}`;

    const stream = await streamChatCompletionForEditor(settings, systemPrompt, userPrompt, new AbortController().signal);
    const reader = stream.getReader();
    let fullText = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            fullText += value;
            onDelta(value);
        }
    }

    return service.createSummary({
        periodKey,
        listKey,
        taskIds,
        summaryText: fullText,
    });
};