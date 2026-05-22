import React, { Suspense } from 'react';
import { error as logError } from '@tauri-apps/plugin-log';

const AppEntry = React.lazy(() => import('./AppEntry'));

const Loader = () => (
    <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-[#1D2530]">
        <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 w-12 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin mb-4"></div>
            <span className="text-gray-500">Initializing System...</span>
        </div>
    </div>
);

const FatalErrorScreen = ({ error }: { error: unknown }) => (
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

class ModuleLoaderBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: unknown }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: unknown) {
        return { hasError: true, error };
    }

    componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
        logError(`Module Load Failure: ${String(error)}\nInfo: ${errorInfo.componentStack}`);
    }

    render() {
        if (this.state.hasError) {
            return <FatalErrorScreen error={this.state.error} />;
        }
        return this.props.children;
    }
}

const AppShell = () => (
    <ModuleLoaderBoundary>
        <Suspense fallback={<Loader />}>
            <AppEntry />
        </Suspense>
    </ModuleLoaderBoundary>
);

export default AppShell;
