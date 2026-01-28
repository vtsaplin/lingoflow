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

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export async function tts(text: string, speed: number = 1.0, voice: TTSVoice = "alloy"): Promise<Buffer | null> {
  const client = getTTSClient();
  if (!client) return null;

  try {
    const mp3 = await client.audio.speech.create({
      model: "tts-hd",
      voice: voice,
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

CRITICAL: Questions MUST be based DIRECTLY on the specific content of the provided text!
- Ask about specific details, facts, or situations mentioned IN THE TEXT
- Do NOT ask generic questions about the topic
- The student should be able to answer using information from the text

IMPORTANT: Keep everything at A2-B1 level!
- Use basic vocabulary and short sentences
- Questions should be simple and direct (5-10 words max)
- Avoid complex grammar (Konjunktiv II, Passiv, long subordinate clauses)

Generate ${questionCount} simple conversational question(s) in German based on the specific text content.

For each question, provide:
- question: Simple question in German about specific content from the text (short, basic vocabulary, A2-B1 level)
- context: Russian translation of the question ONLY. No location hints, no extra explanations - just the translation.
- expectedTopics: Array of 3-5 German words FROM THE TEXT that could be used in the answer

Example: If text says "Meine Nachbarn machen jeden Abend laute Musik"
Good question: "Wann machen die Nachbarn Musik?" (asks about specific text detail)
Good context: "Когда соседи играют музыку?" (just the translation)
Bad context: "В конце текста: когда соседи играют музыку?" (no location hints!)
Bad question: "Magst du Musik?" (too generic, not about the text)
${previousQuestionsNote}

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

CRITICAL CHECKS (response is INAPPROPRIATE if ANY fail):
1. Response must contain REAL German words (not gibberish or random sounds)
2. Words must form a grammatically reasonable sentence (minor errors OK, but not random word salad)
3. Response must logically answer or relate to the question asked

Mark as INAPPROPRIATE if:
- Response contains gibberish, nonsense syllables, or made-up words
- Words don't exist in German language
- Response has no logical connection to the question
- Just "ja" or "nein" alone without any context

Mark as APPROPRIATE if:
- Real German words are used correctly
- Sentence is understandable (small grammar mistakes are fine!)
- Response logically answers the question

Return ONLY a valid JSON object with:
- isAppropriate: boolean (true ONLY if all critical checks pass)
- feedback: string (brief feedback in Russian, 1 короткое предложение! If inappropriate, explain what was wrong)
- suggestedResponse: string (ONLY if inappropriate - give a SIMPLE A2-B1 level example, 5-10 words)

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

export interface SentenceAnalysis {
  phrasalVerbs: Array<{
    phrase: string;
    meaning: string;
  }>;
  constructions: Array<{
    pattern: string;
    explanation: string;
  }>;
  compoundWords: Array<{
    word: string;
    parts: string;
    meaning: string;
  }>;
}

export async function analyzeSentence(sentence: string): Promise<SentenceAnalysis> {
  const client = getChatClient();
  if (!client) {
    return { phrasalVerbs: [], constructions: [], compoundWords: [] };
  }
  
  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { 
          role: "system", 
          content: `You are a German language tutor providing CONCISE grammatical analysis for Russian-speaking A2-B1 students.

Analyze the German sentence and return ONLY what's useful for learning. Keep it brief!

Return a JSON object with:

1. "phrasalVerbs": Phrasal verbs and verb+preposition combinations (e.g., "sprechen mit", "warten auf")
   - phrase: the German phrase
   - meaning: brief Russian explanation (3-5 words max)

2. "constructions": Key grammatical patterns worth noting (e.g., "möchte + Infinitiv", "weil + verb at end")
   - pattern: the grammatical pattern
   - explanation: brief Russian explanation (5-10 words max)

3. "compoundWords": Compound words if any (e.g., "Kopfschmerzen = Kopf + Schmerzen")
   - word: the compound word
   - parts: breakdown (e.g., "Kopf + Schmerzen")
   - meaning: Russian meaning

IMPORTANT:
- Only include items that are genuinely useful for learning
- Skip obvious things (basic articles, simple pronouns)
- Keep all explanations SHORT and in Russian
- If nothing notable, return empty arrays
- Maximum 3 items per category` 
        },
        { role: "user", content: sentence }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');
    
    return {
      phrasalVerbs: parsed.phrasalVerbs || [],
      constructions: parsed.constructions || [],
      compoundWords: parsed.compoundWords || []
    };
  } catch (error) {
    console.error("Analyze sentence error:", error);
    return {
      phrasalVerbs: [],
      constructions: [],
      compoundWords: []
    };
  }
}
