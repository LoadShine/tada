// src/App.tsx
// No animation changes needed here, RouteChangeHandler optimization in atoms.ts
import React, { useEffect } from 'react';
import { Routes, Route, useParams, Navigate, useLocation, Outlet } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import MainPage from './pages/MainPage';
import SummaryPage from './pages/SummaryPage';
import CalendarPage from './pages/CalendarPage';
import { TaskFilter } from './types';
import { useAtom, useSetAtom } from 'jotai';
import { currentFilterAtom, selectedTaskIdAtom, searchTermAtom } from './store/atoms';

// Optimization: Moved filter logic into atoms where possible.
// This handler now focuses purely on reacting to route changes.
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

        let newFilter: TaskFilter = 'all';

        if (pathname === '/today') newFilter = 'today';
        else if (pathname === '/next7days') newFilter = 'next7days';
        else if (pathname === '/completed') newFilter = 'completed';
        else if (pathname === '/trash') newFilter = 'trash';
        else if (pathname.startsWith('/list/') && listName) newFilter = `list-${listName}`;
        else if (pathname.startsWith('/tag/') && tagName) newFilter = `tag-${tagName}`;
            // For Calendar and Summary, the view itself dictates content, but we might
            // want to reset the underlying TaskList filter context if user navigates away
            // Setting to 'all' makes sense as a neutral default when leaving these views.
        // For consistency, we'll manage filter changes primarily here.
        else if (pathname === '/summary') newFilter = 'all'; // Set logical filter even if view changes
        else if (pathname === '/calendar') newFilter = 'all'; // Set logical filter
        else if (pathname === '/all' || pathname === '/') newFilter = 'all';
        else newFilter = 'all';

        // Determine if selection/search should be cleared
        // Clear unless navigating between list/tag/standard views
        const isCoreTaskView = newFilter.startsWith('list-') || newFilter.startsWith('tag-') || ['all', 'today', 'next7days'].includes(newFilter);
        const wasCoreTaskView = currentFilterInternal.startsWith('list-') || currentFilterInternal.startsWith('tag-') || ['all', 'today', 'next7days'].includes(currentFilterInternal);
        const shouldClearSelection = !(isCoreTaskView && wasCoreTaskView);
        const shouldClearSearch = shouldClearSelection; // Typically clear search when clearing selection

        // Update filter atom only if it changed
        if (currentFilterInternal !== newFilter) {
            // console.log(`Route Change: Filter changing from ${currentFilterInternal} to ${newFilter}`);
            setCurrentFilter(newFilter);
        }

        // Clear selection if necessary based on navigation logic
        if (shouldClearSelection) {
            setSelectedTaskId(null);
        }

        // Clear search term if needed (e.g., leaving core task views)
        if (shouldClearSearch) {
            setSearchTerm('');
        }

    }, [location.pathname, params.listName, params.tagName, setCurrentFilter, setSelectedTaskId, setSearchTerm, currentFilterInternal]); // Rerun only when relevant parts change

    return <Outlet />; // Render nested routes
};


// Wrapper for List Pages
const ListPageWrapper: React.FC = () => {
    const { listName } = useParams<{ listName: string }>();
    const decodedListName = listName ? decodeURIComponent(listName) : 'Inbox';
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
    return <MainPage title={`#${decodedTagName}`} filter={filter} />;
};


// Main Application Component with Routing Setup
const App: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<MainLayout />}>
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
                    <Route path="*" element={<Navigate to="/all" replace />} />
                </Route>
            </Route>
        </Routes>
    );
};

export default App;