import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import { App } from '@tada/core';
import * as Tooltip from '@radix-ui/react-tooltip';

// Import i18n configuration from core to initialize it
import '@tada/core/locales';

// Import base styles from core
import '@tada/core/styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Failed to find the root element. Ensure your HTML has an element with id='root'.");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
    <React.StrictMode>
        <JotaiProvider>
            <Tooltip.Provider delayDuration={200}>
                <HashRouter>
                    <App />
                </HashRouter>
            </Tooltip.Provider>
        </JotaiProvider>
    </React.StrictMode>
);