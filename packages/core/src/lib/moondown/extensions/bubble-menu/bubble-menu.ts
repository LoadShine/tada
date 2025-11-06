import { EditorView, ViewUpdate, type PluginValue } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { createIcons, icons } from 'lucide';
import { createPopper, type Instance as PopperInstance, type VirtualElement } from '@popperjs/core';
import type { BubbleMenuItem } from "./types";
import { bubbleMenuField, showBubbleMenu } from "./fields";
import {
    isHeaderActive,
    isInlineStyleActive,
    isListActive,
    setHeader,
    toggleInlineStyle,
    toggleList
} from "./content-functions";
import { CSS_CLASSES, ICON_SIZES, POPPER_CONFIG, MARKDOWN_MARKERS } from "../../core";
import { createElement, createIconElement } from "../../core";
import { isMarkdownImage } from "../../core";

/**
 * BubbleMenu - A floating toolbar that appears on text selection
 * Provides quick access to formatting options like bold, italic, headings, etc.
 */

export class BubbleMenu implements PluginValue {
    private dom: HTMLElement;
    private items: BubbleMenuItem[];
    private view: EditorView;
    private popper: PopperInstance | null;
    private boundHandleMouseUp: (e: MouseEvent) => void;

    constructor(view: EditorView) {
        this.view = view;
        this.dom = createElement('div', CSS_CLASSES.BUBBLE_MENU);
        this.items = this.createItems();
        this.buildMenu();
        document.body.appendChild(this.dom);
        this.popper = null;
        this.boundHandleMouseUp = this.handleMouseUp.bind(this);
        document.addEventListener('mouseup', this.boundHandleMouseUp);
    }

    update(update: ViewUpdate): void {
        const menu = update.state.field(bubbleMenuField);
        if (!menu) {
            this.hide();
            return;
        }

        const { from, to } = update.state.selection.main;
        if (from === to || this.isImageSelection(update.state, from, to)) {
            this.hide();
            return;
        }

        this.show(from, to);
    }

    destroy(): void {
        this.destroyPopper();
        this.dom.remove();
        document.removeEventListener('mouseup', this.boundHandleMouseUp);
    }

    /**
     * Checks if the current selection is an image markdown
     */
    private isImageSelection(state: EditorState, from: number, to: number): boolean {
        const selectedText = state.sliceDoc(from, to);
        return isMarkdownImage(selectedText);
    }

    /**
     * Hides the bubble menu
     */
    private hide(): void {
        this.dom.style.display = 'none';
        this.destroyPopper();
    }

    /**
     * Destroys the Popper instance
     */
    private destroyPopper(): void {
        if (this.popper) {
            this.popper.destroy();
            this.popper = null;
        }
    }

    /**
     * Shows the bubble menu at the selection position
     */
    private show(from: number, to: number): void {
        requestAnimationFrame(() => {
            this.dom.style.display = 'flex';

            const startPos = this.view.coordsAtPos(from);
            const endPos = this.view.coordsAtPos(to);

            if (!startPos || !endPos) return;

            const virtualElement: VirtualElement = {
                getBoundingClientRect: (): DOMRect => {
                    return {
                        width: endPos.left - startPos.left,
                        height: startPos.bottom - startPos.top,
                        top: startPos.top,
                        right: endPos.right,
                        bottom: startPos.bottom,
                        left: startPos.left,
                        x: startPos.left,
                        y: startPos.top,
                        toJSON: () => {
                            return {
                                width: endPos.left - startPos.left,
                                height: startPos.bottom - startPos.top,
                                top: startPos.top,
                                right: endPos.right,
                                bottom: startPos.bottom,
                                left: startPos.left,
                                x: startPos.left,
                                y: startPos.top,
                            };
                        }
                    };
                }
            };

            this.destroyPopper();

            this.popper = createPopper(virtualElement, this.dom, {
                placement: POPPER_CONFIG.PLACEMENT as any,
                modifiers: [
                    {
                        name: 'offset',
                        options: {
                            offset: POPPER_CONFIG.OFFSET,
                        },
                    },
                ],
            });

            // Update active states for menu items
            this.updateActiveStates();

            // Force update Popper position
            this.popper.update();
        });
    }

    /**
     * Updates the active state of all menu items
     */
    private updateActiveStates(): void {
        this.items.forEach(item => {
            // Update main menu item state
            if (item.isActive) {
                const button = this.dom.querySelector(
                    `[data-name="${item.name}"]`
                ) as HTMLButtonElement;
                if (button) {
                    button.classList.toggle(
                        CSS_CLASSES.BUBBLE_MENU_ACTIVE,
                        item.isActive(this.view.state)
                    );
                }
            }

            // Update submenu item states
            if (item.subItems) {
                item.subItems.forEach(subItem => {
                    if (subItem.isActive) {
                        const subButton = this.dom.querySelector(
                            `[data-name="${subItem.name}"][data-parent="${item.name}"]`
                        ) as HTMLButtonElement;

                        if (subButton) {
                            const isActive = subItem.isActive(this.view.state);
                            subButton.classList.toggle(
                                CSS_CLASSES.BUBBLE_MENU_ACTIVE,
                                isActive
                            );
                        }
                    }
                });
            }
        });
    }

    /**
     * Handles mouse up event to show/hide the menu
     */
    private handleMouseUp(_event: MouseEvent): void {
        const { state } = this.view;
        const { from, to } = state.selection.main;

        if (from !== to && !this.isImageSelection(state, from, to)) {
            this.view.dispatch({
                effects: showBubbleMenu.of({ pos: Math.max(from, to), items: this.items })
            });
        } else {
            this.hide();
        }
    }

