import { z } from "zod";

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
});

export const translateRequestSchema = z.object({
  text: z.string(),
});

export const dictionaryRequestSchema = z.object({
  word: z.string(),
});

export const dictionaryResponseSchema = z.object({
  word: z.string(),
  translation: z.string(),
  partOfSpeech: z.string().optional(),
  definition: z.string().optional(),
  example_de: z.string().optional(),
  example_ru: z.string().optional(),
});
