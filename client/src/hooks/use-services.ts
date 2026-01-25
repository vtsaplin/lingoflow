import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

export type TTSVoice = "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable" | "onyx" | "nova" | "sage" | "shimmer";

export function useTTS() {
  return useMutation({
    mutationFn: async ({ text, speed = 1.0, voice = "alloy" }: { text: string; speed?: number; voice?: TTSVoice }) => {
      const validated = api.services.tts.input.parse({ text, speed, voice });
      const res = await fetch(api.services.tts.path, {
        method: api.services.tts.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      
      if (!res.ok) throw new Error("TTS failed");
      
      return await res.blob();
    },
  });
}

export function useTranslate() {
  return useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      const validated = api.services.translate.input.parse({ text });
      const res = await fetch(api.services.translate.path, {
        method: api.services.translate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) throw new Error("Translation failed");
      return api.services.translate.responses[200].parse(await res.json());
    },
  });
}

export function useDictionary() {
  return useMutation({
    mutationFn: async ({ word }: { word: string }) => {
      const validated = api.services.dictionary.input.parse({ word });
      const res = await fetch(api.services.dictionary.path, {
        method: api.services.dictionary.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) throw new Error("Dictionary lookup failed");
      return api.services.dictionary.responses[200].parse(await res.json());
    },
  });
}
