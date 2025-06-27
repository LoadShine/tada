// src/services/apiService.ts
import {AppearanceSettings, List, PreferencesSettings, StoredSummary, Task, User} from '@/types';
import {
    AiTaskSuggestion,
    AuthResponse as ApiAuthResponse,
    ListCreate,
    ListUpdate,
    TaskBulkDelete,
    TaskBulkUpdate,
    TaskCreate,
    TaskUpdate
} from '@/types/api';

const API_BASE_URL = '/api/v1';

// --- Auth Token Management ---
let authToken: string | null = localStorage.getItem('authToken');

const getAuthToken = (): string | null => {
    if (!authToken) {
        authToken = localStorage.getItem('authToken');
    }
    return authToken;
};

export const setAuthToken = (token: string | null): void => {
    authToken = token;
    if (token) {
        localStorage.setItem('authToken', token);
    } else {
        localStorage.removeItem('authToken');
    }
};


// --- Core API Fetch Utility ---
interface ApiFetchOptions extends RequestInit {
    body?: any;
    isFormData?: boolean;
}

const apiFetch = async <T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = getAuthToken();
    const headers: HeadersInit = options.isFormData ? {} : {'Content-Type': 'application/json'};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        console.log("not auth")
    }

    const config: RequestInit = {
        method: options.method || 'GET',
        headers: {...headers, ...options.headers},
    };

    if (options.body) {
        if (options.isFormData) {
            config.body = options.body;
        } else {
            config.body = JSON.stringify(options.body);
        }
    }

    const response = await fetch(url, config);

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }
        const errorMessage = errorData.error?.detail || errorData.detail || errorData.error || 'An unknown error occurred';
        throw new Error(Array.isArray(errorMessage) ? errorMessage.map(e => e.msg).join(', ') : errorMessage);
    }

    if (response.status === 204) {
        return {} as T;
    }

    const data = await response.json();
    return data as T;
};

// --- User & Auth ---
export type AuthResponse = ApiAuthResponse;

export const apiSendCode = async (identifier: string, purpose: 'register' | 'login' | 'reset_password'): Promise<{
    success: boolean;
    message?: string;
    error?: string
}> => {
    try {
        const response = await apiFetch<{ message: string }>('/users/send-code', {
            method: 'POST',
            body: {identifier, purpose}
        });
        return {success: true, message: response.message};
    } catch (e: any) {
        return {success: false, error: e.message};
    }
};

export const apiRegisterWithCode = async (formData: FormData): Promise<AuthResponse> => {
    try {
        const response = await apiFetch<AuthResponse>('/users/register', {
            method: 'POST',
            body: formData,
            isFormData: true,
        });
        if (response.success && response.token) {
            setAuthToken(response.token);
        }
        return {...response, success: true};
    } catch (e: any) {
        return {success: false, error: e.message};
    }
};

export const apiLogin = async (identifier: string, password: string): Promise<AuthResponse> => {
    try {
        const response = await apiFetch<AuthResponse>(`/users/login/password`, {
            method: 'POST',
            body: {identifier, password}
        });

        if (response.success && response.token) {
            setAuthToken(response.token);
        }
        return {...response, success: true};

    } catch (e: any) {
        return {success: false, error: e.message};
    }
};

export const apiLoginWithCode = async (identifier: string, code: string): Promise<AuthResponse> => {
    try {
        const response = await apiFetch<AuthResponse>('/users/login/code', {
            method: 'POST',
            body: {identifier, code}
        });
        if (response.success && response.token) {
            setAuthToken(response.token);
        }
        return {...response, success: true};
    } catch (e: any) {
        return {success: false, error: e.message};
    }
};

export const apiPasswordRecovery = async (identifier: string, code: string, newPassword: string): Promise<{
    success: boolean;
    message: string;
    error?: string
}> => {
    try {
        const response = await apiFetch<{ message: string }>('/users/password-recovery', {
            method: 'POST',
            body: {identifier, code, newPassword}
        });
        return {success: true, ...response};
    } catch (e: any) {
        return {success: false, message: '', error: e.message};
    }
};

