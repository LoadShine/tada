/**
 * LRU Cache for AI Responses
 * 
 * Caches AI responses to avoid redundant API calls for identical inputs.
 */

import { CacheEntry } from './types';

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

class AIResponseCache {
    private cache = new Map<string, CacheEntry<unknown>>();
    private ttl: number;

    constructor(ttl: number = DEFAULT_TTL) {
        this.ttl = ttl;
    }

    /**
     * Generates a cache key from the request parameters.
     */
    generateKey(prompt: string, model: string, systemPrompt?: string): string {
        const data = `${model}::${systemPrompt || ''}::${prompt}`;
        // Simple hash function for cache key
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `ai_cache_${hash}`;
    }

    /**
     * Gets a cached value if it exists and hasn't expired.
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.result as T;
    }

    /**
     * Sets a value in the cache.
     */
    set<T>(key: string, value: T): void {
        // Evict oldest entries if cache is full
        if (this.cache.size >= MAX_CACHE_SIZE) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(key, {
            result: value,
            timestamp: Date.now()
        });
    }

    /**
     * Clears all cached entries.
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Returns the number of cached entries.
     */
    get size(): number {
        return this.cache.size;
    }
}

// Singleton instance
export const aiCache = new AIResponseCache();

/**
 * Wrapper function to cache AI responses.
 */
export async function withCache<T>(
    key: string,
    fn: () => Promise<T>,
    options?: { skipCache?: boolean }
): Promise<T> {
    if (!options?.skipCache) {
        const cached = aiCache.get<T>(key);
        if (cached !== null) {
            console.log('[AI Cache] Hit:', key);
            return cached;
        }
    }

    const result = await fn();
    aiCache.set(key, result);
    console.log('[AI Cache] Miss, cached:', key);
    return result;
}
