import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const PrivacyPolicyPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadContent = async () => {
            try {
                setLoading(true);
                const lang = i18n.language === 'zh-CN' ? 'zh-CN' : 'en';

                const url = `${import.meta.env.BASE_URL}content/privacy-policy.${lang}.md`.replace(/\/+/g, '/');
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error('Failed to load privacy policy');
                }

                const text = await response.text();
                setContent(text);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load content');
            } finally {
                setLoading(false);
            }
        };

        loadContent();
    }, [i18n.language]);

    const BackButton = () => (
        <Button asChild variant="ghost" className="gap-2 pl-0 hover:bg-transparent hover:text-primary transition-colors">
            <Link to="/">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5" />
                    <path d="M12 19l-7-7 7-7" />
                </svg>
                {t('common.backToApp')}
            </Link>
        </Button>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-neutral-800 flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-white dark:bg-neutral-800 flex flex-col items-center justify-center p-6">
                <p className="text-grey-medium dark:text-neutral-400 mb-6">{error}</p>
                <BackButton />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-neutral-800">
            <nav className="sticky top-0 z-50 w-full px-6 py-4 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-md border-b border-transparent transition-all">
                <div className="max-w-4xl mx-auto flex items-center">
                    <BackButton />
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-6 py-8 md:py-12 animate-in fade-in duration-500">
                <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content}
                    </ReactMarkdown>
                </div>
            </main>
        </div>
    );
};

export default PrivacyPolicyPage;