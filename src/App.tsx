// src/App.tsx
import React, { useEffect } from 'react';
import { Routes, Route, useParams, Navigate, useLocation, Outlet } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import MainPage from './pages/MainPage';
import SummaryPage from './pages/SummaryPage';
import CalendarPage from './pages/CalendarPage';
import { TaskFilter } from './types';
import { useAtom, useSetAtom } from 'jotai';
import { currentFilterAtom, selectedTaskIdAtom, searchTermAtom } from './store/atoms';

// Helper Component to Update Filter State and Clear Selection/Search on Route Change
const RouteChangeHandler: React.FC = () => {
    const [currentFilterInternal, setCurrentFilter] = useAtom(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const setSearchTerm = useSetAtom(searchTermAtom);
    const location = useLocation();
    const params = useParams();

    useEffect(() => {
        const { pathname } = location;
        const listName = params.listName ? decodeURIComponent(params.listName) : '';
        const tagName = params.tagName ? decodeURIComponent(params.tagName) : '';

        let newFilter: TaskFilter = 'all'; // Default filter

        // --- Determine filter based on route ---
        if (pathname === '/today') newFilter = 'today';
        else if (pathname === '/next7days') newFilter = 'next7days';
        else if (pathname === '/completed') newFilter = 'completed';
        else if (pathname === '/trash') newFilter = 'trash';
        else if (pathname.startsWith('/list/') && listName) newFilter = `list-${listName}`;
        else if (pathname.startsWith('/tag/') && tagName) newFilter = `tag-${tagName}`;
        else if (pathname === '/summary') newFilter = 'all'; // Reset to 'all' for consistency if needed
        else if (pathname === '/calendar') newFilter = 'all'; // Reset to 'all'
        else if (pathname === '/all') newFilter = 'all';
        else if (pathname === '/') newFilter = 'all'; // Index maps to 'all'
        else newFilter = 'all'; // Fallback

        // --- Determine if selection/search should be cleared ---
        let shouldClearSelection = true; // Default to clearing selection
        let shouldClearSearch = true; // Default to clearing search

        // Keep selection/search when navigating between list/tag/standard views
        const isListOrTagView = newFilter.startsWith('list-') || newFilter.startsWith('tag-');
        const isStandardView = ['all', 'today', 'next7days'].includes(newFilter);
        const wasListOrTagOrStandard = currentFilterInternal.startsWith('list-') || currentFilterInternal.startsWith('tag-') || ['all', 'today', 'next7days'].includes(currentFilterInternal);

        // Don't clear selection/search if moving between these core views
        if ((isListOrTagView || isStandardView) && wasListOrTagOrStandard) {
            shouldClearSelection = false;
            shouldClearSearch = false;
        }

        // --- Update State ---
        // Update filter atom only if it truly changed
        if (currentFilterInternal !== newFilter) {
            setCurrentFilter(newFilter);
            if (shouldClearSelection) {
                setSelectedTaskId(null);
            }
        } else {
            // If filter didn't change, but we navigated to a view that *should* clear, clear it now
            if (shouldClearSelection) setSelectedTaskId(null);
        }

        // Clear search term if needed (e.g., navigating to calendar/summary)
        if (shouldClearSearch) {
            setSearchTerm('');
        }

        // Only re-run when path or params change significantly
    }, [location.pathname, params.listName, params.tagName, setCurrentFilter, setSelectedTaskId, setSearchTerm, currentFilterInternal]);

    return <Outlet />; // Render nested routes
};


// Wrapper for List Pages
const ListPageWrapper: React.FC = () => {
    const { listName } = useParams<{ listName: string }>();
    const decodedListName = listName ? decodeURIComponent(listName) : 'Inbox'; // Default to Inbox if somehow empty
    if (!decodedListName) return <Navigate to="/all" replace />; // Should not happen with default
    const filter: TaskFilter = `list-${decodedListName}`;
    return <MainPage title={decodedListName} filter={filter} />;
};

// Wrapper for Tag Pages
const TagPageWrapper: React.FC = () => {
    const { tagName } = useParams<{ tagName: string }>();
    const decodedTagName = tagName ? decodeURIComponent(tagName) : '';
    if (!decodedTagName) return <Navigate to="/all" replace />;
    const filter: TaskFilter = `tag-${decodedTagName}`;
    return <MainPage title={`#${decodedTagName}`} filter={filter} />;
};


// Main Application Component with Routing Setup
const App: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<MainLayout />}>
                {/* RouteChangeHandler manages filter/selection based on route */}
                <Route element={<RouteChangeHandler/>}>
                    <Route index element={<Navigate to="/all" replace />} />
                    <Route path="all" element={<MainPage title="All Tasks" filter="all" />} />
                    <Route path="today" element={<MainPage title="Today" filter="today" />} />
                    <Route path="next7days" element={<MainPage title="Next 7 Days" filter="next7days" />} />
                    <Route path="completed" element={<MainPage title="Completed" filter="completed" />} />
                    <Route path="trash" element={<MainPage title="Trash" filter="trash" />} />
                    <Route path="summary" element={<SummaryPage />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="list/:listName" element={<ListPageWrapper />} />
                    <Route path="tag/:tagName" element={<TagPageWrapper />} />
                    {/* Catch-all redirect */}
                    <Route path="*" element={<Navigate to="/all" replace />} />
                </Route>
            </Route>
        </Routes>
    );
};

export default App;