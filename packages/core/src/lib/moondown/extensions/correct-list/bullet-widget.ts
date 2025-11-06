import { WidgetType } from "@codemirror/view";

export class BulletWidget extends WidgetType {
    constructor(private className: string, private level: number, private indentation: string) {
        super();
    }

    toDOM() {
        const span = document.createElement("span");
        const bulletSymbol = this.getBulletSymbol(this.level);
        span.innerHTML = `${this.indentation}<span class="bullet-symbol" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-weight: bold; transform: scale(0.6); display: inline-block;">${bulletSymbol}</span> `;
        span.className = `cm-bullet-list ${this.className}`;
        span.style.display = 'inline-block';
        return span;
    }

    private getBulletSymbol(level: number): string {
        const symbols = [
            "●",  // 实心圆 (Level 0)
            "○",  // 空心圆 (Level 1)
            "■",  // 实心方块 (Level 2)
            "□",  // 空心方块 (Level 3)
            "▶",  // 三角形 (Level 4)
            "▷"   // 空心三角形 (Level 5+)
        ];

        const symbolIndex = level % symbols.length;
        return symbols[symbolIndex];
    }

    eq(other: BulletWidget) {
        return other.className === this.className &&
            other.level === this.level &&
            other.indentation === this.indentation;
    }
}