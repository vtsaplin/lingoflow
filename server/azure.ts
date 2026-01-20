import OpenAI from "openai";

function getChatClient() {
  const apiKey = process.env.AZURE_OPENAI_CHAT_API_KEY || process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_CHAT_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT;

  if (!apiKey) {
    console.warn("No API Key found for Chat service.");
    return null;
  }

  if (endpoint && deployment) {
    return new OpenAI({
      apiKey,
      baseURL: `${endpoint}/openai/deployments/${deployment}`,
      defaultQuery: { 'api-version': '2024-12-01-preview' },
      defaultHeaders: { 'api-key': apiKey }
    });
  } else {
    return new OpenAI({ apiKey });
  }
}

function getTTSClient() {
  const apiKey = process.env.AZURE_OPENAI_TTS_API_KEY || process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_TTS_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_TTS_DEPLOYMENT;

  if (!apiKey) {
    console.warn("No API Key found for TTS service.");
    return null;
  }

  if (endpoint && deployment) {
    return new OpenAI({
      apiKey,
      baseURL: `${endpoint}/openai/deployments/${deployment}`,
      defaultQuery: { 'api-version': '2024-12-01-preview' },
      defaultHeaders: { 'api-key': apiKey }
    });
  } else {
    return new OpenAI({ apiKey });
  }
}

export async function translate(text: string): Promise<string> {
  const client = getChatClient();
  if (!client) return "Translation unavailable (No API Key)";

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "You are a professional translator. Translate the following German text to Russian. Return only the translation." },
        { role: "user", content: text }
      ]
    });
    return response.choices[0].message.content || "Error translating";
  } catch (error) {
    console.error("Translation error:", error);
    return "Error translating";
  }
}

export async function dictionary(word: string): Promise<any> {
  const client = getChatClient();
  if (!client) return { word, translation: "No API Key" };

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: `You are a German-Russian dictionary. Analyze the given German word. Return a JSON object with:
          - word: the original word
          - translation: Russian translation
          - partOfSpeech: grammatical part of speech (in German)
          - definition: short definition in German
          - example_de: example sentence in German
          - example_ru: Russian translation of the example
          Return ONLY JSON.` },
        { role: "user", content: word }
      ],
      response_format: { type: "json_object" }
    });
    const content = response.choices[0].message.content;
    return JSON.parse(content || "{}");
  } catch (error) {
    console.error("Dictionary error:", error);
    return { word, translation: "Error" };
  }
}

export async function tts(text: string, speed: number = 1.0): Promise<Buffer | null> {
  const client = getTTSClient();
  if (!client) return null;

  try {
    const mp3 = await client.audio.speech.create({
      model: "tts-hd",
      voice: "alloy",
      input: text,
      speed: speed,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error("TTS error:", error);
    return null;
  }
}