export const apiChangePassword = async (currentPassword: string, newPassword: string): Promise<{
    success: boolean;
    message: string;
    error?: string
}> => {
    try {
        const response = await apiFetch<{ message: string }>('/users/me/change-password', {
            method: 'POST',
            body: {currentPassword, newPassword}
        });
        return {success: true, ...response};
    } catch (e: any) {
        return {success: false, message: '', error: e.message};
    }
};

export const apiFetchCurrentUser = async (): Promise<User> => {
    return apiFetch<User>('/users/me');
};

export const apiLogout = async (): Promise<void> => {
    setAuthToken(null);
    return Promise.resolve();
};

export const apiUpdateUser = (updates: Partial<Omit<User, 'id' | 'isPremium'>>): Promise<User> => {
    return apiFetch<User>('/users/me', {
        method: 'PUT',
        body: updates,
    });
};

export const apiUploadAvatar = (file: File): Promise<User> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<User>('/users/me/avatar', {
        method: 'POST',
        body: formData,
        isFormData: true
    });
};

export const apiDeleteAvatar = (): Promise<User> => {
    return apiFetch<User>('/users/me/avatar', {
        method: 'DELETE'
    });
};

// --- Settings ---
export const apiFetchSettings = async (): Promise<{
    appearance: AppearanceSettings,
    preferences: PreferencesSettings
}> => {
    return apiFetch<{ appearance: AppearanceSettings, preferences: PreferencesSettings }>('/users/me/settings');
};

export const apiUpdateAppearanceSettings = (settings: AppearanceSettings): Promise<AppearanceSettings> => {
    return apiFetch<AppearanceSettings>('/users/me/appearance', {
        method: 'PUT',
        body: settings,
    });
};

export const apiUpdatePreferencesSettings = (settings: PreferencesSettings): Promise<PreferencesSettings> => {
    return apiFetch<PreferencesSettings>('/users/me/preferences', {
        method: 'PUT',
        body: settings,
    });
};

// --- Lists ---
export const apiFetchLists = (): Promise<List[]> => apiFetch<List[]>('/lists');

export const apiCreateList = (listData: ListCreate): Promise<List> => apiFetch<List>('/lists/', {
    method: 'POST',
    body: listData,
});

export const apiUpdateList = (listId: string, listData: ListUpdate): Promise<List> => apiFetch<List>(`/lists/${listId}`, {
    method: 'PUT',
    body: listData,
});

export const apiDeleteList = (listId: string): Promise<{ message: string }> => apiFetch<{
    message: string
}>(`/lists/${listId}`, {method: 'DELETE'});


const transformTaskFromApi = (apiTask: any): Task => {
    const {list, subtasks, ...rest} = apiTask;

    const transformedSubtasks = (subtasks || []).map((sub: any) => ({
        ...sub,
        dueDate: sub.dueDate ? new Date(sub.dueDate).getTime() : null,
        completedAt: sub.completedAt ? new Date(sub.completedAt).getTime() : null,
        createdAt: sub.createdAt ? new Date(sub.createdAt).getTime() : null,
        updatedAt: sub.updatedAt ? new Date(sub.updatedAt).getTime() : null,
    }));

    return {
        ...rest,
        listName: list,
        dueDate: apiTask.dueDate ? new Date(apiTask.dueDate).getTime() : null,
        completedAt: apiTask.completedAt ? new Date(apiTask.completedAt).getTime() : null,
        createdAt: apiTask.createdAt ? new Date(apiTask.createdAt).getTime() : null,
        updatedAt: apiTask.updatedAt ? new Date(apiTask.updatedAt).getTime() : null,
        subtasks: transformedSubtasks,
    } as Task;
};


// --- Tasks, Subtasks, Tags ---
export const apiFetchTasks = async (params: { [key: string]: any } = {}): Promise<Task[]> => {
    const query = new URLSearchParams(params).toString();
    let url = '/tasks'
    if (query) {
        url += `?${query}`
    }
    const apiTasks = await apiFetch<any[]>(url);
    return apiTasks.map(transformTaskFromApi);
};

