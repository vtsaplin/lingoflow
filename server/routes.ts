import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { getTopics, getTopic } from "./content";
import { translate, dictionary, tts } from "./azure";
import { registerPodcastRoutes } from "./podcast";
import { generateCombinedMp3 } from "./combined-mp3";
import { z } from "zod";
import { convertWebmToWav } from "./audio-utils";
import { transcribeWithAzureWhisper } from "./azure-whisper";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.content.listTopics.path, async (req, res) => {
    const topics = await getTopics();
    res.json(topics);
  });

  app.get(api.content.getTopic.path, async (req, res) => {
    const topic = await getTopic(req.params.id as string);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }
    res.json(topic);
  });

  app.post(api.services.translate.path, async (req, res) => {
    try {
      const { text } = api.services.translate.input.parse(req.body);
      const translation = await translate(text);
      res.json({ translation });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Translation failed" });
    }
  });

  app.post(api.services.dictionary.path, async (req, res) => {
    try {
      const { word } = api.services.dictionary.input.parse(req.body);
      const result = await dictionary(word);
      res.json(result);
    } catch (err) {
       console.error(err);
      res.status(500).json({ message: "Dictionary lookup failed" });
    }
  });

  app.post(api.services.tts.path, async (req, res) => {
    try {
        const { text, speed } = api.services.tts.input.parse(req.body);
        const audioBuffer = await tts(text, speed);
        if (!audioBuffer) {
            return res.status(500).json({ message: "TTS failed" });
        }
        res.setHeader("Content-Type", "audio/mpeg");
        res.send(audioBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "TTS failed" });
    }
  });

  registerPodcastRoutes(app);

  // Speech-to-text transcription endpoint for Speak mode
  const transcribeSchema = z.object({
    audio: z.string(), // base64 encoded audio
  });

  app.post("/api/transcribe", async (req, res) => {
    try {
      const { audio } = transcribeSchema.parse(req.body);
      
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audio, "base64");
      
      // Convert WebM to WAV (browser records in WebM format)
      const wavBuffer = await convertWebmToWav(audioBuffer);
      
      // Transcribe using Azure Whisper
      const transcript = await transcribeWithAzureWhisper(wavBuffer);
      
      res.json({ transcript });
    } catch (err) {
      console.error("Transcription failed:", err);
      res.status(500).json({ message: "Transcription failed" });
    }
  });

  const combinedMp3Schema = z.object({
    texts: z.array(z.object({
      topicId: z.string(),
      textId: z.string()
    }))
  });

  app.post("/api/download-combined-mp3", async (req, res) => {
    try {
      const { texts } = combinedMp3Schema.parse(req.body);
      
      if (texts.length === 0) {
        return res.status(400).json({ message: "No texts selected" });
      }
      
      const audioBuffer = await generateCombinedMp3(texts);
      
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename="lingoflow-${texts.length}-texts.mp3"`);
      res.setHeader("Content-Length", audioBuffer.length.toString());
      res.send(audioBuffer);
    } catch (err) {
      console.error("Combined MP3 generation failed:", err);
      res.status(500).json({ message: "Failed to generate combined MP3" });
    }
  });

  return httpServer;
}
