import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import { App } from '@tada/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import storageManager from '@tada/core/services/storageManager';
import { SqliteStorageService } from './services/sqliteStorageService';

import '@tada/core/locales';
import '@tada/core/styles/index.css';

const DesktopAppLauncher = () => {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                const storageService = new SqliteStorageService();
                await storageService.initialize();

                storageManager.register(storageService);

                await storageService.preloadData();

                setIsReady(true);
            } catch (err: any) {
                console.error('Desktop initialization failed:', err);
                setError(err.message || String(err));
            }
        };
        init();
    }, []);

    if (error) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-red-50 text-red-900 p-10 text-center">
                <h1 className="text-2xl font-bold mb-4">Application Failed to Start</h1>
                <p className="mb-4">We encountered an error while initializing the database.</p>
                <pre className="bg-white p-4 rounded border border-red-200 text-left overflow-auto max-w-full">
                    {error}
                </pre>
            </div>
        );
    }

    if (!isReady) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-[#1D2530]">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin mb-4"></div>
                    <span className="text-gray-500">Loading Tada...</span>
                </div>
            </div>
        );
    }

    return (
        <JotaiProvider>
            <Tooltip.Provider delayDuration={200}>
                <HashRouter>
                    <App />
                </HashRouter>
            </Tooltip.Provider>
        </JotaiProvider>
    );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Failed to find the root element.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><DesktopAppLauncher /></React.StrictMode>);