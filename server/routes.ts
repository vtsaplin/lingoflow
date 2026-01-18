import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { getTopics, getTopic } from "./content";
import { translate, dictionary, tts } from "./azure";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.content.listTopics.path, async (req, res) => {
    const topics = await getTopics();
    res.json(topics);
  });

  app.get(api.content.getTopic.path, async (req, res) => {
    const topic = await getTopic(req.params.id);
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
        const { text } = api.services.tts.input.parse(req.body);
        const audioBuffer = await tts(text);
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

  return httpServer;
}
