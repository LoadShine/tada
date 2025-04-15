// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import App from './App';
import './styles/index.css'; // Ensure CSS is imported

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <JotaiProvider> {/* Wrap with Jotai Provider */}
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </JotaiProvider>
    </React.StrictMode>
);