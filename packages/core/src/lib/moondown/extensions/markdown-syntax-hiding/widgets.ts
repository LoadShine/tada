import { EditorView, WidgetType } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";

/**
 * Base class for inline style widgets with click-to-select behavior
 */
abstract class SelectableInlineWidget extends WidgetType {
    constructor(
        protected content: string,
        protected fullText: string,
        protected start: number,
        protected className: string
    ) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        const span = document.createElement("span");
        span.className = this.className;
        span.textContent = this.content;

        span.addEventListener('mousedown', (event) => {
            event.preventDefault();
            const end = this.start + this.fullText.length;
            view.dispatch({
                selection: EditorSelection.single(this.start, end)
            });
        });

        return span;
    }

    eq(other: SelectableInlineWidget): boolean {
        return (
            other.content === this.content &&
            other.fullText === this.fullText &&
            other.start === this.start &&
            other.className === this.className
        );
    }

    ignoreEvent(event: Event): boolean {
        return event.type === 'mousedown';
    }
}

/**
 * Widget for inline code
 */
export class InlineCodeWidget extends SelectableInlineWidget {
    constructor(content: string, fullText: string, start: number) {
        super(content, fullText, start, "cm-inline-code-widget");
    }
}

/**
 * Widget for strikethrough text
 */
export class StrikethroughWidget extends SelectableInlineWidget {
    constructor(content: string, fullText: string, start: number) {
        super(content, fullText, start, "cm-strikethrough-widget");
    }
}

/**
 * Widget for highlighted text
 */
export class HighlightWidget extends SelectableInlineWidget {
    constructor(content: string, fullText: string, start: number) {
        super(content, fullText, start, "cm-highlight-widget");
    }
}

/**
 * Widget for underlined text
 */
export class UnderlineWidget extends SelectableInlineWidget {
    constructor(content: string, fullText: string, start: number) {
        super(content, fullText, start, "cm-underline-widget");
    }
}