import {AISettings, StoredSummary, Task, EchoReport} from '@/types';
import storageManager from './storageManager.ts';
import {AI_PROVIDERS, AIModel, AIProvider} from "@/config/aiProviders";
import {stripBase64Images} from "@/lib/moondown/core/utils/string-utils";

export interface AiTaskAnalysis {
    title: string;
    content?: string;
    subtasks: { dueDate?: string; title: string }[];
    tags: string[];
    priority: number | null;
    dueDate: string | null;
}

/**
 * Validates if the current AI settings are sufficient to make requests.
 * Checks provider existence, API key requirement, and model selection.
 * @param settings The AI settings to validate.
 * @returns true if valid, false otherwise.
 */
export const isAIConfigValid = (settings: AISettings | null | undefined): boolean => {
    if (!settings) return false;
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) return false;
    if (provider.requiresApiKey && !settings.apiKey) return false;
    if (!settings.model) return false;
    return true;
};

/**
 * Constructs the full API endpoint URL based on AI settings.
 * @param settings The current AI settings.
 * @param type The type of endpoint to construct ('chat' or 'models').
 * @returns The complete API URL.
 */
const getApiEndpoint = (settings: AISettings, type: 'chat' | 'models'): string => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) throw new Error(`Provider ${settings.provider} not found.`);

    let endpoint = type === 'chat' ? provider.apiEndpoint : provider.listModelsEndpoint;
    if (!endpoint) throw new Error(`Endpoint type '${type}' not available for ${provider.id}.`);

    if (provider.requiresBaseUrl && settings.baseUrl) {
        const baseUrl = settings.baseUrl.endsWith('/') ? settings.baseUrl.slice(0, -1) : settings.baseUrl;
        if (provider.id === 'ollama' && type === 'models') {
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

/**
 * Generates the appropriate HTTP headers for an API request based on the provider.
 * @param settings The current AI settings.
 * @returns A record of HTTP headers.
 */
const getApiHeaders = (settings: AISettings): Record<string, string> => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) throw new Error(`Provider ${settings.provider} not found.`);
    const baseHeaders = provider.getHeaders(settings.apiKey);
    if (!baseHeaders['Content-Type']) {
        baseHeaders['Content-Type'] = 'application/json';
    }
    return baseHeaders;
};

/**
 * Fetches the list of available models from the configured AI provider's API.
 * @param settings The current AI settings.
 * @returns A promise that resolves to an array of AIModels.
 */
export const fetchProviderModels = async (settings: AISettings): Promise<AIModel[]> => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider || !provider.listModelsEndpoint || !provider.parseModels) {
        throw new Error("This provider does not support dynamic model fetching.");
    }
    if (provider.requiresApiKey && !settings.apiKey) {
        throw new Error("API key is required to fetch models.");
    }

    const endpoint = getApiEndpoint(settings, 'models');
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

/**
 * Tests the connection to the configured AI provider to verify settings.
 * @param settings The current AI settings.
 * @returns A promise that resolves to `true` if the connection is successful, `false` otherwise.
 */
export const testConnection = async (settings: AISettings): Promise<boolean> => {
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider);
    if (!provider) throw new Error(`Provider ${settings.provider} not found.`);

    if (provider.requiresApiKey && !settings.apiKey) {
        throw new Error("API key is required to test connection.");
    }

    try {
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
        case 'gemini':
        case 'openai':
        default:
            return data.choices?.[0]?.message?.content ?? '';
    }
}

/**
 * Sends a natural language prompt to the AI to get a structured task object.
 * @param prompt The user's natural language input for creating a task.
 * @param settings The current AI settings.
 * @param systemPrompt The system prompt guiding the AI's JSON output format.
 * @returns A promise that resolves to an `AiTaskAnalysis` object.
 */
