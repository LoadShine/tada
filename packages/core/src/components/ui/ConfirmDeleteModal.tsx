import React, {useCallback} from 'react';
import Button from './Button';
import {twMerge} from 'tailwind-merge';
import * as Dialog from '@radix-ui/react-dialog';
import {useTranslation} from "react-i18next";

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    itemTitle: string;
    title?: string;
    description?: string;
    confirmText?: string;
    confirmVariant?: 'danger' | 'primary' | 'secondary';
}

const ConfirmDeleteModalRadix: React.FC<ConfirmDeleteModalProps> = ({
                                                                        isOpen, onClose, onConfirm, itemTitle,
                                                                        title,
                                                                        description,
                                                                        confirmText,
                                                                        confirmVariant = 'danger',
                                                                    }) => {
    const {t} = useTranslation();
    const handleOpenChange = useCallback((open: boolean) => {
        if (!open) onClose();
    }, [onClose]);
    const handleConfirmClick = useCallback(() => {
        onConfirm();
    }, [onConfirm]);

    const finalTitle = title ?? t('confirmDeleteModal.title');
    const finalDescription = description ?? t('confirmDeleteModal.description', {itemTitle: itemTitle || 'this item'});
    const finalConfirmText = confirmText ?? t('confirmDeleteModal.confirmText');

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-grey-dark/30 dark:bg-black/60 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut z-50 backdrop-blur-sm"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60]",
                        "bg-white dark:bg-neutral-800 w-full max-w-sm rounded-base shadow-modal flex flex-col p-6",
                        "data-[state=open]:animate-modalShow data-[state=closed]:animate-modalHide"
                    )}
                    onEscapeKeyDown={onClose}
                >
                    <Dialog.Title
                        className="text-[16px] font-normal text-grey-dark dark:text-neutral-100 mb-2 text-center">
                        {finalTitle}
                    </Dialog.Title>
                    <Dialog.Description
                        className="text-[13px] font-light text-grey-medium dark:text-neutral-300 text-center mb-6">
                        {finalDescription}
                    </Dialog.Description>
                    <div className="flex justify-center space-x-3 mt-auto">
                        <Dialog.Close asChild>
                            <Button variant="secondary" size="md" className="flex-1"> {t('common.cancel')} </Button>
                        </Dialog.Close>
                        <Button variant={confirmVariant} size="md" onClick={handleConfirmClick} className="flex-1"
                                autoFocus> {finalConfirmText} </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
ConfirmDeleteModalRadix.displayName = 'ConfirmDeleteModalRadix';
export default ConfirmDeleteModalRadix;