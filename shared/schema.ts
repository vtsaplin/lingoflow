import { z } from "zod";

// Re-export chat models for AI integrations
export * from "./models/chat";

// Content Models
export const textSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.array(z.string()), // Paragraphs
});

export const topicSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  texts: z.array(textSchema),
});

export type Topic = z.infer<typeof topicSchema>;
export type Text = z.infer<typeof textSchema>;

// API Schemas
export const ttsRequestSchema = z.object({
  text: z.string(),
  speed: z.number().min(0.25).max(4.0).optional().default(1.0),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional().default("alloy"),
});

export const translateRequestSchema = z.object({
  text: z.string(),
});

export const dictionaryRequestSchema = z.object({
  word: z.string(),
  sentence: z.string().optional(),
});

export const dictionaryResponseSchema = z.object({
  word: z.string(),
  baseForm: z.string().optional(),
  translation: z.string(),
  partOfSpeech: z.string().optional(),
  definition: z.string().optional(),
  example_de: z.string().optional(),
  example_ru: z.string().optional(),
});
