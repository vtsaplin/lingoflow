import fs from 'fs/promises';
import path from 'path';
import { Topic, Text } from '@shared/schema';

const CONTENT_DIR = path.join(process.cwd(), 'content/a2');

export async function getTopics(): Promise<Topic[]> {
  const files = await fs.readdir(CONTENT_DIR);
  const markdownFiles = files.filter(f => f.endsWith('.md')).sort();
  
  const topics: Topic[] = [];

  for (const file of markdownFiles) {
    const content = await fs.readFile(path.join(CONTENT_DIR, file), 'utf-8');
    const topic = parseTopic(file, content);
    if (topic) {
      topics.push(topic);
    }
  }

  return topics;
}

export async function getTopic(id: string): Promise<Topic | undefined> {
  const topics = await getTopics();
  return topics.find(t => t.id === id);
}

function parseTopic(filename: string, content: string): Topic | null {
  const lines = content.split('\n');
  const id = filename.replace(/\.md$/, '');
  
  let title = '';
  let description = '';
  const texts: Text[] = [];
  
  let currentText: Text | null = null;
  let isDescription = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('# ')) {
      title = line.substring(2).trim();
      isDescription = true;
    } else if (line.startsWith('## ')) {
      isDescription = false;
      if (currentText) {
        texts.push(currentText);
      }
      const textTitle = line.substring(3).trim();
      const textId = textTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      currentText = {
        id: textId,
        title: textTitle,
        content: []
      };
    } else if (line === '---') {
      // separator, ignore
    } else if (line.length > 0) {
      if (isDescription) {
        description += (description ? '\n' : '') + line;
      } else if (currentText) {
        currentText.content.push(line);
      }
    }
  }

  if (currentText) {
    texts.push(currentText);
  }

  if (!title) return null;

  return {
    id,
    title,
    description: description || undefined,
    texts
  };
}
