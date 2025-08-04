// src/services/apiService.ts
import {AppearanceSettings, List, PreferencesSettings, StoredSummary, Subtask, Task, User} from '@/types';
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

export const apiCreateList = (listData: ListCreate): Promise<List> => apiFetch<List>('/lists', {
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

export const apiCreateSubtask = async (taskId: string, subtaskData: { title: string }): Promise<Subtask> => {
    // 后端返回的 Subtask DTO 结构与前端的 Subtask 类型基本一致，但日期是字符串
    const apiSubtask = await apiFetch<any>(`/tasks/${taskId}/subtasks`, {
        method: 'POST',
        body: subtaskData,
    });
    // 将后端返回的日期字符串转换为前端需要的时间戳数字
    return {
        ...apiSubtask,
        dueDate: apiSubtask.dueDate ? new Date(apiSubtask.dueDate).getTime() : null,
        completedAt: apiSubtask.completedAt ? new Date(apiSubtask.completedAt).getTime() : null,
        createdAt: apiSubtask.createdAt ? new Date(apiSubtask.createdAt).getTime() : null,
        updatedAt: apiSubtask.updatedAt ? new Date(apiSubtask.updatedAt).getTime() : null,
    } as Subtask;
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

    // This is our custom object that will behave like a native EventSource
    const customEventSource: any = {
        _listeners: {message: [], end: [], error: []},
        onmessage: null,
        onend: null, // Add listener for 'end' event
        onerror: null,

        addEventListener(type: 'message' | 'end' | 'error', listener: (event: any) => void) {
            if (!this._listeners[type]) this._listeners[type] = [];
            this._listeners[type].push(listener);
        },

        // A helper to dispatch events to the correct listeners
        dispatchEvent(event: MessageEvent) {
            const type = event.type as 'message' | 'end' | 'error';
            // Call direct on-handlers (e.g., onmessage)
            if (typeof this[`on${type}`] === 'function') {
                this[`on${type}`](event);
            }
            // Call listeners added via addEventListener
            if (this._listeners[type]) {
                this._listeners[type].forEach((l: any) => l(event));
            }
        },

        close() {
            controller.abort();
        },
    };

    (async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/ai/summary?${queryParams.toString()}`, {
                headers: {'Authorization': `Bearer ${getAuthToken()}`},
                signal: controller.signal,
            });

            if (!response.ok || !response.body) {
                throw new Error(`Failed to connect to SSE: ${response.status} ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            // This loop processes the stream, correctly parsing event blocks
            while (true) {
                const {done, value} = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, {stream: true});
                // SSE events are separated by double newlines
                let boundary = buffer.indexOf('\n\n');

                while (boundary > -1) {
                    const eventBlock = buffer.substring(0, boundary);
                    buffer = buffer.substring(boundary + 2); // Move buffer past the processed event

                    let eventType = 'message'; // Default event type
                    const dataLines: string[] = [];

                    eventBlock.split('\n').forEach(line => {
                        if (line.startsWith('event:')) {
                            eventType = line.substring(6).trim();
                        } else if (line.startsWith('data:')) {
                            dataLines.push(line.substring(5).trim());
                        }
                    });

                    if (dataLines.length > 0) {
                        const data = dataLines.join('\n');
                        const messageEvent = new MessageEvent(eventType, {data});
                        customEventSource.dispatchEvent(messageEvent);
                    }

                    boundary = buffer.indexOf('\n\n');
                }
            }
        } catch (error) {
            if ((error as any).name !== 'AbortError') {
                console.error('SSE Stream Error:', error);
                const errorEvent = new MessageEvent('error', {data: (error as Error).message});
                customEventSource.dispatchEvent(errorEvent);
            }
        }
    })();

    return customEventSource;
};


// Also, ensure your transformSummaryFromApi can handle ISO date strings if they ever come from this endpoint
const transformSummaryFromApi = (apiSummary: any): StoredSummary => {
    // Helper to convert both seconds (number) and ISO date (string) to milliseconds
    const toMs = (timestamp: number | string | null | undefined): number => {
        if (timestamp === null || timestamp === undefined) return 0;
        if (typeof timestamp === 'string') return new Date(timestamp).getTime();
        if (Number.isFinite(timestamp)) return Math.round(timestamp * 1000); // Assuming seconds
        return 0;
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