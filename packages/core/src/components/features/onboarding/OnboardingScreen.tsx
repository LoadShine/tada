import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { userProfileAtom, preferencesSettingsAtom, defaultPreferencesSettingsForApi } from '@/store/jotai';
import { Persona, TaskView, UncertaintyTolerance, IncompletionStyle, createDefaultUserProfile } from '@/types';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import type { IconName } from '@/components/ui/IconMap';

interface OnboardingScreenProps {
    onComplete: () => void;
}

// Persona options with icons
const PERSONA_OPTIONS: { id: Persona; icon: IconName }[] = [
    { id: 'dev', icon: 'code' },
    { id: 'product', icon: 'layout' },
    { id: 'marketing', icon: 'megaphone' },
    { id: 'sales', icon: 'handshake' },
    { id: 'ops', icon: 'users' },
    { id: 'admin', icon: 'building' },
    { id: 'research', icon: 'bar-chart-2' },
    { id: 'freelance', icon: 'coffee' },
];

// Rotating placeholder examples for user note
const USER_NOTE_PLACEHOLDERS = [
    'onboarding.userNotePlaceholders.interrupted',
    'onboarding.userNotePlaceholders.progress',
    'onboarding.userNotePlaceholders.rush',
];

// Language options
const LANGUAGE_OPTIONS = [
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'zh-CN', label: '中文', flag: '🇨🇳' },
];

const TOTAL_STEPS = 6;

