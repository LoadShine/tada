import {markdownSyntaxHidingField, syntaxHidingState} from './markdown-syntax-hiding-field';
import {highlightCleanupPlugin, referenceHighlightField} from "./highlight-effects";

export function markdownSyntaxHiding() {
    return [
        syntaxHidingState,
        markdownSyntaxHidingField,
        referenceHighlightField,
        highlightCleanupPlugin
    ];
}