import { Buffer } from "node:buffer";

const AZURE_GPT_AUDIO_ENDPOINT = process.env.AZURE_GPT_AUDIO_ENDPOINT;
const AZURE_GPT_AUDIO_API_KEY = process.env.AZURE_GPT_AUDIO_API_KEY;
const AZURE_GPT_AUDIO_DEPLOYMENT = process.env.AZURE_GPT_AUDIO_DEPLOYMENT;
const API_VERSION = "2025-01-01-preview";

export async function transcribeWithGPTAudio(audioBuffer: Buffer): Promise<string> {
  if (!AZURE_GPT_AUDIO_ENDPOINT || !AZURE_GPT_AUDIO_API_KEY || !AZURE_GPT_AUDIO_DEPLOYMENT) {
    throw new Error("Azure GPT Audio configuration is missing. Please set AZURE_GPT_AUDIO_ENDPOINT, AZURE_GPT_AUDIO_API_KEY, and AZURE_GPT_AUDIO_DEPLOYMENT environment variables.");
  }

  const url = `${AZURE_GPT_AUDIO_ENDPOINT}/openai/deployments/${AZURE_GPT_AUDIO_DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;

  const base64Audio = audioBuffer.toString("base64");

  const requestBody = {
    modalities: ["text"],
    messages: [
      {
        role: "system",
        content: "You are a German language transcription assistant. Listen to the audio and transcribe EXACTLY what the user says in German. Return ONLY the transcribed text, nothing else. If you cannot understand the audio or it's silent, return an empty string."
      },
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: base64Audio,
              format: "wav"
            }
          }
        ]
      }
    ],
    max_tokens: 500
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_GPT_AUDIO_API_KEY,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Azure GPT Audio API error:", errorText);
    throw new Error(`Azure GPT Audio transcription failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  // Log full response for debugging
  console.log("GPT Audio response:", JSON.stringify(result, null, 2));
  
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    console.error("No content in GPT Audio response:", result);
    return "";
  }
  
  return content.trim();
}