// Simplified animation - just fade in/out
const pageTransition = {
    initial: { opacity: 0, x: 10 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" } },
    exit: { opacity: 0, x: -10, transition: { duration: 0.15, ease: "easeIn" } },
};

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
    const { t, i18n } = useTranslation();
    const [userProfile, setUserProfile] = useAtom(userProfileAtom);
    const [preferences, setPreferences] = useAtom(preferencesSettingsAtom);

    const [step, setStep] = useState(0);

    // Collected data
    const [selectedPersonas, setSelectedPersonas] = useState<Persona[]>([]);
    const [taskView, setTaskView] = useState<TaskView | null>(null);
    const [uncertaintyTolerance, setUncertaintyTolerance] = useState<UncertaintyTolerance | null>(null);
    const [incompletionStyle, setIncompletionStyle] = useState<IncompletionStyle | null>(null);
    const [userNote, setUserNote] = useState('');
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'zh-CN'>((preferences?.language as 'en' | 'zh-CN') || 'en');

    // Rotate placeholder every 3 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIndex((prev) => (prev + 1) % USER_NOTE_PLACEHOLDERS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleLanguageChange = useCallback((langCode: 'en' | 'zh-CN') => {
        setSelectedLanguage(langCode);
        i18n.changeLanguage(langCode);
        // Sync with global preferences
        setPreferences(prev => ({
            ...(prev || defaultPreferencesSettingsForApi()),
            language: langCode
        }));
    }, [i18n, setPreferences]);

    const togglePersona = useCallback((persona: Persona) => {
        setSelectedPersonas((prev) =>
            prev.includes(persona)
                ? prev.filter((p) => p !== persona)
                : [...prev, persona]
        );
    }, []);

    const handleNext = useCallback(() => {
        if (step < TOTAL_STEPS - 1) {
            setStep(step + 1);
        } else {
            handleComplete();
        }
    }, [step]);

    const handleBack = useCallback(() => {
        if (step > 0) {
            setStep(step - 1);
        }
    }, [step]);

    const handleSkipAll = useCallback(() => {
        const defaultProfile = createDefaultUserProfile();
        defaultProfile.onboardingCompleted = true;
        setUserProfile(defaultProfile);
        onComplete();
    }, [setUserProfile, onComplete]);

    const handleComplete = useCallback(() => {
        setUserProfile({
            persona: selectedPersonas.length > 0 ? selectedPersonas : null,
            workRealityModel: {
                taskView,
                uncertaintyTolerance,
                incompletionStyle,
                confidence: {
                    taskView: taskView ? 0.9 : 0.5,
                    uncertaintyTolerance: uncertaintyTolerance ? 0.9 : 0.5,
                    incompletionStyle: incompletionStyle ? 0.9 : 0.5,
                },
            },
            userNote: userNote.trim() || null,
            onboardingCompleted: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        onComplete();
    }, [selectedPersonas, taskView, uncertaintyTolerance, incompletionStyle, userNote, setUserProfile, onComplete]);

    // Step indicator
    const renderStepIndicator = () => (
        <div className="flex items-center justify-center gap-1.5 mb-8">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <div
                    key={i}
                    className={twMerge(
                        "h-1.5 rounded-full transition-all duration-300 dark:opacity-80",
                        step >= i ? "w-6 bg-primary" : "w-1.5 bg-grey-light dark:bg-neutral-800"
                    )}
                />
            ))}
        </div>
    );

    // Step 0: Welcome
    const renderWelcome = () => (
        <motion.div
            key="welcome"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="text-center space-y-6"
        >
            <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg transform transition-transform duration-500 hover:scale-105">
                    <Icon name="check-circle" size={32} className="text-white" strokeWidth={1.5} />
                </div>
            </div>

            <h1 className="text-2xl font-semibold text-grey-dark dark:text-neutral-100">
                {t('onboarding.welcome.title', 'Welcome to Tada')}
            </h1>

            <p className="text-sm text-grey-medium dark:text-neutral-400 leading-relaxed max-w-xs mx-auto">
                {t('onboarding.welcome.subtitle', 'A few quick questions to personalize your experience')}
            </p>

            {/* Language Switcher */}
            <div className="flex justify-center gap-2 pt-4">
                {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                        key={lang.value}
                        onClick={() => handleLanguageChange(lang.value as 'en' | 'zh-CN')}
                        className={twMerge(
                            'px-4 py-2.5 rounded-lg border text-sm transition-all duration-200 flex items-center gap-2',
                            selectedLanguage === lang.value
                                ? 'border-primary bg-primary/10 text-primary dark:border-primary-light dark:text-primary-light font-medium'
                                : 'border-grey-light dark:border-neutral-700 text-grey-dark dark:text-neutral-300 hover:border-grey-medium hover:bg-black/5 dark:hover:bg-white/5'
                        )}
                    >
                        <span className="text-lg">{lang.flag}</span>
                        <span>{lang.label}</span>
                    </button>
                ))}
            </div>
        </motion.div>
    );

    // Step 1: Persona selection
    const renderPersonaStep = () => (
        <motion.div
            key="persona"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-5"
        >
            <div className="text-center">
                <h2 className="text-lg font-medium text-grey-dark dark:text-neutral-100 mb-2">
                    {t('onboarding.step1.title')}
                </h2>
                <p className="text-xs text-grey-medium dark:text-neutral-400">
                    {t('onboarding.step1.hint', 'Select all that apply')}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {PERSONA_OPTIONS.map((persona) => (
                    <button
                        key={persona.id}
                        onClick={() => togglePersona(persona.id)}
                        className={twMerge(
                            'p-3.5 rounded-xl border text-left transition-all duration-200 active:scale-95',
                            selectedPersonas.includes(persona.id)
                                ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                                : 'border-grey-light dark:border-neutral-700 hover:border-grey-medium hover:bg-grey-ultra-light/50 dark:hover:bg-neutral-800'
                        )}
                    >
                        <div className="flex items-center gap-2.5">
                            <div className={twMerge(
                                'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                                selectedPersonas.includes(persona.id)
                                    ? 'bg-primary/15 dark:bg-primary/20'
                                    : 'bg-grey-ultra-light dark:bg-neutral-800'
                            )}>
                                <Icon
                                    name={persona.icon}
                                    size={16}
                                    strokeWidth={1.5}
                                    className={selectedPersonas.includes(persona.id)
                                        ? 'text-primary dark:text-primary-light'
                                        : 'text-grey-medium dark:text-neutral-400'
                                    }
                                />
                            </div>
                            <span className={twMerge(
                                'text-sm',
                                selectedPersonas.includes(persona.id)
                                    ? 'text-primary dark:text-primary-light font-medium'
                                    : 'text-grey-dark dark:text-neutral-300'
                            )}>
                                {t(`onboarding.personas.${persona.id}`)}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </motion.div>
    );

    // Generic binary choice
    const renderBinaryChoice = (
        question: string,
        hint: string,
        value: string | null,
        setValue: (v: any) => void,
        options: { value: string; label: string; icon?: IconName }[]
    ) => (
        <motion.div
            key={question}
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-5"
        >
            <div className="text-center">
                <h2 className="text-lg font-medium text-grey-dark dark:text-neutral-100 mb-2">
                    {question}
                </h2>
                <p className="text-xs text-grey-medium dark:text-neutral-400">
                    {hint}
                </p>
            </div>

            <div className="space-y-2.5">
                {options.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => setValue(value === option.value ? null : option.value)}
                        className={twMerge(
                            'w-full p-4 rounded-xl border text-left transition-all duration-200 active:scale-[0.98]',
                            value === option.value
                                ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                                : 'border-grey-light dark:border-neutral-700 hover:border-grey-medium hover:bg-grey-ultra-light/50 dark:hover:bg-neutral-800'
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <span className={twMerge(
                                'text-sm',
                                value === option.value
                                    ? 'text-primary dark:text-primary-light font-medium'
                                    : 'text-grey-dark dark:text-neutral-300'
                            )}>
                                {option.label}
                            </span>
                            {value === option.value && (
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center animate-in fade-in zoom-in duration-200">
                                    <Icon name="check" size={12} className="text-white" strokeWidth={2.5} />
                                </div>
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </motion.div>
    );

    // Step 2: TaskView
    const renderTaskViewStep = () => renderBinaryChoice(
        t('onboarding.wrm.taskView.label'),
        t('onboarding.wrm.taskView.hint', 'How tasks feel to you'),
        taskView,
        setTaskView,
        [
            { value: 'process', label: t('onboarding.wrm.taskView.process') },
            { value: 'outcome', label: t('onboarding.wrm.taskView.outcome') },
        ]
    );

    // Step 3: UncertaintyTolerance
    const renderUncertaintyStep = () => renderBinaryChoice(
        t('onboarding.wrm.uncertaintyTolerance.label'),
        t('onboarding.wrm.uncertaintyTolerance.hint', 'Your approach to ambiguity'),
        uncertaintyTolerance,
        setUncertaintyTolerance,
        [
            { value: 'low', label: t('onboarding.wrm.uncertaintyTolerance.low') },
            { value: 'high', label: t('onboarding.wrm.uncertaintyTolerance.high') },
        ]
    );

    // Step 4: IncompletionStyle
    const renderIncompletionStep = () => renderBinaryChoice(
        t('onboarding.wrm.incompletionStyle.label'),
        t('onboarding.wrm.incompletionStyle.hint', 'How to express progress'),
        incompletionStyle,
        setIncompletionStyle,
        [
            { value: 'narrative', label: t('onboarding.wrm.incompletionStyle.narrative') },
            { value: 'explicit', label: t('onboarding.wrm.incompletionStyle.explicit') },
        ]
    );

    // Step 5: User Note
    const renderUserNoteStep = () => (
        <motion.div
            key="usernote"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-5"
        >
            <div className="text-center">
                <h2 className="text-lg font-medium text-grey-dark dark:text-neutral-100 mb-2">
                    {t('onboarding.step3.title')}
                </h2>
                <p className="text-xs text-grey-medium dark:text-neutral-400">
                    {t('onboarding.step3.hint', 'Optional, but helps personalize AI responses')}
                </p>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <textarea
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder={t(USER_NOTE_PLACEHOLDERS[placeholderIndex])}
                    className="w-full h-32 p-4 rounded-xl border border-grey-light dark:border-neutral-700 bg-white dark:bg-neutral-800 text-grey-dark dark:text-neutral-100 placeholder:text-grey-medium/50 dark:placeholder:text-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm leading-relaxed transition-all"
                />
            </div>
        </motion.div>
    );

    const renderCurrentStep = () => {
        switch (step) {
            case 0: return renderWelcome();
            case 1: return renderPersonaStep();
            case 2: return renderTaskViewStep();
            case 3: return renderUncertaintyStep();
            case 4: return renderIncompletionStep();
            case 5: return renderUserNoteStep();
            default: return null;
        }
    };

    const nextButtonLabel = useMemo(() => {
        if (step === 0) return t('onboarding.getStarted', 'Get Started');
        if (step === TOTAL_STEPS - 1) return t('onboarding.start');
        return t('onboarding.next');
    }, [step, t]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-white to-grey-ultra-light dark:from-neutral-900 dark:to-neutral-950">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none" style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
                backgroundSize: '24px 24px'
            }} />

            <div className="w-full max-w-sm mx-auto p-6 relative">
                {renderStepIndicator()}

                {/* Content Container */}
                <div className="mb-8 min-h-[320px] flex flex-col justify-center">
                    <AnimatePresence mode="wait" initial={false}>
                        {renderCurrentStep()}
                    </AnimatePresence>
                </div>

                {/* Navigation */}
                <div className="flex gap-2.5 animate-in fade-in duration-500 delay-100 fill-mode-backwards">
                    {step > 0 && (
                        <Button
                            variant="ghost"
                            onClick={handleBack}
                            className="flex-1 h-11"
                            icon="arrow-left"
                            iconProps={{ size: 16 }}
                        >
                            {t('onboarding.back')}
                        </Button>
                    )}
                    <Button
                        variant="primary"
                        onClick={handleNext}
                        className={twMerge("h-11", step === 0 ? "w-full" : "flex-1")}
                    >
                        {nextButtonLabel}
                    </Button>
                </div>

                {/* Skip All */}
                <button
                    onClick={handleSkipAll}
                    className="w-full mt-4 p-2 text-center text-xs text-grey-medium dark:text-neutral-500 hover:text-grey-dark dark:hover:text-neutral-400 transition-colors animate-in fade-in duration-500 delay-200 fill-mode-backwards"
                >
                    {t('onboarding.skipAll')}
                </button>
            </div>
        </div>
    );
};
