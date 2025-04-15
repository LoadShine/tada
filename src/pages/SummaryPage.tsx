// src/pages/SummaryPage.tsx
import React from 'react';
import SummaryView from '../components/summary/SummaryView';

const SummaryPage: React.FC = () => {
    // Summary view handles its own data fetching/filtering based on its internal state
    return <SummaryView />;
};

export default SummaryPage;