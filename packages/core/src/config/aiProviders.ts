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
        models: [
            {id: 'gpt-4o', name: 'GPT-4o'},
            {id: 'gpt-4-turbo', name: 'GPT-4 Turbo'},
            {id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo'},
        ],
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
        models: [
            {id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet'},
            {id: 'claude-3-opus-20240229', name: 'Claude 3 Opus'},
            {id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku'},
        ],
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
        models: [
            {id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro'},
            {id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash'},
        ],
    },
    {
        id: 'xai',
        nameKey: 'aiProviders.xai',
        requiresApiKey: true,
        apiEndpoint: 'https://api.x.ai/v1/chat/completions',
        listModelsEndpoint: 'https://api.x.ai/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: [
            {id: 'grok-1.5-flash', name: 'Grok 1.5 Flash'},
            {id: 'grok-1.5', name: 'Grok 1.5'},
        ]
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
        models: [
            {id: 'command-r-plus', name: 'Command R+'},
            {id: 'command-r', name: 'Command R'},
            {id: 'command', name: 'Command'},
        ]
    },
    {
        id: 'groq',
        nameKey: 'aiProviders.groq',
        requiresApiKey: true,
        apiEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
        listModelsEndpoint: 'https://api.groq.com/openai/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: [
            {id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B'},
            {id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B'},
            {id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B'},
        ]
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
        models: [
            {id: 'openrouter/auto', name: 'Auto (Recommended)'},
            {id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash'},
            {id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku'},
        ]
    },
    {
        id: 'siliconflow',
        nameKey: 'aiProviders.siliconflow',
        requiresApiKey: true,
        apiEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        listModelsEndpoint: 'https://api.siliconflow.cn/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: [
            {id: 'deepseek-ai/DeepSeek-V2-Chat', name: 'DeepSeek V2'},
            {id: 'Qwen/Qwen2-72B-Instruct', name: 'Qwen2 72B'},
            {id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B'},
        ]
    },
    {
        id: '302',
        nameKey: 'aiProviders.302ai',
        requiresApiKey: true,
        apiEndpoint: 'https://api.302.ai/v1/chat/completions',
        listModelsEndpoint: 'https://api.302.ai/v1/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: [
            {id: 'gpt-4o', name: 'GPT-4o'},
            {id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet'},
            {id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro'},
        ]
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
        models: [
            {id: 'moonshot-v1-8k', name: 'moonshot-v1-8k'},
            {id: 'moonshot-v1-32k', name: 'moonshot-v1-32k'},
            {id: 'moonshot-v1-128k', name: 'moonshot-v1-128k'},
        ]
    },
    {
        id: 'deepseek',
        nameKey: 'aiProviders.deepseek',
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
        id: 'qwen',
        nameKey: 'aiProviders.qwen',
        requiresApiKey: true,
        apiEndpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        models: [
            {id: 'qwen-turbo', name: 'Qwen Turbo'},
            {id: 'qwen-plus', name: 'Qwen Plus'},
            {id: 'qwen-max', name: 'Qwen Max'},
        ]
    },
    {
        id: 'zhipu',
        nameKey: 'aiProviders.zhipu',
        requiresApiKey: true,
        apiEndpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        listModelsEndpoint: 'https://open.bigmodel.cn/api/paas/v4/models',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        parseModels: (data) => data.data.map((m: any) => ({ id: m.id, name: m.id })),
        models: [
            {id: 'glm-4-flash', name: 'GLM-4 Flash'},
            {id: 'glm-4', name: 'GLM-4'},
            {id: 'glm-4-air', name: 'GLM-4 Air'},
        ]
    },
    {
        id: 'baidu',
        nameKey: 'aiProviders.baidu',
        requiresApiKey: true,
        apiEndpoint: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
        getHeaders: (apiKey) => ({ 'Content-Type': 'application/json' }),
        models: [
            {id: 'ernie-4.0-8k', name: 'Wenxin 4.0'},
            {id: 'ernie-3.5-8k', name: 'Wenxin 3.5'},
            {id: 'ernie-speed-8k', name: 'ERNIE Speed'},
        ]
    },
    {
        id: 'tencent',
        nameKey: 'aiProviders.tencent',
        requiresApiKey: true,
        apiEndpoint: 'https://hunyuan.tencentcloudapi.com',
        getHeaders: (apiKey) => ({ 'Content-Type': 'application/json' }),
        models: [
            {id: 'hunyuan-pro', name: 'Hunyuan Pro'},
            {id: 'hunyuan-standard', name: 'Hunyuan Standard'},
            {id: 'hunyuan-lite', name: 'Hunyuan Lite'},
        ]
    },
    {
        id: 'bytedance',
        nameKey: 'aiProviders.bytedance',
        requiresApiKey: true,
        apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        models: [
            {id: 'doubao-pro-32k', name: 'Doubao Pro'},
            {id: 'doubao-lite-32k', name: 'Doubao Lite'},
            {id: 'doubao-pro-4k', name: 'Doubao Pro 4K'},
        ]
    },
    {
        id: 'minimax',
        nameKey: 'aiProviders.minimax',
        requiresApiKey: true,
        apiEndpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
        getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        models: [
            {id: 'abab6.5s-chat', name: 'abab6.5s'},
            {id: 'abab6.5-chat', name: 'abab6.5'},
            {id: 'abab5.5-chat', name: 'abab5.5'},
        ]
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
        models: [
            {id: 'llama3', name: 'Llama 3'},
            {id: 'qwen2', name: 'Qwen 2'},
            {id: 'mistral', name: 'Mistral'},
        ]
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
            {id: 'custom-model', name: 'Custom Model'},
        ]
    }
];