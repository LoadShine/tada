import React, { Component, ErrorInfo, ReactNode } from 'react';
import { error as logError } from '@tauri-apps/plugin-log';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log to Tauri logger
        logError(`React Error Boundary caught an error: ${error.message}\nComponent Stack: ${errorInfo.componentStack}`);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-screen w-screen flex flex-col items-center justify-center bg-red-50 text-red-900 p-10 text-center">
                    <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
                    <p className="mb-4">An unexpected error occurred. The error has been logged.</p>
                    <pre className="bg-white p-4 rounded border border-red-200 text-left overflow-auto max-w-full text-xs">
                        {this.state.error?.toString()}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
