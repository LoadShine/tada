import {EditorView} from "@codemirror/view";
import {createIcons, icons} from 'lucide';
import {createElement, createIconElement} from "../../core";
import {CSS_CLASSES} from "../../core";
import type {AISettings} from '@/types';
import {streamChatCompletionForEditor} from '@/services/aiService';
import i18next from 'i18next';

export interface AIPolishPanelOptions {
    selectedText: string;
    from: number;
    to: number;
    view: EditorView;
    onClose: () => void;
    onInsert: (text: string) => void;
    aiSettings: AISettings;
}

export class AIPolishPanel {
    private dom: HTMLElement;
    private inputContainer: HTMLElement;
    private responseContainer: HTMLElement;
    private inputField: HTMLTextAreaElement;
    private sendButton: HTMLButtonElement;
    private options: AIPolishPanelOptions;
    private isGenerating: boolean = false;
    private currentResponse: string = '';
    private abortController: AbortController | null = null;
    private conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];

    constructor(options: AIPolishPanelOptions) {
        this.options = options;
        this.dom = createElement('div', CSS_CLASSES.AI_POLISH_PANEL);

        const closeBtn = this.createIconButton('x', i18next.t('moondown.ai.polish.buttons.close'), 'ai-polish-close-btn');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.options.onClose();
        });
        this.dom.appendChild(closeBtn);

        this.inputContainer = this.createInputSection();
        this.dom.appendChild(this.inputContainer);

        this.responseContainer = createElement('div', CSS_CLASSES.AI_POLISH_RESPONSE_SECTION);
        this.dom.appendChild(this.responseContainer);

        this.inputField = this.inputContainer.querySelector('textarea') as HTMLTextAreaElement;
        this.sendButton = this.inputContainer.querySelector('.ai-polish-send-btn') as HTMLButtonElement;

        setTimeout(() => this.inputField.focus(), 50);
        document.addEventListener('keydown', this.handleKeyDown);

        this.initializeIcons();
    }

    private initializeIcons(): void {
        requestAnimationFrame(() => {
            createIcons({
                icons,
                attrs: {width: '14', height: '14', "stroke-width": "2.5"},
            });
        });
    }

    private handleKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'Escape' && !this.isGenerating) {
            this.options.onClose();
        }
    };

    private createInputSection(): HTMLElement {
        const container = createElement('div', CSS_CLASSES.AI_POLISH_INPUT_SECTION);
        const wrapper = createElement('div', 'ai-polish-input-wrapper');

        const textarea = document.createElement('textarea');
        textarea.className = CSS_CLASSES.AI_POLISH_INPUT;
        textarea.placeholder = i18next.t('moondown.ai.polish.placeholder');
        textarea.rows = 1;

        textarea.addEventListener('input', () => this.adjustTextareaHeight(textarea));
        textarea.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                this.handleGenerate();
            }
        });

        wrapper.appendChild(textarea);

        const sendBtn = document.createElement('button');
        sendBtn.className = 'ai-polish-send-btn';
        sendBtn.title = `${i18next.t('moondown.ai.polish.buttons.send')} (Cmd+Enter)`;
        sendBtn.appendChild(createIconElement('arrow-up'));
        sendBtn.addEventListener('click', () => this.handleGenerate());

        wrapper.appendChild(sendBtn);
        container.appendChild(wrapper);

        const hint = createElement('div', 'ai-polish-hint');
        hint.innerHTML = `<span>${i18next.t('moondown.ai.polish.hint')}</span>`;
        container.appendChild(hint);

        return container;
    }

    private adjustTextareaHeight(textarea: HTMLTextAreaElement) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }

    private createIconButton(iconName: string, tooltip: string, extraClass: string = ''): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.className = `ai-polish-icon-btn ${extraClass}`.trim();
        btn.type = 'button';
        btn.title = tooltip;
        btn.appendChild(createIconElement(iconName));
        return btn;
    }

    private async handleGenerate(manualInstruction?: string, isRetry: boolean = false): Promise<void> {
        const instruction = manualInstruction || this.inputField.value.trim();
        if (this.isGenerating) return;

        this.isGenerating = true;
        this.currentResponse = '';

        this.dom.classList.add('is-generating');
        this.inputField.disabled = true;
        this.sendButton.disabled = true;

        if (!isRetry) {
            this.inputField.value = '';
            this.adjustTextareaHeight(this.inputField);

            const userHistoryContent = instruction || "General Polish";
            this.conversationHistory.push({ role: 'user', content: userHistoryContent });

            this.responseContainer.classList.add('visible');
            if (instruction) {
                this.appendUserBubble(instruction);
            }
        }

        const responseBubble = this.createResponseBubble();
        this.responseContainer.appendChild(responseBubble);
        const responseText = responseBubble.querySelector('.ai-polish-response-text') as HTMLElement;
        this.scrollToBottom();

        try {
            this.abortController = new AbortController();

            const systemPrompt = this.buildSystemPrompt();

            const userPrompt = this.buildUserPrompt(instruction || "Polish this text.");

            const stream = await streamChatCompletionForEditor(
                this.options.aiSettings,
                systemPrompt,
                userPrompt,
                this.abortController.signal
            );

            const reader = stream.getReader();

            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                if (value) {
                    this.currentResponse += value;
                    responseText.textContent = this.currentResponse;
                    this.scrollToBottom();
                }
            }

            this.conversationHistory.push({ role: 'assistant', content: this.currentResponse });

            this.showActionButtons(responseBubble);

        } catch (error: any) {
            if (error.name === 'AbortError') {
                responseText.textContent += ' [Cancelled]';
            } else {
                console.error('AI Polish error:', error);
                responseText.textContent = `Error: ${error.message || 'Generation failed'}`;
                responseBubble.classList.add('error');
            }
        } finally {
            this.isGenerating = false;
            this.sendButton.disabled = false;
            this.inputField.disabled = false;
            this.inputField.focus();
            this.abortController = null;
            this.dom.classList.remove('is-generating');
            this.initializeIcons();
        }
    }

    private handleRegenerate(): void {
        if (this.isGenerating) return;
        if (this.conversationHistory.length < 2) return;

        const lastIndex = this.conversationHistory.length - 1;
        const lastMsg = this.conversationHistory[lastIndex];

        if (lastMsg.role === 'assistant') {
            this.conversationHistory.pop();
            if (this.responseContainer.lastElementChild) {
                this.responseContainer.lastElementChild.remove();
            }
        }

        const userMsg = this.conversationHistory[this.conversationHistory.length - 1];
        if (userMsg && userMsg.role === 'user') {
            const retryContent = userMsg.content === "General Polish" ? "" : userMsg.content;
            this.handleGenerate(retryContent, true);
        }
    }

    private appendUserBubble(text: string): void {
        const bubble = createElement('div', 'ai-polish-user-bubble');
        bubble.textContent = text;
        this.responseContainer.appendChild(bubble);
    }

    private scrollToBottom(): void {
        if (this.responseContainer) {
            this.responseContainer.scrollTop = this.responseContainer.scrollHeight;
        }
    }

    private createResponseBubble(): HTMLElement {
        const bubble = createElement('div', CSS_CLASSES.AI_POLISH_RESPONSE_BUBBLE);
        const responseText = createElement('div', 'ai-polish-response-text');
        const typingIndicator = createElement('div', 'ai-polish-typing-indicator');
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';

        bubble.appendChild(responseText);
        bubble.appendChild(typingIndicator);
        return bubble;
    }

    private showActionButtons(bubble: HTMLElement): void {
        const typingIndicator = bubble.querySelector('.ai-polish-typing-indicator');
        if (typingIndicator) typingIndicator.remove();

        const actionBar = createElement('div', 'ai-polish-action-bar');

        const createAction = (iconName: string, label: string, onClick: () => void, isPrimary = false) => {
            const btn = document.createElement('button');
            btn.className = 'ai-polish-action-btn';
            if (isPrimary) btn.classList.add('primary-action');

            const icon = createIconElement(iconName);
            const span = document.createElement('span');
            span.textContent = label;

            btn.appendChild(icon);
            btn.appendChild(span);
            btn.onclick = onClick;
            return btn;
        };

        actionBar.appendChild(createAction('refresh-cw', i18next.t('moondown.ai.polish.buttons.retry'), () => this.handleRegenerate()));

        const copyBtn = createAction('copy', i18next.t('moondown.ai.polish.buttons.copy'), () => this.handleCopy(copyBtn));
        actionBar.appendChild(copyBtn);

        const insertBtn = createAction('check', i18next.t('moondown.ai.polish.buttons.insert'), () => this.handleInsert(), true);
        actionBar.appendChild(insertBtn);

        bubble.appendChild(actionBar);
        setTimeout(() => this.scrollToBottom(), 0);
    }

    private handleCopy(btn: HTMLButtonElement): void {
        if (this.currentResponse) {
            navigator.clipboard.writeText(this.currentResponse).then(() => {
                const originalContent = btn.innerHTML;
                const span = btn.querySelector('span');
                if (span) span.textContent = i18next.t('moondown.ai.polish.buttons.copied');

                setTimeout(() => {
                    btn.innerHTML = originalContent;
                    this.initializeIcons();
                }, 1500);
            });
        }
    }

    private handleInsert(): void {
        if (this.currentResponse) {
            this.options.onInsert(this.currentResponse);
            this.options.onClose();
        }
    }

    private buildSystemPrompt(): string {
        return `You are an expert AI Editor embedded in a Markdown editor.
Your goal is to refine the user's text based on their instructions.

### SYSTEM RULES (CRITICAL):

1. **MARKDOWN PRESERVATION**:
   - The input is Markdown. You MUST preserve all formatting (e.g., **bold**, [links](), \`code\`).
   - Do NOT wrap the output in \`\`\`markdown code blocks\`\`\`. Output raw text only.

2. **LANGUAGE CONSISTENCY**:
   - You will receive a <target_language> tag.
   - You MUST write the output in that specific language.
   - Exception: If the user explicitly asks to "Translate to English", follow the user's instruction.

3. **NO CONVERSATIONAL FILLER**:
   - Output ONLY the result.
   - Do NOT say "Here is the polished text" or "I have improved it".

4. **INSTRUCTION FOLLOWING**:
   - If <user_instruction> is empty or generic, improve grammar, flow, and clarity while keeping the original meaning.
`;
    }

    private buildUserPrompt(instruction: string): string {
        const currentLang = i18next.language || 'en';

        const targetLanguage = currentLang.startsWith('zh') ? 'Simplified Chinese' : 'English';

        let prompt = '';

        if (this.conversationHistory.length > 0) {
            prompt += '<conversation_history>\n';
            this.conversationHistory.forEach(msg => {
                prompt += `<message role="${msg.role}">\n${msg.content}\n</message>\n`;
            });
            prompt += '</conversation_history>\n\n';
        }

        prompt += `
<context_data>
    <target_language>${targetLanguage}</target_language>
    <source_text>
${this.options.selectedText}
    </source_text>
</context_data>

<user_instruction>
${instruction}
</user_instruction>

Output:`;

        return prompt;
    }

    public getDOM(): HTMLElement { return this.dom; }
    public destroy(): void {
        document.removeEventListener('keydown', this.handleKeyDown);
        if (this.abortController) this.abortController.abort();
        this.dom.remove();
    }
}