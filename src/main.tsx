// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import App from './App';
import { TooltipProvider } from "@/components/ui/tooltip";

import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Failed to find the root element. Ensure your HTML has an element with id='root'.");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
    <React.StrictMode>
        {/* Jotai Provider for global state */}
        <JotaiProvider>
            {/* BrowserRouter for routing */}
            <BrowserRouter>
                {/* TooltipProvider for shadcn/ui tooltips */}
                <TooltipProvider delayDuration={200}>
                    <App />
                </TooltipProvider>
            </BrowserRouter>
        </JotaiProvider>
    </React.StrictMode>
);