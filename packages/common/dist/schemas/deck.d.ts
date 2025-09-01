import { z } from "zod";
export declare const DeckSlide: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    purpose: z.ZodOptional<z.ZodString>;
    key_points: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    visuals: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    data_requirements: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    open_questions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: string;
    key_points: string[];
    visuals: string[];
    data_requirements: string[];
    open_questions: string[];
    title?: string | undefined;
    purpose?: string | undefined;
}, {
    id: string;
    type: string;
    title?: string | undefined;
    purpose?: string | undefined;
    key_points?: string[] | undefined;
    visuals?: string[] | undefined;
    data_requirements?: string[] | undefined;
    open_questions?: string[] | undefined;
}>;
export declare const DeckSchema: z.ZodObject<{
    deck_meta: z.ZodObject<{
        project_name: z.ZodString;
        language: z.ZodDefault<z.ZodString>;
        target_audience: z.ZodOptional<z.ZodString>;
        assumptions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        project_name: string;
        language: string;
        assumptions: string[];
        target_audience?: string | undefined;
    }, {
        project_name: string;
        language?: string | undefined;
        target_audience?: string | undefined;
        assumptions?: string[] | undefined;
    }>;
    slides: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        purpose: z.ZodOptional<z.ZodString>;
        key_points: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        visuals: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        data_requirements: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        open_questions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: string;
        key_points: string[];
        visuals: string[];
        data_requirements: string[];
        open_questions: string[];
        title?: string | undefined;
        purpose?: string | undefined;
    }, {
        id: string;
        type: string;
        title?: string | undefined;
        purpose?: string | undefined;
        key_points?: string[] | undefined;
        visuals?: string[] | undefined;
        data_requirements?: string[] | undefined;
        open_questions?: string[] | undefined;
    }>, "many">;
    missing_info_questions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    warnings: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    deck_meta: {
        project_name: string;
        language: string;
        assumptions: string[];
        target_audience?: string | undefined;
    };
    slides: {
        id: string;
        type: string;
        key_points: string[];
        visuals: string[];
        data_requirements: string[];
        open_questions: string[];
        title?: string | undefined;
        purpose?: string | undefined;
    }[];
    missing_info_questions: string[];
    warnings: string[];
}, {
    deck_meta: {
        project_name: string;
        language?: string | undefined;
        target_audience?: string | undefined;
        assumptions?: string[] | undefined;
    };
    slides: {
        id: string;
        type: string;
        title?: string | undefined;
        purpose?: string | undefined;
        key_points?: string[] | undefined;
        visuals?: string[] | undefined;
        data_requirements?: string[] | undefined;
        open_questions?: string[] | undefined;
    }[];
    missing_info_questions?: string[] | undefined;
    warnings?: string[] | undefined;
}>;
export type Deck = z.infer<typeof DeckSchema>;
