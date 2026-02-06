/**
 * Retry Logic with Exponential Backoff
 * 
 * Provides retry functionality for AI API calls with exponential backoff.
 */

import { RetryOptions } from './types';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000; // 1 second
const DEFAULT_MAX_DELAY = 30000; // 30 seconds

/**
 * Determines if an error is retryable.
 */
function isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Retry on rate limits
    if (message.includes('rate limit') || message.includes('429')) {
        return true;
    }

    // Retry on server errors
    if (message.includes('500') || message.includes('502') ||
        message.includes('503') || message.includes('504')) {
        return true;
    }

    // Retry on network errors
    if (message.includes('network') || message.includes('timeout') ||
        message.includes('econnrefused') || message.includes('econnreset')) {
        return true;
    }

    return false;
}

/**
 * Calculates delay with exponential backoff and jitter.
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
    return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Executes a function with retry logic using exponential backoff.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const baseDelay = options?.baseDelay ?? DEFAULT_BASE_DELAY;
    const maxDelay = options?.maxDelay ?? DEFAULT_MAX_DELAY;
    const shouldRetry = options?.retryOn ?? isRetryableError;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Check if we should retry
            if (attempt >= maxRetries || !shouldRetry(lastError)) {
                throw lastError;
            }

            // Calculate delay and wait
            const delay = calculateDelay(attempt, baseDelay, maxDelay);
            console.log(`[AI Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError ?? new Error('Retry failed');
}

/**
 * Creates a retry wrapper with preset options.
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
    return <T>(fn: () => Promise<T>, overrideOptions?: RetryOptions) =>
        withRetry(fn, { ...defaultOptions, ...overrideOptions });
}
