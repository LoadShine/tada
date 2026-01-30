import React, { useEffect, useState, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { error as logError } from '@tauri-apps/plugin-log';
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

const AppEntry = React.lazy(() => import('./AppEntry'));

const Loader = () => (
    <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-[#1D2530]">
        <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 w-12 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin mb-4"></div>
            <span className="text-gray-500">Initializing System...</span>
        </div>
    </div>
);

const FatalErrorScreen = ({ error }: { error: any }) => (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-red-50 text-red-900 p-10 text-center">
        <h1 className="text-2xl font-bold mb-4">Critical System Error</h1>
        <p className="mb-4">The application failed to load its core modules.</p>
        <pre className="bg-white p-4 rounded border border-red-200 text-left overflow-auto max-w-full text-xs">
            {String(error)}
        </pre>
        <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
            Reload Application
        </button>
    </div>
);

class ModuleLoaderBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
        logError(`Module Load Failure: ${error}\nInfo: ${errorInfo.componentStack}`);
    }

    render() {
        if (this.state.hasError) {
            return <FatalErrorScreen error={this.state.error} />;
        }
        return this.props.children;
    }
}

const Root = () => {
    return (
        <ModuleLoaderBoundary>
            <Suspense fallback={<Loader />}>
                <AppEntry />
            </Suspense>
        </ModuleLoaderBoundary>
    );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Failed to find the root element.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><Root /></React.StrictMode>);
