// src/App.tsx
import React, { useEffect } from 'react';
import { Routes, Route, useParams, Navigate, useLocation, Outlet } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import MainPage from './pages/MainPage';
import SummaryPage from './pages/SummaryPage';
import CalendarPage from './pages/CalendarPage';
import { TaskFilter } from './types';
import { useAtom } from 'jotai';
import { currentFilterAtom, selectedTaskIdAtom } from './store/atoms'; // Include selectedTaskIdAtom

// Helper Component to Update Filter State and Clear Selection on Route Change
const RouteChangeHandler: React.FC = () => {
    const [, setCurrentFilter] = useAtom(currentFilterAtom);
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom); // Get setter for selected task
    const location = useLocation();
    const params = useParams();

    useEffect(() => {
        let newFilter: TaskFilter = 'all'; // Default filter

        // Determine filter based on pathname
        const pathname = location.pathname;
        if (pathname === '/today') newFilter = 'today';
        else if (pathname === '/next7days') newFilter = 'next7days';
        else if (pathname === '/completed') newFilter = 'completed';
        else if (pathname === '/trash') newFilter = 'trash';
        else if (pathname === '/all') newFilter = 'all';
        else if (pathname.startsWith('/list/')) {
            const listName = params.listName ? decodeURIComponent(params.listName) : '';
            if (listName) newFilter = `list-${listName}`;
        } else if (pathname.startsWith('/tag/')) {
            const tagName = params.tagName ? decodeURIComponent(params.tagName) : '';
            if (tagName) newFilter = `tag-${tagName}`;
        } else if (pathname === '/summary' || pathname === '/calendar') {
            // Views without a task list filter; keep filter atom as 'all' or last state?
            // Setting to 'all' might be best for sidebar consistency.
            newFilter = 'all';
        } else if (pathname === '/') {
            newFilter = 'all'; // Index route maps to 'all'
        }

        // Update filter atom only if it changed
        setCurrentFilter(current => current !== newFilter ? newFilter : current);

        // Deselect task when navigating away from task list views or changing filters
        // (except when just selecting a different task within the same list view)
        // We can simply deselect on *any* path change for simplicity here.
        // More complex logic could preserve selection if navigating between items in the same list.
        setSelectedTaskId(null);

    }, [location.pathname, params, setCurrentFilter, setSelectedTaskId]); // Add setSelectedTaskId dependency

    return <Outlet />; // Render nested routes
};


// Wrapper for List Pages to extract params and pass props
const ListPageWrapper: React.FC = () => {
    const { listName } = useParams<{ listName: string }>();
    const decodedListName = listName ? decodeURIComponent(listName) : '';

    // Redirect if listName is missing (shouldn't happen with route setup but good practice)
    if (!decodedListName) return <Navigate to="/all" replace />;

    const filter: TaskFilter = `list-${decodedListName}`;
    return <MainPage title={decodedListName} filter={filter} />;
};

// Wrapper for Tag Pages
const TagPageWrapper: React.FC = () => {
    const { tagName } = useParams<{ tagName: string }>();
    const decodedTagName = tagName ? decodeURIComponent(tagName) : '';

    if (!decodedTagName) return <Navigate to="/all" replace />;

    const filter: TaskFilter = `tag-${decodedTagName}`;
    // Use # prefix for title display
    return <MainPage title={`#${decodedTagName}`} filter={filter} />;
};


// Main Application Component with Routing Setup
const App: React.FC = () => {
    return (
        <Routes>
            {/* Main Layout wraps all primary routes */}
            <Route path="/" element={<MainLayout />}>
                {/* RouteChangeHandler sits inside MainLayout to access context and handle changes */}
                <Route element={<RouteChangeHandler/>}>
                    {/* Index route defaults to 'All Tasks' */}
                    <Route index element={<MainPage title="All Tasks" filter="all" />} />

                    {/* Static Filter Routes */}
                    <Route path="all" element={<MainPage title="All Tasks" filter="all" />} />
                    <Route path="today" element={<MainPage title="Today" filter="today" />} />
                    <Route path="next7days" element={<MainPage title="Next 7 Days" filter="next7days" />} />
                    <Route path="completed" element={<MainPage title="Completed" filter="completed" />} />
                    <Route path="trash" element={<MainPage title="Trash" filter="trash" />} />

                    {/* Standalone Views (Sidebar is hidden via MainLayout logic) */}
                    <Route path="summary" element={<SummaryPage />} />
                    <Route path="calendar" element={<CalendarPage />} />

                    {/* Dynamic routes for lists and tags */}
                    <Route path="list/:listName" element={<ListPageWrapper />} />
                    <Route path="tag/:tagName" element={<TagPageWrapper />} />

                    {/* Fallback route - redirect any unmatched paths to the default view */}
                    <Route path="*" element={<Navigate to="/all" replace />} />
                </Route>
            </Route>
        </Routes>
    );
};

export default App;