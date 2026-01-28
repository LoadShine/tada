import {EditorView, ViewUpdate, type PluginValue} from "@codemirror/view";
import {EditorState} from "@codemirror/state";
import {createIcons, icons} from 'lucide';
import {createPopper, type Instance as PopperInstance, type VirtualElement} from '@popperjs/core';
import type {BubbleMenuItem} from "./types";
import {bubbleMenuField, showBubbleMenu} from "./fields";
import {
    isHeaderActive,
    isInlineStyleActive,
    isListActive,
    setHeader,
    toggleInlineStyle,
    toggleList
} from "./content-functions";
import {CSS_CLASSES, ICON_SIZES, POPPER_CONFIG, MARKDOWN_MARKERS} from "../../core";
import {createElement, createIconElement} from "../../core";
import {isMarkdownImage} from "../../core";
import {AIPolishPanel} from "./ai-polish-panel";
import type {AISettings} from '@/types';
import storageManager from '@/services/storageManager';

export class BubbleMenu implements PluginValue {
    private dom: HTMLElement;
    private items: BubbleMenuItem[];
    private view: EditorView;
    private popper: PopperInstance | null;
    private boundHandleMouseUp: (e: MouseEvent) => void;
    private aiPolishPanel: AIPolishPanel | null = null;

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

        const {from, to} = update.state.selection.main;
        if (from === to || this.isImageSelection(update.state, from, to)) {
            this.hide();
            return;
        }

        this.show(from, to);
    }

    destroy(): void {
        this.destroyPopper();
        this.destroyAIPolishPanel();
        this.dom.remove();
        document.removeEventListener('mouseup', this.boundHandleMouseUp);
    }

    private isImageSelection(state: EditorState, from: number, to: number): boolean {
        const selectedText = state.sliceDoc(from, to);
        return isMarkdownImage(selectedText);
    }

    private hide(): void {
        this.dom.style.display = 'none';
        this.destroyPopper();
    }

    private destroyPopper(): void {
        if (this.popper) {
            this.popper.destroy();
            this.popper = null;
        }
    }

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

            this.updateActiveStates();
            this.popper.update();
        });
    }

    private updateActiveStates(): void {
        this.items.forEach(item => {
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

    private clearSelectionAndFocus(): void {
        requestAnimationFrame(() => {
            const currentPos = this.view.state.selection.main.head;
            this.view.dispatch({
                selection: { anchor: currentPos, head: currentPos },
            });
            this.view.focus();
        });
    }

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
                        icon: 'ListOrdered',
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
            },
            {
                name: 'AI Polish',
                icon: 'Sparkles',
                type: 'button',
                action: view => this.handleAIPolish(view),
            }
        ];
    }

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

        setTimeout(() => {
            createIcons({
                icons,
                attrs: ICON_SIZES.MEDIUM,
            });
        }, 0);
    }

    private handleAIPolish(view: EditorView): boolean {
        const {from, to} = view.state.selection.main;
        const selectedText = view.state.sliceDoc(from, to);

        if (!selectedText.trim()) {
            return false;
        }

        const storage = storageManager.get();
        const settings = storage.fetchSettings();
        const aiSettings = settings?.ai;

        if (!aiSettings || !aiSettings.model) {
            alert('Please configure AI settings first in the application settings.');
            return false;
        }

        this.destroyAIPolishPanel();

        this.aiPolishPanel = new AIPolishPanel({
            selectedText,
            from,
            to,
            view,
            onClose: () => {
                this.destroyAIPolishPanel();
            },
            onInsert: (polishedText: string) => {
                view.dispatch({
                    changes: {from, to, insert: polishedText},
                    selection: {anchor: from + polishedText.length}
                });
                view.focus();
            },
            aiSettings: aiSettings as AISettings
        });

        this.positionAIPolishPanel();

        document.body.appendChild(this.aiPolishPanel.getDOM());
        return true;
    }

    private positionAIPolishPanel(): void {
        if (!this.aiPolishPanel) return;

        requestAnimationFrame(() => {
            const panelDOM = this.aiPolishPanel!.getDOM();
            const menuRect = this.dom.getBoundingClientRect();

            panelDOM.style.top = `${menuRect.bottom + 12}px`;
            panelDOM.style.left = `${menuRect.left}px`;
        });
    }

    private destroyAIPolishPanel(): void {
        if (this.aiPolishPanel) {
            this.aiPolishPanel.destroy();
            this.aiPolishPanel = null;
        }
    }
}