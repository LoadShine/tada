import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {AnimatePresence, motion} from 'framer-motion';
import {
    aiSettingsAtom,
    echoReportsAtom,
    preferencesSettingsAtom,
    isSettingsOpenAtom,
    settingsSelectedTabAtom
} from '@/store/jotai.ts';
import Button from '@/components/ui/Button.tsx';
import Icon from '@/components/ui/Icon.tsx';
import {EchoReport} from '@/types';
import {useTranslation} from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as Dialog from '@radix-ui/react-dialog';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {twMerge} from 'tailwind-merge';
import {generateEchoReport, isAIConfigValid} from '@/services/aiService';
import {formatDistanceToNow} from 'date-fns';
import {zhCN, enUS} from 'date-fns/locale';
import {AI_PROVIDERS} from "@/config/aiProviders";

// --- Types ---
interface EchoConfigModalProps {
    isOpen: boolean;
    onClose?: () => void;
    onComplete: (jobTypes: string[], pastExamples: string) => void;
    initialJobTypes?: string[];
    initialExamples?: string;
    canClose?: boolean;
}

const JOB_TYPES = [
    { id: 'dev', label: 'R&D / Engineering', desc: 'Code, Architecture, Refactoring' },
    { id: 'product', label: 'Product / Design', desc: 'User Flows, Specs, Review' },
    { id: 'marketing', label: 'Marketing / Content', desc: 'Campaigns, Copy, Social' },
    { id: 'sales', label: 'Sales / BD', desc: 'Leads, CRM, Client Relations' },
    { id: 'ops', label: 'Operations / Support', desc: 'Process, Tickets, Logistics' },
    { id: 'admin', label: 'HR / Admin', desc: 'Policies, Events, Compliance' },
    { id: 'research', label: 'Research / Analysis', desc: 'Data, Trends, Experiments' },
    { id: 'freelance', label: 'Freelance / Consultant', desc: 'Hours, Client Comms' },
];

