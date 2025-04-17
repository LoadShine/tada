// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import App from './App';
import './styles/index.css'; // Main CSS import

// StrictMode helps identify potential problems in an application.
// JotaiProvider makes Jotai state available to the component tree.
// BrowserRouter enables routing capabilities using the HTML5 history API.

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