export const apiCreateTask = async (taskData: TaskCreate): Promise<Task> => {
    const apiTask = await apiFetch<any>('/tasks', {
        method: 'POST',
        body: taskData,
    });
    return transformTaskFromApi(apiTask);
};

export const apiUpdateTask = async (taskId: string, taskData: TaskUpdate): Promise<Task> => {
    const apiTask = await apiFetch<any>(`/tasks/${taskId}`, {
        method: 'PUT',
        body: taskData,
    });
    return transformTaskFromApi(apiTask);
};

export const apiDeleteTask = (taskId: string): Promise<void> => {
    return apiFetch<void>(`/tasks/${taskId}`, {method: 'DELETE'});
};

export const apiBulkUpdateTasks = (updates: TaskBulkUpdate): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>('/tasks/bulk-update', {
        method: 'POST',
        body: updates
    });
};

export const apiBulkDeleteTasks = (deletes: TaskBulkDelete): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>('/tasks/bulk-delete', {
        method: 'POST',
        body: deletes
    });
};

// --- AI Services ---
export const apiSuggestTask = async (prompt: string): Promise<{
    success: boolean;
    data?: AiTaskSuggestion;
    error?: string;
}> => {
    try {
        const response = await apiFetch<AiTaskSuggestion>(`/ai/suggest-task?prompt=${encodeURIComponent(prompt)}`, {
            method: 'POST',
        });
        return {success: true, data: response};
    } catch (e: any) {
        return {success: false, error: e.message};
    }
};

export const apiStreamSummary = (taskIds: string[], periodKey: string, listKey: string): EventSource => {
    const queryParams = new URLSearchParams();
    taskIds.forEach(id => queryParams.append('taskIds', id));
    queryParams.append('periodKey', periodKey);
    queryParams.append('listKey', listKey);

    const controller = new AbortController();
    const customEventSource = {
        _listeners: {
            message: [] as ((event: MessageEvent) => void)[],
            error: [] as ((event: Event) => void)[],
        },
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null as ((event: Event) => void) | null,

        addEventListener(type: 'message' | 'error', listener: (event: any) => void) {
            this._listeners[type].push(listener);
        },
        close() {
            controller.abort();
        },
    } as any;

    (async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/ai/summary?${queryParams.toString()}`, {
                headers: {'Authorization': `Bearer ${getAuthToken()}`},
                signal: controller.signal,
            });
            if (!response.ok || !response.body) {
                throw new Error(`Failed to connect to SSE: ${response.statusText}`);
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const data = line.substring(5).trim();
                        const messageEvent = new MessageEvent('message', {data});
                        if (customEventSource.onmessage) customEventSource.onmessage(messageEvent);
                        customEventSource._listeners.message.forEach((l: any) => l(messageEvent));
                    }
                }
            }
        } catch (error) {
            if ((error as any).name !== 'AbortError') {
                const errorEvent = new Event('error');
                if (customEventSource.onerror) customEventSource.onerror(errorEvent);
                customEventSource._listeners.error.forEach((l: any) => l(errorEvent));
            }
        }
    })();
    return customEventSource;
};

const transformSummaryFromApi = (apiSummary: any): StoredSummary => {
    const toMs = (seconds: number | null | undefined): number => {
        if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
            return 0;
        }
        return Math.round(seconds * 1000);
    };

    return {
        ...apiSummary,
        createdAt: toMs(apiSummary.createdAt),
        updatedAt: toMs(apiSummary.updatedAt),
    } as StoredSummary;
};


export const apiFetchSummaries = async (): Promise<StoredSummary[]> => {
    const apiSummaries = await apiFetch<any[]>('/ai/summaries');
    return apiSummaries.map(transformSummaryFromApi);
};

export const apiDeleteSummary = (summaryId: string): Promise<void> => {
    return apiFetch<void>(`/ai/summaries/${summaryId}`, {method: 'DELETE'});
};