// --- Onboarding / Config Modal ---
const EchoConfigModal: React.FC<EchoConfigModalProps> = ({
                                                             isOpen,
                                                             onClose,
                                                             onComplete,
                                                             initialJobTypes = [],
                                                             initialExamples = '',
                                                             canClose = false
                                                         }) => {
    const { t } = useTranslation();
    const [selectedJobs, setSelectedJobs] = useState<string[]>(initialJobTypes);
    const [examples, setExamples] = useState(initialExamples);

    // Sync state when props change (re-opening modal)
    useEffect(() => {
        if (isOpen) {
            setSelectedJobs(initialJobTypes);
            setExamples(initialExamples);
        }
    }, [isOpen, initialJobTypes, initialExamples]);

    const toggleJob = (id: string) => {
        setSelectedJobs(prev =>
            prev.includes(id) ? prev.filter(j => j !== id) : [...prev, id]
        );
    };

    const handleOpenChange = (open: boolean) => {
        if (!open && canClose && onClose) {
            onClose();
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 backdrop-blur-sm data-[state=open]:animate-fadeIn" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl p-8 border border-grey-light dark:border-neutral-700 data-[state=open]:animate-modalShow focus:outline-none max-h-[90vh] overflow-y-auto styled-scrollbar">

                    <div className="flex justify-between items-start mb-6">
                        <div className="text-center w-full">
                            <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary dark:text-primary-light">
                                <Icon name="sparkles" size={24} strokeWidth={1.5} />
                            </div>
                            <Dialog.Title className="text-2xl font-light text-grey-dark dark:text-neutral-100 mb-2">
                                {t('echo.onboarding.title')}
                            </Dialog.Title>
                            <Dialog.Description className="text-grey-medium dark:text-neutral-400 font-light text-sm max-w-md mx-auto">
                                {t('echo.onboarding.description')}
                            </Dialog.Description>
                        </div>
                        {canClose && onClose && (
                            <Dialog.Close asChild>
                                <Button variant="ghost" size="icon" icon="x" className="absolute top-4 right-4" />
                            </Dialog.Close>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-medium uppercase tracking-wider text-grey-medium dark:text-neutral-500 mb-3">
                                {t('echo.onboarding.selectRole')}
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {JOB_TYPES.map(job => (
                                    <button
                                        key={job.id}
                                        onClick={() => toggleJob(job.id)}
                                        className={twMerge(
                                            "p-3 rounded-lg border text-left transition-all duration-200",
                                            selectedJobs.includes(job.id)
                                                ? "border-primary bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light"
                                                : "border-grey-light dark:border-neutral-700 hover:border-grey-medium dark:hover:border-neutral-600 text-grey-dark dark:text-neutral-300"
                                        )}
                                    >
                                        <div className="text-sm font-medium">{t(`echo.jobTypes.${job.id}`)}</div>
                                        <div className="text-[11px] opacity-70 mt-0.5 font-light">{t(`echo.jobDescriptions.${job.id}`)}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium uppercase tracking-wider text-grey-medium dark:text-neutral-500 mb-3">
                                {t('echo.onboarding.pasteExamples')}
                            </label>
                            <textarea
                                value={examples}
                                onChange={(e) => setExamples(e.target.value)}
                                placeholder="..."
                                className="w-full h-24 p-3 rounded-lg border border-grey-light dark:border-neutral-700 bg-grey-ultra-light dark:bg-neutral-900 text-sm focus:ring-1 focus:ring-primary focus:outline-none resize-none font-light"
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button
                                variant="primary"
                                size="lg"
                                disabled={selectedJobs.length === 0}
                                onClick={() => onComplete(selectedJobs, examples)}
                                className="w-full sm:w-auto"
                            >
                                {t('common.save')}
                            </Button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

// --- Adjustment Modal ---
interface AdjustmentProps {
    isOpen: boolean;
    onClose: () => void;
    onRegenerate: (style: 'exploration' | 'reflection' | 'balanced', input: string) => void;
    currentStyle: 'exploration' | 'reflection' | 'balanced';
    currentInput: string;
}

const EchoAdjustmentModal: React.FC<AdjustmentProps> = ({ isOpen, onClose, onRegenerate, currentStyle, currentInput }) => {
    const { t } = useTranslation();
    const [style, setStyle] = useState(currentStyle);
    const [input, setInput] = useState(currentInput);

    if (!isOpen) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 backdrop-blur-sm data-[state=open]:animate-fadeIn" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white dark:bg-neutral-800 rounded-xl shadow-2xl p-6 focus:outline-none data-[state=open]:animate-modalShow">
                    <Dialog.Title className="text-lg font-medium text-grey-dark dark:text-neutral-100 mb-4">
                        {t('echo.adjust.title')}
                    </Dialog.Title>

                    <div className="space-y-5">
                        <div className="space-y-3">
                            <label className="text-xs font-medium text-grey-medium dark:text-neutral-400 uppercase tracking-wider">
                                {t('echo.adjust.focus')}
                            </label>
                            <RadioGroup.Root value={style} onValueChange={(v: any) => setStyle(v)} className="grid grid-cols-3 gap-2">
                                {[
                                    { val: 'exploration', label: t('echo.adjust.exploration'), icon: 'telescope', desc: t('echo.adjust.explorationDesc') },
                                    { val: 'balanced', label: t('echo.adjust.balanced'), icon: 'scale', desc: t('echo.adjust.balancedDesc') },
                                    { val: 'reflection', label: t('echo.adjust.reflection'), icon: 'brain-circuit', desc: t('echo.adjust.reflectionDesc') }
                                ].map(opt => (
                                    <RadioGroup.Item
                                        key={opt.val}
                                        value={opt.val}
                                        className={twMerge(
                                            "flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all",
                                            style === opt.val
                                                ? "border-primary bg-primary/5 text-primary dark:text-primary-light"
                                                : "border-grey-light dark:border-neutral-700 hover:bg-grey-ultra-light dark:hover:bg-neutral-700 text-grey-medium dark:text-neutral-400"
                                        )}
                                    >
                                        <Icon name={opt.icon as any} size={20} strokeWidth={1.5} className="mb-2" />
                                        <span className="text-xs font-medium">{opt.label}</span>
                                        <span className="text-[10px] opacity-70 mt-0.5">{opt.desc}</span>
                                    </RadioGroup.Item>
                                ))}
                            </RadioGroup.Root>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-grey-medium dark:text-neutral-400 uppercase tracking-wider">
                                {t('echo.adjust.inputLabel')}
                            </label>
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={t('echo.adjust.inputHint')}
                                className="w-full h-20 p-3 rounded-lg border border-grey-light dark:border-neutral-700 bg-grey-ultra-light dark:bg-neutral-900 text-sm focus:ring-1 focus:ring-primary focus:outline-none resize-none font-light"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                            <Button variant="primary" onClick={() => onRegenerate(style, input)}>
                                {t('echo.adjust.regenerate')}
                            </Button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

// --- Loading Animation ---
const GenerationAnimation: React.FC<{ status: string }> = ({ status }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full space-y-8">
            <div className="relative w-32 h-32">
                <motion.div
                    className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/30 to-purple-500/30 blur-xl"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute inset-4 rounded-full border border-primary/20 dark:border-primary/40"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                    className="absolute inset-8 rounded-full border border-purple-500/20 dark:border-purple-400/40"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-primary dark:text-primary-light">
                    <Icon name="sparkles" size={32} strokeWidth={1} />
                </div>
            </div>
            <div className="h-8 overflow-hidden relative w-64 text-center">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={status}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="text-sm font-light text-grey-dark dark:text-neutral-200"
                    >
                        {status}
                    </motion.p>
                </AnimatePresence>
            </div>
        </div>
    );
};

// --- Copy Button with Feedback & Dropdown ---
const CopyButton: React.FC<{ text: string, disabled: boolean }> = ({ text, disabled }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyMarkdown = () => handleCopy(text);

    const copyPlainText = () => {
        // Simple plain text conversion: remove markdown symbols
        const plainText = text
            .replace(/#+\s/g, '') // Headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
            .replace(/\*(.*?)\*/g, '$1') // Italic
            .replace(/`(.*?)`/g, '$1') // Inline code
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
            .replace(/>\s/g, '') // Blockquotes
            .replace(/- /g, '• '); // List items

        handleCopy(plainText);
    };

    return (
        <DropdownMenu.Root>
            <div className="flex items-center">
                {/* Main Copy Button (defaults to Markdown) */}
                <Button
                    variant="primary"
                    size="sm"
                    onClick={copyMarkdown}
                    disabled={disabled}
                    className="rounded-r-none"
                    icon={copied ? "check" : "copy"}
                >
                    {copied ? t('echo.copy.copied') : t('echo.copy.button')}
                </Button>
                {/* Dropdown Trigger */}
                <DropdownMenu.Trigger asChild disabled={disabled}>
                    <Button
                        variant="primary"
                        size="sm"
                        className="px-1.5 rounded-l-none border-l border-white/20"
                        disabled={disabled}
                    >
                        <Icon name="chevron-down" size={14} strokeWidth={1.5} />
                    </Button>
                </DropdownMenu.Trigger>
            </div>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    sideOffset={5}
                    className="z-50 min-w-[160px] bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-grey-light dark:border-neutral-700 p-1 data-[state=open]:animate-dropdownShow"
                >
                    <DropdownMenu.Item
                        onClick={copyMarkdown}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm text-grey-dark dark:text-neutral-200 hover:bg-grey-ultra-light dark:hover:bg-neutral-700 rounded cursor-pointer outline-none"
                    >
                        <Icon name="file-text" size={14} />
                        {t('echo.copy.markdown')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        onClick={copyPlainText}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm text-grey-dark dark:text-neutral-200 hover:bg-grey-ultra-light dark:hover:bg-neutral-700 rounded cursor-pointer outline-none"
                    >
                        <Icon name="align-left" size={14} />
                        {t('echo.copy.plainText')}
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
};


// --- Main View ---
const EchoView: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [preferences, setPreferences] = useAtom(preferencesSettingsAtom);
    const [echoReports, setEchoReports] = useAtom(echoReportsAtom);
    const aiSettings = useAtomValue(aiSettingsAtom);
    const setIsSettingsOpen = useSetAtom(isSettingsOpenAtom);
    const setSettingsTab = useSetAtom(settingsSelectedTabAtom);

    // UI State
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStatus, setGenerationStatus] = useState("Initializing...");
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Current Report State
    const [currentReportText, setCurrentReportText] = useState("");
    const [currentReportId, setCurrentReportId] = useState<string | null>(null);
    const [currentStyle, setCurrentStyle] = useState<'balanced' | 'exploration' | 'reflection'>('balanced');
    const [currentInput, setCurrentInput] = useState("");

    // Effects for status animation
    useEffect(() => {
        if (!isGenerating) return;
        const statuses = [
            "Analyzing past tasks...",
            "Scanning upcoming schedule...",
            "Fitting narrative style...",
            "Defining fact boundaries...",
            "Establishing truth anchors...",
            "Constructing causal chains...",
            "Polishing corporate dialect..."
        ];
        let i = 0;
        const interval = setInterval(() => {
            setGenerationStatus(statuses[i % statuses.length]);
            i++;
        }, 1500);
        return () => clearInterval(interval);
    }, [isGenerating]);

    // Handle configuration update
    const handleConfigComplete = (jobTypes: string[], pastExamples: string) => {
        setPreferences(prev => ({
            ...prev!,
            echoJobTypes: jobTypes,
            echoPastExamples: pastExamples
        }));
        setIsConfigOpen(false);
    };

    const needsOnboarding = !preferences?.echoJobTypes || preferences.echoJobTypes.length === 0;

    // Show config modal if needs onboarding or requested by user
    const showConfigModal = needsOnboarding || isConfigOpen;

    const handleGenerate = async (style: 'balanced' | 'exploration' | 'reflection' = 'balanced', input: string = '') => {
        // Ensure configuration is complete before generating
        if (!isAIConfigValid(aiSettings)) {
            setSettingsTab('ai');
            setIsSettingsOpen(true);
            return;
        }

        setIsGenerating(true);
        setCurrentReportText("");
        setIsAdjustOpen(false);
        setCurrentReportId(null); // Reset current ID during generation

        try {
            const report = await generateEchoReport(
                preferences!.echoJobTypes,
                preferences!.echoPastExamples || '',
                aiSettings!,
                t,
                i18n.language,
                style,
                input,
                (chunk) => setCurrentReportText(prev => prev + chunk)
            );

            setEchoReports(prev => [report, ...(prev ?? [])]);
            setCurrentReportId(report.id);
            setCurrentStyle(style);
            setCurrentInput(input);
        } catch (e) {
            console.error(e);
            setCurrentReportText(`Error generating report: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // Determine what to display:
    // 1. If currently generating, rely on currentReportText state directly.
    // 2. If finished generating (currentReportId is set), show that report.
    // 3. Otherwise (initial state or reset), show nothing (Empty State).
    const activeReport = currentReportId
        ? echoReports?.find(r => r.id === currentReportId)
        : null;

    // Sync state if activeReport changes (e.g. from history selection)
    useEffect(() => {
        if (activeReport && !isGenerating) {
            setCurrentReportText(activeReport.content);
            setCurrentStyle(activeReport.style as any);
            setCurrentInput(activeReport.userInput || "");
        } else if (!activeReport && !isGenerating) {
            // Reset if no active report selected (e.g. initial load)
            setCurrentReportText("");
            setCurrentInput("");
        }
    }, [activeReport, isGenerating]);

    return (
        <div className="relative h-full w-full flex flex-col bg-white dark:bg-neutral-900 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-grey-light/50 dark:border-neutral-800 shrink-0 bg-transparent z-20" data-tauri-drag-region="true">
                <div className="flex items-center gap-2">
                    <Icon name="webhook" className="text-primary dark:text-primary-light" size={20} />
                    <h1 className="text-lg font-light text-grey-dark dark:text-neutral-100">{t('echo.title')}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        icon="user"
                        onClick={() => setIsConfigOpen(true)}
                        title="Configure Persona"
                        className="w-8 h-8 text-grey-medium dark:text-neutral-400"
                    />
                    <Button
                        variant="ghost"
                        size="sm"
                        icon="history"
                        onClick={() => setShowHistory(!showHistory)}
                        className={showHistory ? "bg-grey-ultra-light dark:bg-neutral-800" : ""}
                    >
                        {t('echo.history.title')}
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 relative z-10">

                {/* State 1: Initial (No Report & Not Generating) */}
                {!currentReportText && !isGenerating && !activeReport && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center overflow-auto">
                        <div className="w-20 h-20 bg-gradient-to-tr from-grey-light to-white dark:from-neutral-800 dark:to-neutral-700 rounded-full flex items-center justify-center mb-6 shadow-lg">
                            <Icon name="webhook" size={32} className="text-grey-medium dark:text-neutral-400 opacity-50" strokeWidth={1} />
                        </div>
                        <h2 className="text-xl font-light text-grey-dark dark:text-neutral-200 mb-2">{t('echo.emptyState.title')}</h2>
                        <p className="text-grey-medium dark:text-neutral-400 font-light max-w-sm mb-8 text-sm">
                            {t('echo.emptyState.description')}
                        </p>
                        <Button
                            variant="primary"
                            size="lg"
                            className="px-8 h-12 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow rounded-full"
                            onClick={() => handleGenerate('balanced', '')}
                            icon="sparkles"
                        >
                            {t('echo.emptyState.button')}
                        </Button>
                    </div>
                )}

                {/* State 2: Generating (Initial Thinking) - Only show if no text yet */}
                {isGenerating && !currentReportText && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <GenerationAnimation status={generationStatus} />
                    </div>
                )}

                {/* State 3: Report Display (Streaming or Finished) */}
                {(currentReportText || (activeReport && !isGenerating)) && (
                    <div className="flex-1 flex flex-col min-h-0 p-6 max-w-3xl mx-auto w-full">
                        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-grey-light dark:border-neutral-700 flex-1 flex flex-col min-h-0 overflow-hidden">

                            {/* Scrollable Markdown Content */}
                            <div className="flex-1 overflow-y-auto p-8 prose prose-sm dark:prose-invert max-w-none font-serif leading-relaxed styled-scrollbar">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {currentReportText}
                                </ReactMarkdown>
                                {isGenerating && (
                                    <span className="inline-block w-2 h-4 ml-1 bg-primary align-middle animate-pulse" />
                                )}
                            </div>

                            {/* Toolbar */}
                            <div className="p-4 border-t border-grey-light dark:border-neutral-700 bg-grey-ultra-light/50 dark:bg-neutral-900/30 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-grey-medium dark:text-neutral-500 px-2 py-1 rounded bg-grey-light/50 dark:bg-neutral-700">
                                        {t(`echo.adjust.${currentStyle}`)}
                                    </span>
                                    {currentInput && (
                                        <span className="text-[10px] text-grey-medium truncate max-w-[150px]" title={currentInput}>
                                            Input: {currentInput}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="secondary" size="sm" icon="sliders" onClick={() => setIsAdjustOpen(true)} disabled={isGenerating}>
                                        {t('common.edit')}
                                    </Button>
                                    <CopyButton text={currentReportText} disabled={isGenerating} />
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-center shrink-0">
                            <Button
                                variant="ghost"
                                className="opacity-50 hover:opacity-100"
                                onClick={() => handleGenerate('balanced', '')}
                                disabled={isGenerating}
                            >
                                <Icon name="refresh-cw" size={14} className="mr-2"/> {t('echo.generateNew')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* History Sidebar Overlay */}
            <AnimatePresence>
                {showHistory && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowHistory(false)}
                            className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm z-30"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-neutral-800 border-l border-grey-light dark:border-neutral-700 z-40 shadow-2xl flex flex-col"
                        >
                            <div className="p-4 border-b border-grey-light dark:border-neutral-700 flex justify-between items-center shrink-0">
                                <h3 className="font-medium text-grey-dark dark:text-neutral-200">{t('echo.history.title')}</h3>
                                <Button variant="ghost" size="icon" icon="x" onClick={() => setShowHistory(false)} />
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-2 styled-scrollbar">
                                {echoReports?.map(report => (
                                    <button
                                        key={report.id}
                                        onClick={() => {
                                            setCurrentReportId(report.id);
                                            setShowHistory(false);
                                            setCurrentReportText(report.content); // Immediate update
                                        }}
                                        className={twMerge(
                                            "w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm group",
                                            currentReportId === report.id
                                                ? "bg-primary/5 border-primary dark:bg-primary/10 dark:border-primary-light"
                                                : "bg-white dark:bg-neutral-750 border-grey-light dark:border-neutral-700 hover:border-grey-medium dark:hover:border-neutral-600"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs text-grey-medium dark:text-neutral-400">
                                                {formatDistanceToNow(report.createdAt, { addSuffix: true, locale: i18n.language === 'zh-CN' ? zhCN : enUS })}
                                            </span>
                                            <span className={twMerge(
                                                "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded",
                                                report.style === 'exploration' ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" :
                                                    report.style === 'reflection' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                                        "bg-grey-100 text-grey-700 dark:bg-neutral-700 dark:text-neutral-300"
                                            )}>
                                                {report.style.slice(0, 3)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-grey-dark dark:text-neutral-200 line-clamp-2 font-serif opacity-80 group-hover:opacity-100">
                                            {report.content.replace(/[#*`]/g, '')}
                                        </p>
                                    </button>
                                ))}
                                {(!echoReports || echoReports.length === 0) && (
                                    <div className="text-center py-10 text-grey-medium dark:text-neutral-500 text-sm italic">
                                        {t('echo.history.empty')}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <EchoConfigModal
                isOpen={showConfigModal}
                onClose={() => setIsConfigOpen(false)}
                onComplete={handleConfigComplete}
                initialJobTypes={preferences?.echoJobTypes}
                initialExamples={preferences?.echoPastExamples}
                canClose={!needsOnboarding}
            />

            <EchoAdjustmentModal
                isOpen={isAdjustOpen}
                onClose={() => setIsAdjustOpen(false)}
                onRegenerate={handleGenerate}
                currentStyle={currentStyle}
                currentInput={currentInput}
            />
        </div>
    );
};

export default EchoView;