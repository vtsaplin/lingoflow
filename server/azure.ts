import OpenAI from "openai";

// Assuming credentials are in env vars as per Replit standard or Azure specific
// The spec says "one LLM, deployed in Azure".
// We'll try to use standard OpenAI client with Azure configuration if env vars are present,
// otherwise fall back to standard OpenAI or mock if no keys.

function getClient() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

  if (!apiKey) {
    console.warn("No API Key found for AI service.");
    return null;
  }

  if (endpoint && deployment) {
    // Azure setup
    return new OpenAI({
      apiKey,
      baseURL: `${endpoint}/openai/deployments/${deployment}`,
      defaultQuery: { 'api-version': '2024-02-15-preview' },
      defaultHeaders: { 'api-key': apiKey }
    });
  } else {
    // Standard OpenAI setup
    return new OpenAI({ apiKey });
  }
}

export async function translate(text: string): Promise<string> {
  const client = getClient();
  if (!client) return "Translation unavailable (No API Key)";

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o", // Or deployment name for Azure, usually ignored if baseURL has deployment
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
  const client = getClient();
  if (!client) return { word, translation: "No API Key" };

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
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

export async function tts(text: string): Promise<Buffer | null> {
    const client = getClient();
    if (!client) return null;

    try {
        // OpenAI TTS
        const mp3 = await client.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: text,
        });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        return buffer;
    } catch (error) {
        console.error("TTS error:", error);
        return null;
    }
}
