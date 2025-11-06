import {EditorView, ViewPlugin, type PluginValue, ViewUpdate} from '@codemirror/view';

class ImagePastePlugin implements PluginValue {
    private view: EditorView;

    constructor(view: EditorView) {
        this.view = view;
        this.setupListeners();
    }

    private setupListeners() {
        this.view.dom.addEventListener('dragover', this.handleDragOver);
        this.view.dom.addEventListener('drop', this.handleDrop);
        this.view.dom.addEventListener('paste', this.handlePaste);
    }

    update(_update: ViewUpdate) {
        // This method is required but we don't need to do anything here
    }

    destroy() {
        this.view.dom.removeEventListener('dragover', this.handleDragOver);
        this.view.dom.removeEventListener('drop', this.handleDrop);
        this.view.dom.removeEventListener('paste', this.handlePaste);
    }

    private handleDragOver = (e: DragEvent) => {
        e.preventDefault();
    };

    private handleDrop = (e: DragEvent) => {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.type.startsWith('image/')) {
                    this.processImage(file, this.view.posAtCoords({x: e.clientX, y: e.clientY}));
                }
            }
        }
    };

    private handlePaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault();
                        this.processImage(file, this.view.state.selection.main.head);
                    }
                }
            }
        }
    };

    private processImage(file: File, pos: number | null) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Data = e.target?.result as string;
            if (pos !== null) {
                const markdownImage = `![${this.getFileNameWithoutExtension(file.name)}](${base64Data})`;
                const transaction = this.view.state.update({
                    changes: {from: pos, to: pos, insert: markdownImage},
                    selection: {anchor: pos + markdownImage.length},
                });
                this.view.dispatch(transaction);
            }
        };
        reader.readAsDataURL(file);
    }

    private getFileNameWithoutExtension(fileName: string): string {
        return fileName.replace(/\.[^/.]+$/, "");
    }
}

export const imageDragAndDropPlugin = ViewPlugin.fromClass(ImagePastePlugin);
