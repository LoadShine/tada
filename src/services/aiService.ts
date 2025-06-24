// src/services/aiService.ts
import { Task } from '@/types';
import { apiStreamSummary, apiSuggestTask } from './apiService';
import { AiTaskSuggestion } from "@/types/api";

// This type now directly reflects the structure returned by the AI suggestion endpoint
export type AiTaskAnalysis = AiTaskSuggestion['suggestion'];

// Updated to call the real API for suggesting a task from a prompt
export const analyzeTaskInputWithAI = async (prompt: string): Promise<AiTaskAnalysis> => {
    const response = await apiSuggestTask(prompt);
    if (response.success && response.data) {
        return response.data.suggestion;
    }
    throw new Error(response.error || 'Failed to analyze task with AI');
};

// Updated to call the real API for streaming a summary
export const streamAiGeneratedSummary = (
    taskIds: string[],
    periodKey: string,
    listKey: string
): EventSource => {
    return apiStreamSummary(taskIds, periodKey, listKey);
};