    /**
     * Clears selection and refocuses editor
     */
    private clearSelectionAndFocus(): void {
        // Use requestAnimationFrame to ensure DOM updates are complete
        requestAnimationFrame(() => {
            const currentPos = this.view.state.selection.main.head;
            this.view.dispatch({
                selection: { anchor: currentPos, head: currentPos },
            });
            this.view.focus();
        });
    }

    /**
     * Creates the menu item configuration
     */
    private createItems(): BubbleMenuItem[] {
        return [
            {
                name: 'Heading',
                icon: 'Heading',
                type: 'dropdown',
                subItems: [
                    {
                        name: 'H1',
                        icon: 'Heading1',
                        action: view => setHeader(view, 1),
                        isActive: state => isHeaderActive(state, 1),
                    },
                    {
                        name: 'H2',
                        icon: 'Heading2',
                        action: view => setHeader(view, 2),
                        isActive: state => isHeaderActive(state, 2),
                    },
                    {
                        name: 'H3',
                        icon: 'Heading3',
                        action: view => setHeader(view, 3),
                        isActive: state => isHeaderActive(state, 3),
                    },
                ]
            },
            {
                name: 'List',
                icon: 'List',
                type: 'dropdown',
                subItems: [
                    {
                        name: 'Ordered List',
                        // @ts-expect-error - lucide icon name
                        icon: 'list-ordered',
                        action: view => toggleList(view, true),
                        isActive: state => isListActive(state, true),
                    },
                    {
                        name: 'Unordered List',
                        icon: 'List',
                        action: view => toggleList(view, false),
                        isActive: state => isListActive(state, false),
                    },
                ]
            },
            {
                name: 'bold',
                icon: "Bold",
                type: 'button',
                action: view => toggleInlineStyle(view, MARKDOWN_MARKERS.BOLD),
                isActive: state => isInlineStyleActive(state, MARKDOWN_MARKERS.BOLD),
            },
            {
                name: 'italic',
                icon: "Italic",
                type: 'button',
                action: view => toggleInlineStyle(view, MARKDOWN_MARKERS.ITALIC),
                isActive: state => isInlineStyleActive(state, MARKDOWN_MARKERS.ITALIC),
            },
            {
                name: 'Decoration',
                icon: 'Paintbrush',
                type: 'dropdown',
                subItems: [
                    {
                        name: 'highlight',
                        icon: "Highlighter",
                        action: view => toggleInlineStyle(view, MARKDOWN_MARKERS.HIGHLIGHT),
                        isActive: state => isInlineStyleActive(state, MARKDOWN_MARKERS.HIGHLIGHT),
                    },
                    {
                        name: 'Strikethrough',
                        icon: 'Strikethrough',
                        action: view => toggleInlineStyle(view, MARKDOWN_MARKERS.STRIKETHROUGH),
                        isActive: state => isInlineStyleActive(state, MARKDOWN_MARKERS.STRIKETHROUGH),
                    },
                    {
                        name: 'Underline',
                        icon: 'Underline',
                        action: view => toggleInlineStyle(view, MARKDOWN_MARKERS.UNDERLINE),
                        isActive: state => isInlineStyleActive(state, MARKDOWN_MARKERS.UNDERLINE),
                    },
                    {
                        name: 'Inline Code',
                        icon: 'Code',
                        action: view => toggleInlineStyle(view, MARKDOWN_MARKERS.INLINE_CODE),
                        isActive: state => isInlineStyleActive(state, MARKDOWN_MARKERS.INLINE_CODE),
                    },
                ]
            }
        ];
    }

    /**
     * Builds the DOM structure for the menu
     */
    private buildMenu(): void {
        this.dom.innerHTML = '';

        this.items.forEach(item => {
            const button = createElement('button', CSS_CLASSES.BUBBLE_MENU_ITEM, {
                'data-name': item.name,
                'data-type': item.type || 'button',
                'title': item.name,
            });

            const iconWrapper = createIconElement(item.icon, 'cm-bubble-menu-icon');
            button.appendChild(iconWrapper);

            if (item.type === 'dropdown') {
                const dropdownIcon = createIconElement('chevron-down', 'cm-bubble-menu-dropdown-icon');
                button.appendChild(dropdownIcon);

                const dropdown = createElement('div', CSS_CLASSES.BUBBLE_MENU_DROPDOWN);

                item.subItems?.forEach(subItem => {
                    const subButton = createElement('button', CSS_CLASSES.BUBBLE_MENU_SUB_ITEM, {
                        'data-name': subItem.name,
                        'data-parent': item.name,
                    });

                    if (subItem.icon) {
                        const subIconWrapper = createIconElement(subItem.icon, 'cm-bubble-menu-sub-icon');
                        subButton.appendChild(subIconWrapper);
                    }

                    const subLabel = createElement('span', 'cm-bubble-menu-sub-label');
                    subLabel.textContent = subItem.name;
                    subButton.appendChild(subLabel);

                    subButton.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await subItem.action(this.view);
                        this.hide();
                        this.clearSelectionAndFocus();
                    });

                    dropdown.appendChild(subButton);
                });

                button.appendChild(dropdown);
            } else if (item.action) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    item.action!(this.view);
                    this.hide();
                    this.clearSelectionAndFocus();
                });
            }

            this.dom.appendChild(button);
        });

        // Initialize Lucide icons after DOM update
        setTimeout(() => {
            createIcons({
                icons,
                attrs: ICON_SIZES.MEDIUM,
            });
        }, 0);
    }
}