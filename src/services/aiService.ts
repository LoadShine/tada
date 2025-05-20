// src/services/aiService.ts
import {Subtask} from '@/types';
import {addDays, startOfDay, subDays} from '@/utils/dateUtils';

export interface AiTaskAnalysis {
    content: string;
    // Subtasks from AI can have dueDate as Date, timestamp, string or null.
    // We Omit 'dueDate' from Subtask first, then add our broader definition.
    subtasks: Array<
        Omit<Subtask, 'id' | 'parentId' | 'createdAt' | 'updatedAt' | 'completedAt' | 'completed' | 'order' | 'dueDate'> &
        { title: string; dueDate?: number | Date | string | null }
    >;
    tags: string[];
}

// 模拟调用Gemini API的函数
export const analyzeTaskWithAI = (sentence: string, taskDueDate: Date | null): Promise<AiTaskAnalysis> => {
    console.log(`AI processing: "${sentence}", Due: ${taskDueDate?.toISOString()}`);

    return new Promise((resolve) => {
        setTimeout(() => {
            let content = `Detailed plan for: ${sentence}.\n\nKey considerations:\n- Point A\n- Point B\n- Point C`;
            let subtasks: Array<Omit<Subtask, 'id' | 'parentId' | 'createdAt' | 'updatedAt' | 'completedAt' | 'completed' | 'order' | 'dueDate'> & {
                title: string;
                dueDate?: number | Date | string | null
            }> = [];
            let tags: string[] = ['ai-generated'];

            const today = startOfDay(new Date());
            // 如果用户没有为AI任务指定截止日期，则默认为从今天起3天后
            const baseDueDate = taskDueDate ? startOfDay(taskDueDate) : addDays(today, 3);

            if (sentence.toLowerCase().includes('birthday party') || sentence.toLowerCase().includes('生日派对')) {
                content = `Planning a fantastic birthday party for the occasion mentioned: "${sentence}".\n\nImportant aspects to cover:\n1. Guest List: Finalize who to invite.\n2. Venue: Book a suitable location or prepare home.\n3. Theme & Decorations: Decide on a theme and get supplies.\n4. Food & Drinks: Plan the menu and catering/shopping.\n5. Entertainment: Arrange music, games, or activities.\n6. Cake: Order or bake a birthday cake.`;
                subtasks = [
                    {
                        title: 'Finalize guest list and send invitations (确定宾客名单并发送邀请)',
                        dueDate: subDays(baseDueDate, 14)
                    },
                    {title: 'Book venue (if not at home) (预订场地)', dueDate: subDays(baseDueDate, 10)},
                    {title: 'Plan theme and buy decorations (策划主题并购买装饰品)', dueDate: subDays(baseDueDate, 7)},
                    {title: 'Order birthday cake (订购生日蛋糕)', dueDate: subDays(baseDueDate, 3)},
                    {title: 'Shop for food and drinks (购买食物和饮料)', dueDate: subDays(baseDueDate, 2)},
                    {title: 'Prepare party space and setup (准备和布置派对场地)', dueDate: baseDueDate},
                ];
                tags = ['event', 'personal', 'birthday', 'planning', 'ai-generated'];
            } else if (sentence.toLowerCase().includes('project report') || sentence.toLowerCase().includes('项目报告')) {
                content = `Outline for the project report: "${sentence}".\n\nStructure:\nI. Introduction\n   A. Project Overview\n   B. Objectives\nII. Methodology\nIII. Findings\n   A. Data Analysis\n   B. Key Results\nIV. Discussion\n   A. Interpretation of Results\n   B. Limitations\nV. Conclusion & Recommendations\nVI. Appendix (if any)`;
                subtasks = [
                    {
                        title: 'Gather all necessary data and sources (收集所有必要数据和来源)',
                        dueDate: subDays(baseDueDate, 5)
                    },
                    {
                        title: 'Draft Introduction and Methodology sections (起草引言和方法论部分)',
                        dueDate: subDays(baseDueDate, 4)
                    },
                    {
                        title: 'Analyze data and draft Findings section (分析数据并起草发现部分)',
                        dueDate: subDays(baseDueDate, 2)
                    },
                    {
                        title: 'Write Discussion, Conclusion, and Recommendations (撰写讨论、结论和建议部分)',
                        dueDate: subDays(baseDueDate, 1)
                    },
                    {title: 'Review and finalize entire report (审查并最终确定整个报告)', dueDate: baseDueDate},
                ];
                tags = ['work', 'report', 'project', 'writing', 'ai-generated'];
            } else {
                // 通用回退逻辑
                content = `Based on your request "${sentence}", here's a suggested plan:\n\n- Action Item 1: Define scope and objectives.\n- Action Item 2: Develop a timeline.\n- Action Item 3: Execute and monitor progress.`;
                subtasks = [
                    {title: `Further investigate '${sentence}' - Step 1`, dueDate: addDays(baseDueDate, 1)},
                    {title: `Develop initial plan for '${sentence}' - Step 2`, dueDate: addDays(baseDueDate, 2)},
                    {title: `Execute first part of '${sentence}' - Step 3`, dueDate: addDays(baseDueDate, 3)},
                ];
                const firstWord = sentence.split(' ')[0];
                if (firstWord) tags.push(firstWord.toLowerCase());
                tags.push('general');
            }

            resolve({content, subtasks, tags});
        }, 1500); // 模拟网络延迟
    });
};