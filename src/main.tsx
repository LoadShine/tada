// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import App from './App';

// Import Tailwind base styles first
import './styles/index.css';

// Import react-day-picker base styles AFTER Tailwind components/utilities
// This allows our Tailwind overrides in index.css to take precedence
import 'react-day-picker/dist/style.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Failed to find the root element. Ensure your HTML has an element with id='root'.");
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <JotaiProvider>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </JotaiProvider>
    </React.StrictMode>
);