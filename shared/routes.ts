import { z } from 'zod';
import { topicSchema, ttsRequestSchema, translateRequestSchema, dictionaryRequestSchema, dictionaryResponseSchema } from './schema';

export const errorSchemas = {
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  content: {
    listTopics: {
      method: 'GET' as const,
      path: '/api/topics',
      responses: {
        200: z.array(topicSchema), 
      },
    },
    getTopic: {
      method: 'GET' as const,
      path: '/api/topics/:id',
      responses: {
        200: topicSchema,
        404: errorSchemas.notFound,
      },
    }
  },
  services: {
    tts: {
      method: 'POST' as const,
      path: '/api/tts',
      input: ttsRequestSchema,
      responses: {
        200: z.any(), // Audio stream
      }
    },
    translate: {
      method: 'POST' as const,
      path: '/api/translate',
      input: translateRequestSchema,
      responses: {
        200: z.object({ translation: z.string() }),
      }
    },
    dictionary: {
      method: 'POST' as const,
      path: '/api/dictionary',
      input: dictionaryRequestSchema,
      responses: {
        200: dictionaryResponseSchema,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
