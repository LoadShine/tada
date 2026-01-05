import { ProxySettings } from "@/types";

// Type definition for Tauri's fetch options
interface TauriFetchOptions extends RequestInit {
    proxy?: {
        all?: string;
        http?: string;
        https?: string;
        noProxy?: string;
    };
    connectTimeout?: number;
}

/**
 * Checks if the application is running in a Tauri environment.
 */
export const isTauri = (): boolean => {
    // @ts-ignore
    return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
};

/**
 * A wrapper around fetch that automatically selects the appropriate network stack
 * and applies proxy settings if running in the desktop environment.
 *
 * @param input The resource URL.
 * @param init The fetch options.
 * @param proxySettings The user's configured proxy settings.
 */
export const fetchWithProxy = async (
    input: RequestInfo | URL,
    init?: RequestInit,
    proxySettings?: ProxySettings
): Promise<Response> => {
    const urlStr = input.toString();
    const isDesktop = isTauri();

    if (isDesktop) {
        console.log(`[Proxy] Running in Desktop mode. Target: ${urlStr}`);
        try {
            // Dynamically import the Tauri HTTP plugin
            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');

            const tauriOptions: TauriFetchOptions = {
                ...init,
                connectTimeout: 30000,
            };

            if (proxySettings && proxySettings.enabled) {
                const { protocol, host, port, auth, username, password } = proxySettings;
                let proxyUrl = `${protocol}://`;

                if (auth && username && password) {
                    proxyUrl += `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
                }

                proxyUrl += `${host}:${port}`;

                console.log(`[Proxy] Configuring Tauri fetch with proxy: ${proxyUrl}`);

                tauriOptions.proxy = {
                    all: proxyUrl
                };
            } else {
                console.log(`[Proxy] No custom proxy enabled. Using system default.`);
            }

            return await tauriFetch(input, tauriOptions as any);

        } catch (error) {
            console.error('[Proxy] Failed to use Tauri fetch:', error);
            console.warn('[Proxy] Falling back to standard WebView fetch (System Proxy).');
            return fetch(input, init);
        }
    } else {
        // Web Environment
        if (proxySettings && proxySettings.enabled) {
            console.warn('[Proxy] Custom proxy settings are ignored in Web environment.');
        }
        return fetch(input, init);
    }
};