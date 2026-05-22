import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import App from './App';
import * as Tooltip from '@radix-ui/react-tooltip';

// Import and initialize i18n configuration.
import '@/locales';

// Import base styles LAST to ensure Tailwind utilities can override them.
import './styles/index.css';

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
