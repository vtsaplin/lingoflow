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
          content: `You are a German language tutor creating SIMPLE dialogue practice questions for Russian-speaking students at A2-B1 level.

IMPORTANT: Keep everything at A2-B1 level!
- Use basic vocabulary and short sentences
- Questions should be simple and direct (5-10 words max)
- Avoid complex grammar (Konjunktiv II, Passiv, long subordinate clauses)

Based on the provided German learning text, generate ${questionCount} simple conversational question(s) in German.

For each question, provide:
- question: Simple question in German (short, basic vocabulary, A2-B1 level)
- context: Very brief hint in Russian - just 1 short sentence describing what to answer (простым языком, 10-15 слов максимум!)
- expectedTopics: Array of 3-5 simple German words that could be used in the answer

Examples of good A2-B1 questions:
- "Wann ist es bei dir zu Hause laut?"
- "Was machst du, wenn die Nachbarn laut sind?"
- "Wie findest du deine Wohnung?"

Focus on practical, everyday scenarios.${previousQuestionsNote}

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
          content: `You are a German language tutor evaluating a Russian-speaking A2-B1 level student's spoken response.

Evaluate whether the student's German response is appropriate for the given question. Be very encouraging!

Consider:
1. Is the response understandable (minor grammar errors are completely OK)?
2. Does the response make sense as an answer to the question?
3. Does it relate to any of the expected topics?

Be VERY lenient - the goal is communication practice, not perfection. Accept any response that shows understanding.

Return ONLY a valid JSON object with:
- isAppropriate: boolean (true if the response is a reasonable answer)
- feedback: string (brief encouraging feedback in Russian, 1 короткое предложение!)
- suggestedResponse: string (ONLY if inappropriate - give a SIMPLE A2-B1 level example, 5-10 words, basic vocabulary!)

Example of good suggestedResponse: "Ja, ich spreche oft mit meinen Nachbarn."
NOT: "Selbstverständlich habe ich bereits mehrfach versucht, mit den Nachbarn..."` 
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
