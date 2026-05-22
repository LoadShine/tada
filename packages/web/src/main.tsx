import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import { App } from '@tada/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import storageManager from '@tada/core/services/storageManager';
import { LocalStorageService } from './services/localStorageService';

import '@tada/core/locales';
import '@tada/core/styles/index.css';

storageManager.register(new LocalStorageService());

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Failed to find the root element. Ensure your HTML has an element with id='root'.");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
    <React.StrictMode>
        <JotaiProvider>
            <Tooltip.Provider delayDuration={200}>
                <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <App />
                </HashRouter>
            </Tooltip.Provider>
        </JotaiProvider>
    </React.StrictMode>
);
