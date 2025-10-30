// src/config/aiProviders.ts
export interface AIModel {
    id: string;
    name: string;
    description?: string;
}

export interface AIProvider {
    id: 'openai' | 'claude' | 'gemini' | 'xai' | 'openrouter' | 'moonshot' | 'deepseek' | 'qwen' | 'zhipu' | '302' | 'siliconflow' | 'ollama' | 'custom';
    name: string;
    description: string; // 添加描述
    models: AIModel[]; // Default/recommended models
    requiresApiKey: boolean;
    requiresBaseUrl?: boolean;
    apiEndpoint: string;
    getHeaders: (apiKey: string) => Record<string, string>;
    listModelsEndpoint?: string; // Optional endpoint for fetching models
    parseModels?: (data: any) => AIModel[]; // Function to parse the model list response
    requestBodyTransformer?: (body: any) => any; // Optional transformer for non-standard body formats
    icon?: string; // 添加图标
    defaultBaseUrl?: string; // 默认base URL
}

export const AI_PROVIDERS: AIProvider[] = [
    {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT-4, GPT-3.5 and other OpenAI models',
        icon: '🤖',
        requiresApiKey: true,
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        listModelsEndpoint: 'https://api.openai.com/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data
            .filter((m: any) => m.id.includes('gpt'))
            .map((m: any) => ({ id: m.id, name: m.id })),
        models: [
            {id: 'gpt-4o', name: 'GPT-4o'},
            {id: 'gpt-4-turbo', name: 'GPT-4 Turbo'},
            {id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo'},
        ],
    },
    {
        id: 'claude',
        name: 'Anthropic Claude',
        description: 'Claude 3 family models from Anthropic',
        icon: '🧠',
        requiresApiKey: true,
        apiEndpoint: 'https://api.anthropic.com/v1/messages',
        getHeaders: (apiKey) => ({
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        }),
        models: [
            {id: 'claude-3-opus-20240229', name: 'Claude 3 Opus'},
            {id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet'},
            {id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku'},
        ],
    },
    {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Gemini models from Google',
        icon: '✨',
        requiresApiKey: true,
        apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}',
        listModelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}',
        getHeaders: () => ({ 'Content-Type': 'application/json' }),
        parseModels: (data) => data.models
            .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
            .map((m: any) => ({ id: m.name.replace('models/', ''), name: m.displayName })),
        requestBodyTransformer: (body: any) => {
            const contents = body.messages.map((msg: any) => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));
            return {
                contents,
                generationConfig: {
                    temperature: body.temperature,
                    topP: body.top_p,
                    topK: body.top_k,
                    maxOutputTokens: body.max_tokens,
                    stopSequences: body.stop,
                },
            };
        },
        models: [
            {id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro'},
            {id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash'},
        ],
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        description: 'Access multiple AI models through OpenRouter',
        icon: '🌐',
        requiresApiKey: true,
        apiEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
        listModelsEndpoint: 'https://openrouter.ai/api/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.name })),
        models: [
            {id: 'openrouter/auto', name: 'Auto (recommended)'},
            {id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash'},
            {id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku'},
        ]
    },
    {
        id: 'ollama',
        name: 'Ollama',
        description: 'Local AI models via Ollama',
        icon: '🏠',
        requiresApiKey: false,
        requiresBaseUrl: true,
        defaultBaseUrl: 'http://localhost:11434',
        apiEndpoint: '/api/chat',
        listModelsEndpoint: '/api/tags',
        getHeaders: () => ({ 'Content-Type': 'application/json' }),
        parseModels: (data) => data.models?.map((m: any) => ({ id: m.name, name: m.name })) || [],
        models: [
            {id: 'llama2', name: 'Llama 2'},
            {id: 'codellama', name: 'Code Llama'},
            {id: 'mistral', name: 'Mistral'},
        ]
    },
    {
        id: 'moonshot',
        name: 'Moonshot AI',
        description: 'Kimi models from Moonshot AI',
        icon: '🌙',
        requiresApiKey: true,
        apiEndpoint: 'https://api.moonshot.cn/v1/chat/completions',
        listModelsEndpoint: 'https://api.moonshot.cn/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: [
            {id: 'moonshot-v1-8k', name: 'moonshot-v1-8k'},
            {id: 'moonshot-v1-32k', name: 'moonshot-v1-32k'},
            {id: 'moonshot-v1-128k', name: 'moonshot-v1-128k'},
        ]
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        description: 'DeepSeek AI models',
        icon: '🔍',
        requiresApiKey: true,
        apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
        listModelsEndpoint: 'https://api.deepseek.com/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: [
            {id: 'deepseek-chat', name: 'DeepSeek Chat'},
            {id: 'deepseek-coder', name: 'DeepSeek Coder'},
        ]
    },
    {
        id: 'custom',
        name: 'Custom Provider',
        description: 'OpenAI-compatible API endpoint',
        icon: '⚙️',
        requiresApiKey: true,
        requiresBaseUrl: true,
        apiEndpoint: '/v1/chat/completions',
        listModelsEndpoint: '/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data?.map((m: any) => ({ id: m.id, name: m.id })) || [],
        models: []
    }
];