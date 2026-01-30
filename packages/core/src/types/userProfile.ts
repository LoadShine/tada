/**
 * User Profile types for the onboarding flow and personalization.
 * These types define the user's persona, work reality model, and preferences
 * that are used to customize AI interactions (like Echo reports).
 */

/**
 * Persona types - represents the user's job role/category.
 * Multiple selection is allowed.
 */
export type Persona =
    | "dev"        // 技术 / 开发
    | "product"    // 产品 / 设计
    | "marketing"  // 市场 / 内容
    | "sales"      // 销售 / 商务
    | "ops"        // 运营 / 客服
    | "admin"      // 行政 / HR
    | "research"   // 数据 / 研究
    | "freelance"; // 自由职业 / 咨询

/**
 * Work Reality Model (WRM) types - three axes that define how 
 * the user prefers to view and communicate about their work.
 */

/** Axis A: How does the user prefer to view a task? */
export type TaskView = "process" | "outcome";

/** Axis B: How does the user handle uncertainty? */
export type UncertaintyTolerance = "low" | "high";

/** Axis C: How does the user prefer to report incomplete work? */
export type IncompletionStyle = "narrative" | "explicit";

/**
 * Confidence scores for each WRM axis.
 * These can be adjusted based on user behavior over time.
 */
export interface WorkRealityModelConfidence {
    taskView: number;          // default: 0.7
    uncertaintyTolerance: number;
    incompletionStyle: number;
}

/**
 * The complete Work Reality Model configuration.
 * Each axis can be null if the user skipped that selection.
 */
export interface WorkRealityModel {
    taskView: TaskView | null;
    uncertaintyTolerance: UncertaintyTolerance | null;
    incompletionStyle: IncompletionStyle | null;
    confidence: WorkRealityModelConfidence;
}

/**
 * The complete user profile containing all personalization data.
 */
export interface UserProfile {
    /** Selected persona types (multi-select), null if skipped */
    persona: Persona[] | null;
    /** Work Reality Model preferences */
    workRealityModel: WorkRealityModel;
    /** Free-text user note, null if not provided */
    userNote: string | null;
    /** Whether the onboarding flow has been completed */
    onboardingCompleted: boolean;
    /** Timestamp when profile was created */
    createdAt: number;
    /** Timestamp of last update */
    updatedAt: number;
}

/**
 * Creates a default user profile with balanced defaults.
 */
export const createDefaultUserProfile = (): UserProfile => ({
    persona: null,
    workRealityModel: {
        taskView: null,
        uncertaintyTolerance: null,
        incompletionStyle: null,
        confidence: {
            taskView: 0.7,
            uncertaintyTolerance: 0.7,
            incompletionStyle: 0.7,
        },
    },
    userNote: null,
    onboardingCompleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
});
