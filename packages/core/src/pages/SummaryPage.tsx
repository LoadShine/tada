import React from 'react';
import SummaryView from "@/components/features/summary/SummaryView.tsx";

// Simple wrapper component for the Summary View
const SummaryPage: React.FC = () => {
    // SummaryView handles its own state and logic (now using Radix components)
    return <SummaryView/>;
};
SummaryPage.displayName = 'SummaryPage';
export default SummaryPage;