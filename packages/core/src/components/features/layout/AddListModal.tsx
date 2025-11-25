import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useAtom, useAtomValue} from 'jotai';
import {isAddListModalOpenAtom, userListNamesAtom} from '@/store/jotai.ts';
import Button from '@/components/ui/Button.tsx';
import {twMerge} from 'tailwind-merge';
import * as Dialog from '@radix-ui/react-dialog';
import {useTranslation} from "react-i18next";
import { useListOperations } from '@/hooks/useListOperations';

interface AddListModalProps {
    onAddSuccess: () => void;
}

/**
 * A modal dialog component for adding a new custom list.
 */
const AddListModal: React.FC<AddListModalProps> = ({onAddSuccess}) => {
    const {t} = useTranslation();
    const [isOpen, setIsOpen] = useAtom(isAddListModalOpenAtom);
    const allListNames = useAtomValue(userListNamesAtom);
    const [listName, setListName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { createList } = useListOperations();

    useEffect(() => {
        if (isOpen) {
            // Focus input when modal opens with a slight delay to ensure it's rendered.
            const timer = setTimeout(() => inputRef.current?.focus(), 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleOpenChange = useCallback((open: boolean) => {
        setIsOpen(open);
        if (!open) {
            // Reset state on close
            setListName('');
            setError(null);
            setIsLoading(false);
        }
    }, [setIsOpen]);

    /**
     * Handles the form submission to create a new list.
     * Validates the list name for emptiness, duplication, and reserved names.
     */
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = listName.trim();

        if (!trimmedName) {
            setError(t('addListModal.errorEmpty'));
            inputRef.current?.focus();
            return;
        }
        const lowerTrimmedName = trimmedName.toLowerCase();
        if ((allListNames ?? []).some(name => name.toLowerCase() === lowerTrimmedName)) {
            setError(t('addListModal.errorExists', {name: trimmedName}));
            inputRef.current?.select();
            return;
        }
        const reservedNames = ['inbox', 'trash', 'archive', 'all', 'today', 'next 7 days', 'completed', 'later', 'nodate', 'overdue'];
        if (reservedNames.includes(lowerTrimmedName)) {
            setError(t('addListModal.errorReserved', {name: trimmedName}));
            inputRef.current?.select();
            return;
        }

        setError(null);
        setIsLoading(true);

        try {
            createList({name: trimmedName});
            onAddSuccess();
            handleOpenChange(false);
        } catch (e: any) {
            setError(e.message || "Failed to create list.");
        } finally {
            setIsLoading(false);
        }

    }, [listName, allListNames, onAddSuccess, handleOpenChange, t, createList]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setListName(e.target.value);
        if (error) setError(null);
    }, [error]);

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-grey-dark/30 dark:bg-black/60 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut z-40 backdrop-blur-sm"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                        "bg-white dark:bg-neutral-800 w-full max-w-md rounded-base shadow-modal flex flex-col",
                        "data-[state=open]:animate-modalShow data-[state=closed]:animate-modalHide"
                    )}
                    style={{
                        paddingTop: '24px',
                        paddingLeft: '24px',
                        paddingRight: '24px',
                        paddingBottom: '20px'
                    }}
                    onEscapeKeyDown={() => handleOpenChange(false)}
                    aria-describedby={undefined}
                >
                    <div className="flex justify-between items-center mb-4">
                        <Dialog.Title className="text-[16px] font-normal text-grey-dark dark:text-neutral-100">
                            {t('addListModal.title')}
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" icon="x"
                                    className="text-grey-medium dark:text-neutral-400 hover:bg-grey-ultra-light dark:hover:bg-neutral-700 hover:text-grey-dark dark:hover:text-neutral-100 w-6 h-6 -mr-1"
                                    iconProps={{strokeWidth: 1.5, size: 12}}
                                    aria-label="Close modal"/>
                        </Dialog.Close>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <input
                                ref={inputRef}
                                id="listNameInput"
                                type="text"
                                value={listName}
                                onChange={handleInputChange}
                                placeholder={t('addListModal.placeholder')}
                                aria-label={t('addListModal.label')}
                                className={twMerge(
                                    "w-full h-8 px-3 text-[13px] font-light rounded-base focus:outline-none",
                                    "bg-grey-ultra-light dark:bg-neutral-700",
                                    "placeholder:text-grey-medium dark:placeholder:text-neutral-400",
                                    "text-grey-dark dark:text-neutral-100",
                                    "transition-colors duration-200 ease-in-out",
                                    error
                                        ? "border border-error focus:ring-1 focus:ring-error dark:border-error dark:focus:ring-error"
                                        : "border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light"
                                )}
                                required
                                aria-required="true"
                                aria-invalid={!!error}
                                aria-describedby={error ? "listNameError" : undefined}
                                disabled={isLoading}
                            />
                            {error && (
                                <p id="listNameError"
                                   className="text-[11px] text-error dark:text-red-400 mt-1.5 font-light">{error}</p>
                            )}
                        </div>
                        <div className="flex justify-end space-x-2 pt-2">
                            <Dialog.Close asChild>
                                <Button variant="secondary" size="md"> {t('common.cancel')} </Button>
                            </Dialog.Close>
                            <Button type="submit" variant="primary" size="md"
                                    disabled={!listName.trim() || !!error || isLoading}
                                    loading={isLoading}
                            > {t('addListModal.createButton')} </Button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
AddListModal.displayName = 'AddListModal';
export default AddListModal;