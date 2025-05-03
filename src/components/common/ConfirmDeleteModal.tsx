// src/components/common/ConfirmDeleteModal.tsx
import React, {useCallback} from 'react';
import Button from './Button';
import {twMerge} from 'tailwind-merge';
import * as Dialog from '@radix-ui/react-dialog';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    taskTitle: string;
}

const ConfirmDeleteModalRadix: React.FC<ConfirmDeleteModalProps> = ({
                                                                        isOpen,
                                                                        onClose,
                                                                        onConfirm,
                                                                        taskTitle
                                                                    }) => {
    const handleOpenChange = useCallback((open: boolean) => {
        if (!open) {
            onClose();
        }
    }, [onClose]);

    const handleConfirmClick = useCallback(() => {
        onConfirm();
    }, [onConfirm]);

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[55]",
                        "bg-glass-100 dark:bg-neutral-800/95 backdrop-blur-xl w-full max-w-sm rounded-xl shadow-strong overflow-hidden border border-black/10 dark:border-white/10",
                        "flex flex-col p-5",
                        "data-[state=open]:animate-contentShow", "data-[state=closed]:animate-contentHide"
                    )}
                    onEscapeKeyDown={onClose}
                >
                    {/* Title and Description */}
                    <Dialog.Title
                        className="text-lg font-semibold text-gray-800 dark:text-neutral-100 mb-1 text-center">
                        Move to Trash?
                    </Dialog.Title>
                    <Dialog.Description
                        className="text-sm text-muted-foreground dark:text-neutral-400 px-4 text-center mb-4">
                        Are you sure you want to move the task "{taskTitle || 'Untitled Task'}" to the Trash?
                    </Dialog.Description>

                    {/* Actions */}
                    <div className="flex justify-center space-x-3 mt-auto pt-4">
                        <Dialog.Close asChild>
                            <Button variant="glass" size="md" className="flex-1"> Cancel </Button>
                        </Dialog.Close>
                        <Button variant="danger" size="md" onClick={handleConfirmClick} className="flex-1"
                                autoFocus> Move to Trash </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
ConfirmDeleteModalRadix.displayName = 'ConfirmDeleteModalRadix';
export default ConfirmDeleteModalRadix;