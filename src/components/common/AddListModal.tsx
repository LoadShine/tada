// src/components/common/AddListModal.tsx
import React, {useCallback, useRef, useState} from 'react';
import {useAtom} from 'jotai';
import {isAddListModalOpenAtom, userListNamesAtom} from '@/store/atoms';
import Button from './Button';
import {twMerge} from 'tailwind-merge';
import * as Dialog from '@radix-ui/react-dialog';

interface AddListModalProps {
    onAdd: (listName: string) => void;
}

const AddListModal: React.FC<AddListModalProps> = ({onAdd}) => {
    const [isOpen, setIsOpen] = useAtom(isAddListModalOpenAtom);
    const [allListNames] = useAtom(userListNamesAtom);
    const [listName, setListName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Use Radix's onOpenChange for closing logic
    const handleOpenChange = useCallback((open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setListName('');
            setError(null);
        }
    }, [setIsOpen]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = listName.trim();
        if (!trimmedName) {
            setError("List name cannot be empty.");
            inputRef.current?.focus();
            return;
        }
        const lowerTrimmedName = trimmedName.toLowerCase();
        if (allListNames.some(name => name.toLowerCase() === lowerTrimmedName)) {
            setError(`List "${trimmedName}" already exists.`);
            inputRef.current?.select();
            return;
        }
        const reservedNames = ['inbox', 'trash', 'archive', 'all', 'today', 'next 7 days', 'completed', 'later', 'nodate', 'overdue'];
        if (reservedNames.includes(lowerTrimmedName)) {
            setError(`"${trimmedName}" is a reserved system name.`);
            inputRef.current?.select();
            return;
        }
        setError(null);
        onAdd(trimmedName);
        handleOpenChange(false); // Close modal on success
    }, [listName, allListNames, onAdd, handleOpenChange]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setListName(e.target.value);
        if (error) setError(null);
    }, [error]);

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-black/60 backdrop-blur-xl z-40 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                        "bg-glass-100 backdrop-blur-xl w-full max-w-sm rounded-xl shadow-strong overflow-hidden border border-black/10",
                        "flex flex-col",
                        "data-[state=open]:animate-contentShow", "data-[state=closed]:animate-contentHide"
                    )}
                    onEscapeKeyDown={() => handleOpenChange(false)}
                    aria-describedby={undefined}
                >
                    {/* Header */}
                    <div
                        className="px-4 py-3 border-b border-black/10 flex justify-between items-center flex-shrink-0 bg-glass-alt-100 backdrop-blur-lg">
                        <Dialog.Title className="text-base font-semibold text-gray-800">
                            Create New List
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" icon="x"
                                    className="text-muted-foreground hover:bg-black/15 w-7 h-7 -mr-1"
                                    aria-label="Close modal"/>
                        </Dialog.Close>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-5 space-y-4">
                        <div>
                            <label htmlFor="listNameInput"
                                   className="block text-xs font-medium text-muted-foreground mb-1.5"> List
                                Name </label>
                            <input ref={inputRef} id="listNameInput" type="text" value={listName}
                                   onChange={handleInputChange} placeholder="e.g., Groceries, Project X"
                                   className={twMerge("w-full h-9 px-3 text-sm bg-glass-inset-100 backdrop-blur-md border rounded-md focus:border-primary/50 focus:ring-1 focus:ring-primary/30 placeholder:text-muted shadow-inner", error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-black/10', "focus:bg-glass-inset-200")}
                                   required aria-required="true" aria-invalid={!!error}
                                   aria-describedby={error ? "listNameError" : undefined}/>
                            {error && <p id="listNameError" className="text-xs text-red-600 mt-1.5">{error}</p>}
                        </div>
                        <div className="flex justify-end space-x-2 pt-2">
                            <Dialog.Close asChild>
                                <Button variant="glass" size="md"> Cancel </Button>
                            </Dialog.Close>
                            <Button type="submit" variant="primary" size="md"
                                    disabled={!listName.trim() || !!error}> Create List </Button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
AddListModal.displayName = 'AddListModal';
export default AddListModal;