import type { Express } from "express";
import { getTopics } from "./content";
import { tts } from "./azure";
import fs from "fs/promises";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".cache", "podcast");

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function getCachePath(topicId: string, textId: string): string {
  return path.join(CACHE_DIR, `${topicId}_${textId}.mp3`);
}

async function getCachedAudio(topicId: string, textId: string): Promise<Buffer | null> {
  const cachePath = getCachePath(topicId, textId);
  try {
    return await fs.readFile(cachePath);
  } catch {
    return null;
  }
}

async function cacheAudio(topicId: string, textId: string, audio: Buffer): Promise<void> {
  await ensureCacheDir();
  const cachePath = getCachePath(topicId, textId);
  await fs.writeFile(cachePath, audio);
}

export function registerPodcastRoutes(app: Express): void {
  
  app.get("/podcast/feed.xml", async (req, res) => {
    try {
      const topics = await getTopics();
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      
      const items: string[] = [];
      
      for (const topic of topics) {
        for (const text of topic.texts) {
          const guid = `${topic.id}-${text.id}`;
          const title = `${topic.title} — ${text.title}`;
          const audioUrl = `${baseUrl}/podcast/audio/${topic.id}/${text.id}.mp3`;
          const description = text.content.slice(0, 2).join(" ").substring(0, 200);
          
          items.push(`
    <item>
      <title><![CDATA[${title}]]></title>
      <description><![CDATA[${description}]]></description>
      <guid isPermaLink="false">${guid}</guid>
      <enclosure url="${audioUrl}" type="audio/mpeg" />
      <pubDate>${new Date().toUTCString()}</pubDate>
    </item>`);
        }
      }
      
      const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>LingoFlow - German Learning Podcast</title>
    <description>Read. Listen. Practice. German texts for language learners.</description>
    <language>de</language>
    <link>${baseUrl}</link>
    <itunes:author>LingoFlow</itunes:author>
    <itunes:category text="Education">
      <itunes:category text="Language Learning"/>
    </itunes:category>
${items.join("\n")}
  </channel>
</rss>`;
      
      res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
      res.send(rss);
    } catch (error) {
      console.error("Error generating podcast feed:", error);
      res.status(500).send("Error generating feed");
    }
  });
  
  app.get("/podcast/audio/:topicId/:textId.mp3", async (req, res) => {
    try {
      const { topicId, textId } = req.params;
      
      const cached = await getCachedAudio(topicId, textId);
      if (cached) {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Length", cached.length.toString());
        return res.send(cached);
      }
      
      const topics = await getTopics();
      const topic = topics.find(t => t.id === topicId);
      if (!topic) {
        return res.status(404).send("Topic not found");
      }
      
      const text = topic.texts.find(t => t.id === textId);
      if (!text) {
        return res.status(404).send("Text not found");
      }
      
      const fullText = text.content.join(" ");
      const audioBuffer = await tts(fullText);
      
      if (!audioBuffer) {
        return res.status(500).send("TTS generation failed");
      }
      
      await cacheAudio(topicId, textId, audioBuffer);
      
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.length.toString());
      res.send(audioBuffer);
    } catch (error) {
      console.error("Error generating podcast audio:", error);
      res.status(500).send("Error generating audio");
    }
  });
}
