// src/pages/SummaryPage.tsx
import React from 'react';
import SummaryView from '../components/summary/SummaryView';

const SummaryPage: React.FC = () => {
    // SummaryView handles its own layout within the main content area
    return <SummaryView />;
};

export default SummaryPage;