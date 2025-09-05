import { z } from "zod";

// GTM Phase 1 (DATA) - Minimal Schema für strukturierte Daten
export const GTM_DATA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    assumptions: {
      type: "array",
      items: { type: "string" },
      description: "Key assumptions underlying the GTM strategy",
    },
    channels: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          budget_monthly: { type: "number" },
          expected_cac: { type: "number" },
          expected_mql: { type: "number" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
    funnel: {
      type: "object",
      properties: {
        visitors: { type: "number" },
        mql: { type: "number" },
        sql: { type: "number" },
        wins: { type: "number" },
        conv_rates: {
          type: "object",
          properties: {
            visit_mql: { type: "number" },
            mql_sql: { type: "number" },
            sql_win: { type: "number" },
          },
          additionalProperties: false,
        },
      },
      required: ["visitors", "mql", "sql", "wins"],
      additionalProperties: false,
    },
    milestones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          month: { type: "integer" },
          impact_mrr: { type: "number" },
        },
        required: ["name", "month"],
        additionalProperties: false,
      },
    },
    citations: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["channels", "funnel"],
  additionalProperties: false,
} as const;

// GTM Phase 2 (TEXT) - Minimal Schema für Narrative
export const GTM_TEXT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: {
      type: "string",
      description: "Main headline for the GTM section",
    },
    bullets: {
      type: "array",
      items: { type: "string" },
      description: "Key bullet points for GTM strategy",
    },
    narrative: {
      type: "string",
      description: "Detailed narrative text explaining the GTM approach",
    },
    citations: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["headline", "bullets", "narrative"],
  additionalProperties: false,
} as const;

// Zod schemas for runtime validation (optional)
export const GTMDataZod = z.object({
  assumptions: z.array(z.string()).optional(),
  channels: z.array(
    z.object({
      name: z.string(),
      budget_monthly: z.number().optional(),
      expected_cac: z.number().optional(),
      expected_mql: z.number().optional(),
    }),
  ),
  funnel: z.object({
    visitors: z.number(),
    mql: z.number(),
    sql: z.number(),
    wins: z.number(),
    conv_rates: z
      .object({
        visit_mql: z.number(),
        mql_sql: z.number(),
        sql_win: z.number(),
      })
      .optional(),
  }),
  milestones: z
    .array(
      z.object({
        name: z.string(),
        month: z.number().int(),
        impact_mrr: z.number().optional(),
      }),
    )
    .optional(),
  citations: z.array(z.string()).optional(),
});

export const GTMTextZod = z.object({
  headline: z.string(),
  bullets: z.array(z.string()),
  narrative: z.string(),
  citations: z.array(z.string()).optional(),
});

export type GTMData = z.infer<typeof GTMDataZod>;
export type GTMText = z.infer<typeof GTMTextZod>;
