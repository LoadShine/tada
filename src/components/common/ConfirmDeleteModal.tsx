// src/components/common/ConfirmDeleteModal.tsx
import React, {useCallback} from 'react';
import Button from './Button';
import {twMerge} from 'tailwind-merge';
import * as Dialog from '@radix-ui/react-dialog';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    itemTitle: string; // Renamed from taskTitle for generality
    title?: string; // Optional custom title
    description?: string; // Optional custom description
    confirmText?: string; // Optional custom confirm button text
    confirmVariant?: 'danger' | 'primary' | 'secondary' | 'outline'; // Optional button variant
}

const ConfirmDeleteModalRadix: React.FC<ConfirmDeleteModalProps> = ({
                                                                        isOpen,
                                                                        onClose,
                                                                        onConfirm,
                                                                        itemTitle,
                                                                        title = "Move to Trash?", // Default title
                                                                        description, // Optional description
                                                                        confirmText = "Move to Trash", // Default confirm text
                                                                        confirmVariant = 'danger', // Default variant
                                                                    }) => {
    const handleOpenChange = useCallback((open: boolean) => {
        if (!open) {
            onClose();
        }
    }, [onClose]);

    const handleConfirmClick = useCallback(() => {
        onConfirm();
        // No need to call onClose here, as Radix Dialog's onOpenChange handles it via the Root component's state
    }, [onConfirm]);

    // Default description if not provided
    const finalDescription = description ?? `Are you sure you want to perform this action on "${itemTitle || 'this item'}"? This cannot be undone easily.`;
    const finalConfirmText = confirmText ?? "Confirm";

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60]", // Increased z-index
                        "bg-glass-100 dark:bg-neutral-800/95 backdrop-blur-xl w-full max-w-sm rounded-xl shadow-strong overflow-hidden border border-black/10 dark:border-white/10",
                        "flex flex-col p-5",
                        "data-[state=open]:animate-contentShow", "data-[state=closed]:animate-contentHide"
                    )}
                    onEscapeKeyDown={onClose}
                >
                    {/* Title and Description */}
                    <Dialog.Title
                        className="text-lg font-semibold text-gray-800 dark:text-neutral-100 mb-1 text-center">
                        {title}
                    </Dialog.Title>
                    <Dialog.Description
                        className="text-sm text-muted-foreground dark:text-neutral-400 px-4 text-center mb-4">
                        {/* Use description prop or generate default */}
                        {description ?? `Are you sure you want to ${title.toLowerCase().replace('?', '')} "${itemTitle || 'this item'}"?`}
                    </Dialog.Description>

                    {/* Actions */}
                    <div className="flex justify-center space-x-3 mt-auto pt-4">
                        <Dialog.Close asChild>
                            <Button variant="glass" size="md" className="flex-1"> Cancel </Button>
                        </Dialog.Close>
                        {/* Use confirmVariant and confirmText props */}
                        <Button variant={confirmVariant} size="md" onClick={handleConfirmClick} className="flex-1"
                                autoFocus> {confirmText} </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
ConfirmDeleteModalRadix.displayName = 'ConfirmDeleteModalRadix';
export default ConfirmDeleteModalRadix;