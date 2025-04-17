// src/pages/SummaryPage.tsx
import React from 'react';
import SummaryView from '../components/summary/SummaryView';

const SummaryPage: React.FC = () => {
    // SummaryView is self-contained and handles its layout within the main content area
    return <SummaryView />;
};

export default SummaryPage;