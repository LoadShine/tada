import React from 'react';
import ReactDOM from 'react-dom/client';
import { error as logError } from '@tauri-apps/plugin-log';
import AppShell from './AppShell';
import '@tada/core/styles/index.css';

const setupErrorHandlers = () => {
    window.onerror = (message, source, lineno, colno, error) => {
        const errorMsg = `Global Script Error: ${message} at ${source}:${lineno}:${colno}\nStack: ${error?.stack || 'No Stack'}`;
        console.error(errorMsg);
        logError(errorMsg).catch(console.error);
    };

    window.onunhandledrejection = (event) => {
        const errorMsg = `Unhandled Promise Rejection: ${event.reason}`;
        console.error(errorMsg);
        logError(errorMsg).catch(console.error);
    };
};

setupErrorHandlers();

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Failed to find the root element.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><AppShell /></React.StrictMode>);
