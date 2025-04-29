// src/components/common/AddListDialog.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtom } from 'jotai';
import { isAddListModalOpenAtom, userListNamesAtom } from '@/store/atoms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface AddListDialogProps {
    onAdd: (listName: string) => void;
}

const AddListDialog: React.FC<AddListDialogProps> = ({ onAdd }) => {
    // Use the same atom to control visibility
    const [isOpen, setIsOpen] = useAtom(isAddListModalOpenAtom);
    const [allListNames] = useAtom(userListNamesAtom);
    const [listName, setListName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when dialog opens
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100); // Delay slightly for animation
            return () => clearTimeout(timer);
        } else {
            // Reset state when closing
            setListName('');
            setError(null);
        }
    }, [isOpen]);

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
        setIsOpen(false); // Close dialog on success
    }, [listName, allListNames, onAdd, setIsOpen]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setListName(e.target.value);
        if (error) setError(null);
    }, [error]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[425px] bg-glass-100 backdrop-blur-xl border-border/50">
                <DialogHeader>
                    <DialogTitle>Create New List</DialogTitle>
                    <DialogDescription>
                        Enter a name for your new task list.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div>
                        <Label htmlFor="listNameInput" className="sr-only">
                            List Name
                        </Label>
                        <Input
                            ref={inputRef}
                            id="listNameInput"
                            placeholder="e.g., Groceries, Project X"
                            value={listName}
                            onChange={handleInputChange}
                            className={cn(error && "border-destructive focus-visible:ring-destructive/50")}
                            aria-invalid={!!error}
                            aria-describedby={error ? "listNameError" : undefined}
                        />
                        {error && <p id="listNameError" className="text-xs text-destructive mt-1.5">{error}</p>}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="ghost">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={!listName.trim() || !!error}>
                            Create List
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
AddListDialog.displayName = 'AddListDialog';
export default AddListDialog;