import {type Extension} from "@codemirror/state";
import {codeBlockInputHandler, fencedCodeBackgroundPlugin} from "./fenced-code-plugin.ts";
import {languageIdentifierAutocomplete} from "./language-autocomplete.ts";

// Export plugins
export function fencedCode(): Extension{
    return [
        fencedCodeBackgroundPlugin,
        languageIdentifierAutocomplete,
        codeBlockInputHandler
    ]
}