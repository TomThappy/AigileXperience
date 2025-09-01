import { z } from "zod";
export const DeckSlide = z.object({
    id: z.string(),
    type: z.string(),
    title: z.string().optional(),
    purpose: z.string().optional(),
    key_points: z.array(z.string()).default([]),
    visuals: z.array(z.string()).default([]),
    data_requirements: z.array(z.string()).default([]),
    open_questions: z.array(z.string()).default([]),
});
export const DeckSchema = z.object({
    deck_meta: z.object({
        project_name: z.string(),
        language: z.string().default("de"),
        target_audience: z.string().optional(),
        assumptions: z.array(z.string()).default([]),
    }),
    slides: z.array(DeckSlide),
    missing_info_questions: z.array(z.string()).default([]),
    warnings: z.array(z.string()).default([]),
});
