// src/App.tsx
import React from 'react';
import { Routes, Route, useParams, Navigate, useLocation } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import MainPage from './pages/MainPage';
import SummaryPage from './pages/SummaryPage';
import CalendarPage from './pages/CalendarPage';
import { TaskFilter } from './types';
import { useAtom } from 'jotai';
import { currentFilterAtom } from './store/atoms';

// Helper to update filter state based on route, ensuring atom is source of truth
const RouteFilterUpdater: React.FC = () => {
    const [, setCurrentFilter] = useAtom(currentFilterAtom);
    const location = useLocation();
    const params = useParams();

    React.useEffect(() => {
        let newFilter: TaskFilter = 'all'; // Default

        if (location.pathname === '/today') newFilter = 'today';
        else if (location.pathname === '/next7days') newFilter = 'next7days';
        else if (location.pathname === '/completed') newFilter = 'completed';
        else if (location.pathname === '/trash') newFilter = 'trash';
        else if (location.pathname === '/all') newFilter = 'all';
        else if (location.pathname.startsWith('/list/')) {
            const listName = params.listName ? decodeURIComponent(params.listName) : '';
            if (listName) newFilter = `list-${listName}`;
        } else if (location.pathname.startsWith('/tag/')) {
            const tagName = params.tagName ? decodeURIComponent(params.tagName) : '';
            if (tagName) newFilter = `tag-${tagName}`;
        } else if (location.pathname === '/summary' || location.pathname === '/calendar') {
            // These views might implicitly use 'all' or handle filtering internally
            // Setting to 'all' ensures sidebar doesn't show incorrect active state
            newFilter = 'all';
        } else if (location.pathname === '/') {
            newFilter = 'all'; // Index route maps to 'all'
        }
        // Only update if the filter derived from the route is different
        setCurrentFilter(current => current !== newFilter ? newFilter : current);

    }, [location.pathname, params, setCurrentFilter]);

    return null; // This component doesn't render anything itself
};


// Wrapper for list pages
const ListPageWrapper: React.FC = () => {
    const { listName } = useParams<{ listName: string }>();
    const decodedListName = listName ? decodeURIComponent(listName) : '';

    if (!decodedListName) return <Navigate to="/all" replace />;

    const filter: TaskFilter = `list-${decodedListName}`;
    return <MainPage title={decodedListName} filter={filter} />;
};

// Wrapper for tag pages
const TagPageWrapper: React.FC = () => {
    const { tagName } = useParams<{ tagName: string }>();
    const decodedTagName = tagName ? decodeURIComponent(tagName) : '';

    if (!decodedTagName) return <Navigate to="/all" replace />;

    const filter: TaskFilter = `tag-${decodedTagName}`;
    return <MainPage title={`#${decodedTagName}`} filter={filter} />;
};


const App: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<MainLayout />}>
                {/* Add RouteFilterUpdater here to always run */}
                <Route path="*" element={<RouteFilterUpdater />} />

                {/* Index route defaults to 'All Tasks' view */}
                <Route index element={<MainPage title="All Tasks" filter="all" />} />

                {/* Static Filter Routes */}
                <Route path="all" element={<MainPage title="All Tasks" filter="all" />} />
                <Route path="today" element={<MainPage title="Today" filter="today" />} />
                <Route path="next7days" element={<MainPage title="Next 7 Days" filter="next7days" />} />
                <Route path="completed" element={<MainPage title="Completed" filter="completed" />} />
                <Route path="trash" element={<MainPage title="Trash" filter="trash" />} />

                {/* Views without Sidebar (handled by MainLayout conditional rendering) */}
                <Route path="summary" element={<SummaryPage />} />
                <Route path="calendar" element={<CalendarPage />} />

                {/* Dynamic routes for lists and tags */}
                <Route path="list/:listName" element={<ListPageWrapper />} />
                <Route path="tag/:tagName" element={<TagPageWrapper />} />

                {/* Fallback route - redirect to default */}
                {/* Let the "*" route in MainLayout handle the filter update and default rendering if necessary */}
                <Route path="*" element={<Navigate to="/all" replace />} /> {/* Keep fallback */}
            </Route>
        </Routes>
    );
};

export default App;