// src/services/aiService.ts
import {AISettings, StoredSummary} from '@/types';
import * as service from './localStorageService';
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
    if (!endpoint) throw new Error(`Endpoint type '${type}' not available for ${provider.name}.`);

    // Handle custom/ollama base URL
    if ((provider.id === 'custom' || provider.id === 'ollama') && settings.baseUrl) {
        const baseUrl = settings.baseUrl.endsWith('/') ? settings.baseUrl.slice(0, -1) : settings.baseUrl;
        endpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${baseUrl}${endpoint}`;
    }

    if (provider.id === 'gemini') {
        return endpoint.replace('{model}', settings.model).replace('{apiKey}', settings.apiKey);
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

export const testConnection = async (settings: AISettings): Promise<boolean> => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) throw new Error(`Provider ${settings.provider} not found.`);

    // For providers that don't require API key (like Ollama)
    if (!provider.requiresApiKey && !settings.apiKey) {
        if (provider.listModelsEndpoint) {
            try {
                const endpoint = getApiEndpoint(settings, 'models');
                const response = await fetch(endpoint, {
                    method: 'GET',
                    headers: getApiHeaders(settings),
                });
                return response.ok;
            } catch (error) {
                return false;
            }
        }
        return true; // Assume connection is OK if no way to test
    }

    if (!settings.apiKey) return false;

    try {
        if (provider.listModelsEndpoint) {
            const models = await fetchProviderModels(settings);
            return models.length > 0;
        }

        // Fallback: try a simple chat completion
        const payload = {
            model: settings.model || 'test',
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 1,
        };

        const response = await fetch(getApiEndpoint(settings, 'chat'), {
            method: 'POST',
            headers: getApiHeaders(settings),
            body: JSON.stringify(payload),
        });

        return response.ok;
    } catch (error) {
        return false;
    }
};

export const fetchProviderModels = async (settings: AISettings): Promise<AIModel[]> => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider || !provider.listModelsEndpoint || !provider.parseModels) {
        throw new Error("This provider does not support dynamic model fetching.");
    }

    // For Ollama, API key is not required
    if (provider.requiresApiKey && !settings.apiKey) {
        throw new Error("API key is required to fetch models.");
    }

    const endpoint = getApiEndpoint(settings, 'models');
    const headers = getApiHeaders(settings);

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
        console.error(`Error fetching models for ${provider.name}:`, error);
        if (error instanceof TypeError) {
            throw new Error("Network error occurred. Please check your connection and CORS settings.");
        }
        throw error;
    }
};

const createOpenAICompatiblePayload = (model: string, systemPrompt: string, userPrompt: string, useJsonFormat: boolean) => ({
    model,
    messages: [
        {role: "system", content: systemPrompt},
        {role: "user", content: userPrompt}
    ],
    ...(useJsonFormat && {response_format: {type: "json_object"}}),
    temperature: 0.5,
});

const extractContentFromResponse = (data: any, providerId: AISettings['provider']): string => {
    switch (providerId) {
        case 'claude':
            return data.content?.[0]?.text ?? '';
        case 'gemini':
            return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        case 'qwen':
            return data.output?.text ?? '';
        case 'ollama':
            return data.message?.content ?? '';
        case 'openai':
        default:
            return data.choices?.[0]?.message?.content ?? '';
    }
}

export const analyzeTaskInputWithAI = async (prompt: string, settings: AISettings): Promise<AiTaskAnalysis> => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) throw new Error(`Provider ${settings.provider} not found.`);

    if (provider.requiresApiKey && !settings.apiKey) {
        throw new Error("API key is not set for the selected provider.");
    }

    const systemPrompt = `You are a helpful assistant that analyzes a user's task input and converts it into a structured JSON object.
The current date is ${new Date().toLocaleDateString()}.
Your output MUST be a valid JSON object with the following schema:
{
  "title": "string (max 60 chars)",
  "content": "string (optional, can be a longer description, in markdown)",
  "subtasks": [ { "title": "string", "dueDate": "string (optional, YYYY-MM-DD format)" } ],
  "tags": [ "string" ],
  "priority": "number (1 for high, 2 for medium, 3 for low, or null for none)",
  "dueDate": "string (optional, YYYY-MM-DD format)"
}
Analyze the user's prompt and extract these details. If a detail is not present, use a reasonable default or omit it (e.g., empty array for subtasks/tags, null for priority/dueDate).
Be concise and accurate. Do not add any extra text outside of the JSON object.`;

    const useJsonFormat = ['openai', 'openrouter', 'deepseek', 'custom'].includes(provider.id);
    const payload = createOpenAICompatiblePayload(settings.model, systemPrompt, prompt, useJsonFormat);

    try {
        const response = await fetch(getApiEndpoint(settings, 'chat'), {
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
        case 'gemini':
            return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        case 'qwen':
            return data.output?.text ?? null;
        case 'ollama':
            return data.message?.content ?? null;
        case 'openai':
        case 'openrouter':
        case 'moonshot':
        case 'deepseek':
        case 'zhipu':
        case 'xai':
        case '302':
        case 'siliconflow':
        case 'custom':
        default:
            return data.choices?.[0]?.delta?.content ?? null;
    }
};

export const generateAiSummary = async (
    taskIds: string[],
    periodKey: string,
    listKey: string,
    settings: AISettings,
    onDelta: (chunk: string) => void,
): Promise<StoredSummary> => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) throw new Error(`Provider ${settings.provider} not found.`);

    if (provider.requiresApiKey && !settings.apiKey) {
        throw new Error("API key is not set for the selected provider.");
    }

    const allTasks = service.fetchTasks();
    const tasksToSummarize = allTasks.filter(t => taskIds.includes(t.id));

    if (tasksToSummarize.length === 0) {
        throw new Error("No tasks were provided for summary.");
    }

    const tasksString = tasksToSummarize.map(t =>
        `- Task: "${t.title}" (Status: ${t.completed ? 'Completed' : 'Incomplete'}${t.completePercentage ? `, ${t.completePercentage}% done` : ''})\n  Notes: ${t.content || 'N/A'}`
    ).join('\n');

    const systemPrompt = `You are an assistant that summarizes a list of tasks.
Analyze the provided tasks and generate a concise summary in Markdown format.
Focus on key achievements, pending items, and potential blockers.
Structure the summary with headings like "### Key Achievements", "### Pending Items", and "### Blockers".
Be insightful and professional. Do not add any extra text or pleasantries outside of the summary itself.`;

    const userPrompt = `Please summarize the following tasks:\n\n${tasksString}`;

    // --- Non-streaming path for Gemini due to its unique API structure ---
    if (provider.id === 'gemini') {
        let payload: any = createOpenAICompatiblePayload(settings.model, systemPrompt, userPrompt, false);
        if (provider.requestBodyTransformer) {
            payload = provider.requestBodyTransformer(payload);
        }
        const response = await fetch(getApiEndpoint(settings, 'chat'), {
            method: 'POST',
            headers: getApiHeaders(settings),
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
        }
        const data = await response.json();
        const summaryText = extractContentFromResponse(data, provider.id);
        onDelta(summaryText); // Send the full text in one go
        return service.createSummary({periodKey, listKey, taskIds, summaryText});
    }

    // --- Streaming path for all other providers ---
    let payload: any = createOpenAICompatiblePayload(settings.model, systemPrompt, userPrompt, false);
    payload.stream = true;

    if (provider.requestBodyTransformer) {
        payload = provider.requestBodyTransformer(payload);
        if (provider.id === 'qwen') {
            payload.parameters.stream = true;
        }
    }

    const response = await fetch(getApiEndpoint(settings, 'chat'), {
        method: 'POST',
        headers: getApiHeaders(settings),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    if (!response.body) {
        throw new Error("Response body is null, streaming not possible.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, {stream: true});
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.substring(6);
                if (dataStr === '[DONE]') break;

                try {
                    const data = JSON.parse(dataStr);
                    const delta = extractDeltaFromStream(data, provider.id);
                    if (delta) {
                        fullText += delta;
                        onDelta(delta);
                    }
                } catch (e) {
                    console.error("Error parsing stream data chunk:", dataStr, e);
                }
            }
        }
    }

    return service.createSummary({
        periodKey,
        listKey,
        taskIds,
        summaryText: fullText,
    });
};