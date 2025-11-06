import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { createIcons, icons } from 'lucide';
import { slashCommandState, toggleSlashCommand } from "./fields";
import { type SlashCommandOption, slashCommands } from "./commands";
import { CSS_CLASSES, ICON_SIZES, TIMING } from "../../core/constants";
import { createElement, createIconElement, debounce, scrollIntoView as scrollElementIntoView } from "../../core/utils/dom-utils";
import {translationsState} from "../default-extensions";
import {MoondownTranslations} from "../../core";

/**
 * SlashCommandPlugin - Implements the slash command menu functionality
 * Provides quick insertion of markdown elements via "/" trigger
 */

export const slashCommandPlugin = ViewPlugin.fromClass(class {
    private menu: HTMLElement;
    private debounceTimer: number | null = null;
    private currentAbortController: AbortController | null = null;
    private debouncedUpdate: (update: ViewUpdate) => void;

    constructor(view: EditorView) {
        this.menu = createElement('div', CSS_CLASSES.SLASH_COMMAND_MENU);
        view.dom.appendChild(this.menu);

        // Create debounced update function
        this.debouncedUpdate = debounce(
            (update: ViewUpdate) => this.updateMenu(update),
            TIMING.DEBOUNCE_DELAY
        );

        // Add click event listener to the editor
        view.dom.addEventListener('click', () => {
            this.abortAIContinuation();
        });

        // Close menu on outside clicks
        document.addEventListener('click', (e) => {
            if (!this.menu.contains(e.target as Node) && !view.dom.contains(e.target as Node)) {
                view.dispatch({
                    effects: toggleSlashCommand.of(false)
                });
                this.abortAIContinuation();
            }
        });
    }

    update(update: ViewUpdate): void {
        this.debouncedUpdate(update);
    }

    /**
     * Updates the menu position and content
     */
    private updateMenu(update: ViewUpdate): void {
        const state = update.state.field(slashCommandState);
        const translations = update.state.field(translationsState);

        if (!state.active) {
            this.hide();
            return;
        }

        this.show();

        requestAnimationFrame(() => {
            const pos = update.view.coordsAtPos(state.pos);
            if (pos) {
                const editorRect = update.view.dom.getBoundingClientRect();
                const menuRect = this.menu.getBoundingClientRect();

                // Position menu above or below cursor based on available space
                if (pos.top + menuRect.height > editorRect.bottom) {
                    // Position above cursor
                    this.menu.style.top = `${pos.top - editorRect.top - menuRect.height}px`;
                } else {
                    // Position below cursor
                    this.menu.style.top = `${pos.top - editorRect.top + 20}px`;
                }

                this.menu.style.left = `${pos.left - editorRect.left}px`;
            }
        });

        const filteredCommands = this.filterCommands(state.filterText, translations);

        this.renderCommands(filteredCommands, state.selectedIndex, update.view, state.pos, translations);
    }

    /**
     * Filters commands based on search text
     */
    private filterCommands(filterText: string, translations: MoondownTranslations): SlashCommandOption[] {
        return slashCommands.filter(cmd => {
                const title = translations[cmd.titleKey] || cmd.titleKey;
                return title.toLowerCase().includes(filterText.toLowerCase())
            }
        );
    }

    /**
     * Renders the command list
     */
    private renderCommands(
        commands: SlashCommandOption[],
        selectedIndex: number,
        view: EditorView,
        pos: number,
        translations: MoondownTranslations
    ): void {
        requestAnimationFrame(() => {
            const fragment = document.createDocumentFragment();

            commands.forEach((cmd, index) => {
                if (cmd.titleKey === "divider") {
                    const divider = createElement("hr", CSS_CLASSES.SLASH_COMMAND_DIVIDER);
                    fragment.appendChild(divider);
                    return;
                }

                const isSelected = index === selectedIndex;
                const itemClass = `${CSS_CLASSES.SLASH_COMMAND_ITEM} ${
                    isSelected ? CSS_CLASSES.SLASH_COMMAND_SELECTED : ''
                }`;
                const item = createElement("div", itemClass);
                const titleText = translations[cmd.titleKey] || cmd.titleKey;

                const icon = createIconElement(cmd.icon, "cm-slash-command-icon");
                const title = createElement("span", "cm-slash-command-title");
                title.textContent = titleText;

                item.appendChild(icon);
                item.appendChild(title);

                item.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.executeCommand(view, cmd, pos);
                });

                fragment.appendChild(item);
            });

            this.menu.innerHTML = '';
            this.menu.appendChild(fragment);

            // Initialize Lucide icons
            createIcons({
                icons,
                attrs: ICON_SIZES.MEDIUM,
            });

            // Ensure selected item is visible
            this.scrollSelectedIntoView();
        });
    }

    /**
     * Scrolls the selected item into view
     */
    private scrollSelectedIntoView(): void {
        const selectedItem = this.menu.querySelector(
            `.${CSS_CLASSES.SLASH_COMMAND_ITEM}.${CSS_CLASSES.SLASH_COMMAND_SELECTED}`
        ) as HTMLElement;

        if (selectedItem) {
            scrollElementIntoView(selectedItem, this.menu);
        }
    }

    /**
     * Executes a slash command
     */
    private executeCommand(view: EditorView, cmd: SlashCommandOption, pos: number): void {
        view.dispatch({
            changes: { from: pos, to: view.state.selection.main.from, insert: "" },
            effects: toggleSlashCommand.of(false)
        });

        const result = cmd.execute(view);
        if (result instanceof Promise) {
            result.then(controller => {
                if (controller instanceof AbortController) {
                    this.currentAbortController = controller;
                }
            });
        }

        view.focus();
    }

    /**
     * Shows the menu
     */
    private show(): void {
        this.menu.style.display = "block";
    }

    /**
     * Hides the menu
     */
    private hide(): void {
        this.menu.style.display = "none";
    }

    /**
     * Sets the current abort controller for AI operations
     */
    setCurrentAbortController(controller: AbortController): void {
        this.currentAbortController = controller;
    }

    /**
     * Clears the current abort controller
     */
    clearCurrentAbortController(): void {
        this.currentAbortController = null;
    }

    /**
     * Aborts any ongoing AI continuation
     */
    abortAIContinuation(): void {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
    }

    /**
     * Cleanup on plugin destroy
     */
    destroy(): void {
        this.menu.remove();
        this.abortAIContinuation();
    }
})