export const analyzeTaskInputWithAI = async (prompt: string, settings: AISettings, systemPrompt: string): Promise<AiTaskAnalysis> => {
    if (!isAIConfigValid(settings)) {
        throw new Error("AI configuration is incomplete or invalid.");
    }
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider)!;

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
        return JSON.parse(cleanedContent) as AiTaskAnalysis;
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
        case 'ollama':
            return data.done ? null : data.message?.content ?? null;
        default: // OpenAI-compatible providers
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

        if (providerId === 'ollama') { // Ollama sends one JSON object per line
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

/**
 * Performs a streaming chat completion, suitable for the editor's AI text continuation feature.
 * @returns A promise that resolves to a ReadableStream of string chunks.
 */
export const streamChatCompletionForEditor = async (
    settings: AISettings, systemPrompt: string, userPrompt: string, signal: AbortSignal
): Promise<ReadableStream<string>> => {
    if (!isAIConfigValid(settings)) {
        throw new Error("AI configuration is incomplete or invalid.");
    }
    const provider = AI_PROVIDERS.find(p => p.id === settings.provider)!;

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

/**
 * Generates an AI summary based on selected tasks and streams the result back.
 * @param taskIds
 * @param futureTaskIds
 * @param periodKey
 * @param listKey
 * @param settings
 * @param systemPrompt
 * @param onDelta Callback function to handle incoming stream chunks.
 * @returns A promise that resolves to the final, completed summary object.
 */
export const generateAiSummary = async (
    taskIds: string[], futureTaskIds: string[], periodKey: string, listKey: string,
    settings: AISettings, systemPrompt: string, onDelta: (chunk: string) => void
): Promise<StoredSummary> => {
    // Basic validation
    if (!isAIConfigValid(settings)) {
        throw new Error("AI configuration is incomplete or invalid.");
    }

    const service = storageManager.get();
    const allTasks = service.fetchTasks();
    const tasksToSummarize = allTasks.filter(t => taskIds.includes(t.id));
    const futureTasks = allTasks.filter(t => futureTaskIds.includes(t.id));

    if (tasksToSummarize.length === 0 && futureTasks.length === 0) {
        throw new Error("No tasks were provided for summary.");
    }

    const tasksString = tasksToSummarize.length > 0
        ? "## Tasks from the summary period:\n" + tasksToSummarize.map(t =>
        `- Task: "${t.title}" (Status: ${t.completed ? 'Completed' : 'Incomplete'}${t.completePercentage ? `, ${t.completePercentage}% done` : ''})\n  Notes: ${stripBase64Images(t.content || 'N/A')}`
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

// --- Echo Report Generation ---

export const generateEchoReport = async (
    jobTypes: string[],
    pastExamples: string,
    settings: AISettings,
    t: (key: string) => string,
    language: string, // 'en' | 'zh-CN'
    style: 'exploration' | 'reflection' | 'balanced' = 'balanced',
    userInput: string = '',
    onDelta: (chunk: string) => void
): Promise<EchoReport> => {
    // Basic validation
    if (!isAIConfigValid(settings)) {
        throw new Error("AI configuration is incomplete or invalid.");
    }

    const service = storageManager.get();
    const allTasks = service.fetchTasks();
    const summaries = service.fetchSummaries();

    // Filter for recent context (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentTasks = allTasks.filter(t => (t.completedAt && t.completedAt > sevenDaysAgo) || (t.updatedAt > sevenDaysAgo));
    const recentSummaries = summaries.slice(0, 3); // Last 3 summaries

    // Construct Context
    const taskContext = recentTasks.map(t => `- ${t.title} (${t.completed ? 'Done' : 'In Progress'})`).join('\n');
    // Strip Base64 from previous summaries to avoid massive context
    const summaryContext = recentSummaries.map(s => stripBase64Images(s.summaryText)).join('\n---\n');

    // Get Job Persona Instructions dynamically from translation files
    const personas = jobTypes.map(job => {
        const key = `echo.prompts.personas.${job}`;
        const localizedPersona = t(key);
        return localizedPersona !== key ? localizedPersona : "";
    }).filter(Boolean).join("\n\n");

    // Map language code to human readable name for the LLM
    const targetLanguage = language === 'zh-CN' ? 'Simplified Chinese' : 'English';

    // Style Instructions (Keeping Logic in English for better LLM adherence)
    let styleInstruction = "";
    if (style === 'exploration') {
        styleInstruction = "Focus heavily (80%) on 'Exploration' (market research, technology scanning, benchmarking, trend analysis). 20% Reflection.";
    } else if (style === 'reflection') {
        styleInstruction = "Focus heavily (80%) on 'Reflection' (process review, methodology auditing, planning, structural optimization). 20% Exploration.";
    } else {
        styleInstruction = "Maintain a 50/50 balance between 'Exploration' (external research) and 'Reflection' (internal planning/review).";
    }

    // User Input Handling Instructions
    const userInputContext = userInput ? `
    CRITICAL: The user has explicitly stated they were doing: "${userInput}".
    
    Your PRIMARY task is to TRANSLATE this activity into high-level, professional, corporate-safe language suitable for the job personas.
    
    Examples of transformation (Mental Model):
    - "Browsing news" -> "Monitoring industry trends and external environment."
    - "Shopping" -> "Analyzing market product positioning and pricing strategies."
    - "Chatting" -> "Cross-departmental alignment and informal information synchronization."
    - "Slacking/Nothing" -> "Deep thinking on long-term strategy and process bottlenecks."
    
    Do NOT mention the raw activity. Use the TRANSLATED value as the core theme of the report.
    ` : "The user has not specified specific activities. Infer plausible high-value 'soft work' (planning, researching, reviewing) based on the Job Personas.";

    const systemPrompt = `You are an expert Ghostwriter for corporate daily reports. Your goal is to generate a **professional, safe, unverifiable, and high-value** daily report.
    
    **Target Audience**: A manager who values proactivity, strategic thinking, and continuous improvement.
    
    **Job Role Context**:
    ${personas}

    **Core Philosophy**:
    - **Safety First**: Never imply idleness. Every minute is accounted for with high-level cognitive work.
    - **Unverifiable**: Avoid specific metrics (e.g., "wrote 500 lines of code") that can be checked. Use abstract progress (e.g., "Optimized module architecture").
    - **Constructive**: Even if nothing was "done", value was "created" through thought and research.
    
    **Report Structure**:
    - Format: Markdown (bullet points, bold highlights).
    - Tone: Professional, Insightful, Forward-looking.
    
    **Specific Instructions**:
    ${styleInstruction}
    ${userInputContext}
    
    **IMPORTANT: Output Language**:
    You MUST generate the final report in **${targetLanguage}**.
    
    **User History Context (Use for flavor/continuity, do not repeat verbatim):**
    ${taskContext ? `Recent Tasks:\n${taskContext}` : ''}
    ${summaryContext ? `Recent Summaries:\n${summaryContext}` : ''}
    ${pastExamples ? `User's Past Approved Style:\n${pastExamples}` : ''}
    
    **Output:**
    Generate ONLY the report content in ${targetLanguage}. No conversational fillers.
    `;

    const stream = await streamChatCompletionForEditor(settings, systemPrompt, "Generate Daily Report", new AbortController().signal);
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

    return service.createEchoReport({
        content: fullText,
        jobTypes,
        style,
        userInput
    });
};