// src/services/apiService.ts
import {
    AppearanceSettings,
    PreferencesSettings,
    StoredSummary,
    Task,
    User
} from '@/types';
import { AuthResponse as ApiAuthResponse, TaskCreate, TaskUpdate, TaskBulkUpdate, TaskBulkDelete, AiTaskSuggestion } from '@/types/api';

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

// --- Data Transformation Helpers ---
const toCamel = (s: string): string => s.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
const toSnake = (s: string): string => s.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const isObject = (o: any): o is { [key: string]: any } => o === Object(o) && !Array.isArray(o) && typeof o !== 'function';

const keysToCamel = (o: any): any => {
    if (isObject(o)) {
        const n: { [key: string]: any } = {};
        Object.keys(o).forEach((k) => {
            n[toCamel(k)] = keysToCamel(o[k]);
        });
        return n;
    } else if (Array.isArray(o)) {
        return o.map(v => keysToCamel(v));
    }
    return o;
};

const keysToSnake = (o: any): any => {
    if (isObject(o)) {
        const n: { [key: string]: any } = {};
        Object.keys(o).forEach((k) => {
            n[toSnake(k)] = keysToSnake(o[k]);
        });
        return n;
    } else if (Array.isArray(o)) {
        return o.map(v => keysToSnake(v));
    }
    return o;
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
        headers: { ...headers, ...options.headers },
    };

    if (options.body) {
        if (options.isFormData) {
            config.body = options.body;
        } else {
            config.body = JSON.stringify(keysToSnake(options.body));
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
        return {} as T; // For DELETE requests with no content
    }

    const data = await response.json();
    return keysToCamel(data) as T;
};

// --- User & Auth ---
export type AuthResponse = ApiAuthResponse;

export const apiSendCode = async (identifier: string, purpose: 'register' | 'login' | 'reset_password'): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
        const response = await apiFetch<{ message: string }>('/users/send-code', {
            method: 'POST',
            body: { identifier, purpose }
        });
        return { success: true, message: response.message };
    } catch (e: any) {
        return { success: false, error: e.message };
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
        return { ...response, success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const apiLogin = async (identifier: string, password: string): Promise<AuthResponse> => {
    try {
        const formData = new URLSearchParams();
        formData.append('username', identifier);
        formData.append('password', password);

        const response = await fetch(`${API_BASE_URL}/users/login/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Login failed');

        const camelData = keysToCamel(data) as AuthResponse;
        if (camelData.success && camelData.token) {
            setAuthToken(camelData.token);
        }
        return camelData;
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const apiLoginWithCode = async (identifier: string, code: string): Promise<AuthResponse> => {
    try {
        const response = await apiFetch<AuthResponse>('/users/login/code', {
            method: 'POST',
            body: { identifier, code }
        });
        if (response.success && response.token) {
            setAuthToken(response.token);
        }
        return { ...response, success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const apiPasswordRecovery = async (identifier: string, code: string, newPassword: string): Promise<{ success: boolean; message: string; error?: string }> => {
    try {
        const response = await apiFetch<{ message: string }>('/users/password-recovery', {
            method: 'POST',
            body: { identifier, code, newPassword }
        });
        return { success: true, ...response };
    } catch (e: any) {
        return { success: false, message: '', error: e.message };
    }
};

export const apiChangePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string; error?: string }> => {
    try {
        const response = await apiFetch<{ message: string }>('/users/me/change-password', {
            method: 'POST',
            body: { currentPassword, newPassword }
        });
        return { success: true, ...response };
    } catch (e: any) {
        return { success: false, message: '', error: e.message };
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
export const apiFetchSettings = async(): Promise<{ appearance: AppearanceSettings, preferences: PreferencesSettings }> => {
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

// --- Tasks, Subtasks, Tags ---
export const apiFetchTasks = (params: { [key: string]: any } = {}): Promise<Task[]> => {
    const query = new URLSearchParams(params).toString();
    let url = '/tasks/'
    if (query) {
        url += `?${query}`
    }

    return apiFetch<Task[]>(url);
};

export const apiCreateTask = (taskData: TaskCreate): Promise<Task> => {
    return apiFetch<Task>('/tasks/', {
        method: 'POST',
        body: taskData,
    });
};

export const apiUpdateTask = (taskId: string, taskData: TaskUpdate): Promise<Task> => {
    return apiFetch<Task>(`/tasks/${taskId}`, {
        method: 'PUT',
        body: taskData,
    });
};

export const apiDeleteTask = (taskId: string): Promise<void> => {
    return apiFetch<void>(`/tasks/${taskId}`, { method: 'DELETE' });
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
export const apiSuggestTask = async (prompt: string): Promise<{ success: boolean; data?: AiTaskSuggestion; error?: string; }> => {
    try {
        const response = await apiFetch<AiTaskSuggestion>(`/ai/suggest-task?prompt=${encodeURIComponent(prompt)}`, {
            method: 'POST',
        });
        return { success: true, data: response };
    } catch (e: any) {
        return { success: false, error: e.message };
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

        addEventListener(type: 'message' | 'error', listener: (event: any) => void) { this._listeners[type].push(listener); },
        close() { controller.abort(); },
    } as any;

    (async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/ai/summary?${queryParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${getAuthToken()}` },
                signal: controller.signal,
            });
            if (!response.ok || !response.body) { throw new Error(`Failed to connect to SSE: ${response.statusText}`); }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const data = line.substring(5).trim();
                        const messageEvent = new MessageEvent('message', { data });
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

export const apiFetchSummaries = (): Promise<StoredSummary[]> => {
    return apiFetch<StoredSummary[]>('/ai/summaries');
};

export const apiDeleteSummary = (summaryId: string): Promise<void> => {
    return apiFetch<void>(`/ai/summaries/${summaryId}`, { method: 'DELETE' });
};