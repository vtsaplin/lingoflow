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

export interface DialogueQuestion {
  question: string;
  context: string;
  expectedTopics: string[];
}

export async function generateDialogue(
  textContent: string,
  topicTitle: string,
  questionCount: number = 1,
  previousQuestions: string[] = []
): Promise<DialogueQuestion[]> {
  const client = getChatClient();
  if (!client) return [];

  const previousQuestionsNote = previousQuestions.length > 0 
    ? `\n\nDo NOT repeat these questions that were already asked:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : '';

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { 
          role: "system", 
          content: `You are a German language tutor creating dialogue practice questions for Russian-speaking students learning German.
Based on the provided German learning text, generate ${questionCount} conversational question(s) in German that a native speaker might ask in a similar real-life situation.

For each question, provide:
- question: The question in German (natural, conversational)
- context: Brief context about what kind of answer is expected (in Russian, для русскоязычного студента)
- expectedTopics: Array of key topics/words the response should relate to (in German)

Focus on practical, everyday conversation scenarios related to the text topic.${previousQuestionsNote}

Return ONLY a valid JSON object with format: { "questions": [...] }` 
        },
        { 
          role: "user", 
          content: `Topic: ${topicTitle}\n\nText content:\n${textContent}` 
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{"questions": []}');
    return parsed.questions || [];
  } catch (error) {
    console.error("Generate dialogue error:", error);
    return [];
  }
}

export interface EvaluationResult {
  isAppropriate: boolean;
  feedback: string;
  suggestedResponse?: string;
}

export async function evaluateResponse(
  question: string,
  userResponse: string,
  expectedTopics: string[]
): Promise<EvaluationResult> {
  const client = getChatClient();
  if (!client) {
    return { 
      isAppropriate: false, 
      feedback: "Evaluation unavailable (No API Key)" 
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { 
          role: "system", 
          content: `You are a German language tutor evaluating a Russian-speaking student's spoken response in a dialogue practice exercise.

Evaluate whether the student's German response is appropriate for the given question. Be encouraging but helpful.

Consider:
1. Is the response grammatically understandable (minor errors are OK)?
2. Does the response make sense as an answer to the question?
3. Does it relate to any of the expected topics?

Be lenient - the goal is communication practice, not perfection. Accept responses that demonstrate understanding even if grammar isn't perfect.

Return ONLY a valid JSON object with:
- isAppropriate: boolean (true if the response is a reasonable answer)
- feedback: string (brief encouraging feedback in Russian для русскоязычного студента, 1-2 предложения)
- suggestedResponse: string (optional, a natural German response as an example, only if the user's response was inappropriate)` 
        },
        { 
          role: "user", 
          content: `Question: ${question}
User's response: ${userResponse}
Expected topics: ${expectedTopics.join(", ")}` 
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content;
    return JSON.parse(content || '{"isAppropriate": false, "feedback": "Could not evaluate"}');
  } catch (error) {
    console.error("Evaluate response error:", error);
    return { 
      isAppropriate: false, 
      feedback: "Evaluation error occurred" 
    };
  }
}
