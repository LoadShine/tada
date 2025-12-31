export interface AIModel {
    id: string;
    name: string;
    description?: string;
}

export interface AIProvider {
    id: 'openai' | 'claude' | 'gemini' | 'xai' | 'cohere' | 'replicate' | 'together' | 'groq' | 'perplexity' | 'huggingface' | 'openrouter' | 'oneapi' | 'newapi' | 'moonshot' | 'deepseek' | 'qwen' | 'zhipu' | 'baidu' | 'tencent' | 'bytedance' | 'baichuan' | 'minimax' | 'sensetime' | 'iflytek' | '302' | 'siliconflow' | 'ollama' | 'custom';
    nameKey: string; // Translation key
    models: AIModel[]; // Default/recommended models
    requiresApiKey: boolean;
    requiresBaseUrl?: boolean;
    defaultBaseUrl?: string;
    apiEndpoint: string;
    getHeaders: (apiKey: string) => Record<string, string>;
    listModelsEndpoint?: string;
    parseModels?: (data: any) => AIModel[];
    requestBodyTransformer?: (body: any) => any;
}

/**
 * A configuration array defining supported AI providers.
 * Each object contains metadata and configuration for a specific provider,
 * including API endpoints, authentication requirements, and model parsing logic.
 */
export const AI_PROVIDERS: AIProvider[] = [
    // International Providers
    {
        id: 'openai',
        nameKey: 'aiProviders.openai',
        requiresApiKey: true,
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        listModelsEndpoint: 'https://api.openai.com/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data
            .filter((m: any) => m.id.includes('gpt'))
            .map((m: any) => ({ id: m.id, name: m.id })),
        models: [],
    },
    {
        id: 'claude',
        nameKey: 'aiProviders.claude',
        requiresApiKey: true,
        apiEndpoint: 'https://api.anthropic.com/v1/messages',
        getHeaders: (apiKey) => ({
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        }),
        models: [],
    },
    {
        id: 'gemini',
        nameKey: 'aiProviders.gemini',
        requiresApiKey: true,
        apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        listModelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}',
        getHeaders: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        }),
        parseModels: (data) => data.models
            .filter((m: any) => m.name.includes('gemini') && m.displayName)
            .map((m: any) => ({
                id: m.name.replace('models/', ''),
                name: m.displayName
            })),
        models: [],
    },
    {
        id: 'xai',
        nameKey: 'aiProviders.xai',
        requiresApiKey: true,
        apiEndpoint: 'https://api.x.ai/v1/chat/completions',
        listModelsEndpoint: 'https://api.x.ai/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: []
    },
    {
        id: 'cohere',
        nameKey: 'aiProviders.cohere',
        requiresApiKey: true,
        apiEndpoint: 'https://api.cohere.ai/v1/chat',
        listModelsEndpoint: 'https://api.cohere.ai/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.models
            .filter((m: any) => m.endpoints?.includes('chat'))
            .map((m: any) => ({ id: m.name, name: m.name })),
        models: []
    },
    {
        id: 'groq',
        nameKey: 'aiProviders.groq',
        requiresApiKey: true,
        apiEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
        listModelsEndpoint: 'https://api.groq.com/openai/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: []
    },

    // Aggregator Services
    {
        id: 'openrouter',
        nameKey: 'aiProviders.openrouter',
        requiresApiKey: true,
        apiEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
        listModelsEndpoint: 'https://openrouter.ai/api/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.name })),
        models: []
    },
    {
        id: 'siliconflow',
        nameKey: 'aiProviders.siliconflow',
        requiresApiKey: true,
        apiEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        listModelsEndpoint: 'https://api.siliconflow.cn/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: []
    },
    {
        id: '302',
        nameKey: 'aiProviders.302ai',
        requiresApiKey: true,
        apiEndpoint: 'https://api.302.ai/v1/chat/completions',
        listModelsEndpoint: 'https://api.302.ai/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: []
    },

    // Chinese Providers
    {
        id: 'moonshot',
        nameKey: 'aiProviders.moonshot',
        requiresApiKey: true,
        apiEndpoint: 'https://api.moonshot.cn/v1/chat/completions',
        listModelsEndpoint: 'https://api.moonshot.cn/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: []
    },
    {
        id: 'deepseek',
        nameKey: 'aiProviders.deepseek',
        requiresApiKey: true,
        apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
        listModelsEndpoint: 'https://api.deepseek.com/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: []
    },
    {
        id: 'qwen',
        nameKey: 'aiProviders.qwen',
        requiresApiKey: true,
        apiEndpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        models: []
    },
    {
        id: 'zhipu',
        nameKey: 'aiProviders.zhipu',
        requiresApiKey: true,
        apiEndpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        listModelsEndpoint: 'https://open.bigmodel.cn/api/paas/v4/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: []
    },
    {
        id: 'baidu',
        nameKey: 'aiProviders.baidu',
        requiresApiKey: true,
        apiEndpoint: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
        getHeaders: (apiKey) => ({ 'Content-Type': 'application/json' }),
        models: []
    },
    {
        id: 'tencent',
        nameKey: 'aiProviders.tencent',
        requiresApiKey: true,
        apiEndpoint: 'https://hunyuan.tencentcloudapi.com',
        getHeaders: (apiKey) => ({ 'Content-Type': 'application/json' }),
        models: []
    },
    {
        id: 'bytedance',
        nameKey: 'aiProviders.bytedance',
        requiresApiKey: true,
        apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        models: []
    },
    {
        id: 'minimax',
        nameKey: 'aiProviders.minimax',
        requiresApiKey: true,
        apiEndpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        models: []
    },

    // Local/Self-hosted
    {
        id: 'ollama',
        nameKey: 'aiProviders.ollama',
        requiresApiKey: false,
        requiresBaseUrl: true,
        defaultBaseUrl: 'http://localhost:11434',
        apiEndpoint: '/v1/chat/completions', // Assuming OpenAI compatibility
        listModelsEndpoint: '/api/tags',
        getHeaders: () => ({ 'Content-Type': 'application/json' }),
        parseModels: (data) => data.models.map((m: any) => ({
            id: m.name,
            name: m.name,
            description: `Size: ${m.size ? (m.size / 1e9).toFixed(1) + 'GB' : 'Unknown'}`
        })),
        models: []
    },
    {
        id: 'custom',
        nameKey: 'aiProviders.custom',
        requiresApiKey: true,
        requiresBaseUrl: true,
        apiEndpoint: '/v1/chat/completions',
        listModelsEndpoint: '/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data?.map((m: any) => ({ id: m.id, name: m.id })) || [],
        models: [
            {id: 'custom-model', name: 'Custom Model'}, // Keep custom default
        ]
    }
];