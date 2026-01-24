import { Buffer } from "node:buffer";

const AZURE_WHISPER_ENDPOINT = process.env.AZURE_WHISPER_ENDPOINT;
const AZURE_WHISPER_API_KEY = process.env.AZURE_WHISPER_API_KEY;
const AZURE_WHISPER_DEPLOYMENT = process.env.AZURE_WHISPER_DEPLOYMENT;

export async function transcribeWithAzureWhisper(audioBuffer: Buffer): Promise<string> {
  if (!AZURE_WHISPER_ENDPOINT || !AZURE_WHISPER_API_KEY || !AZURE_WHISPER_DEPLOYMENT) {
    throw new Error("Azure Whisper configuration is missing. Please set AZURE_WHISPER_ENDPOINT, AZURE_WHISPER_API_KEY, and AZURE_WHISPER_DEPLOYMENT environment variables.");
  }

  const url = `${AZURE_WHISPER_ENDPOINT}/openai/deployments/${AZURE_WHISPER_DEPLOYMENT}/audio/transcriptions?api-version=2024-06-01`;

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: "audio/wav" });
  formData.append("file", blob, "audio.wav");
  formData.append("response_format", "text");
  formData.append("language", "de"); // Force German language recognition

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": AZURE_WHISPER_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Azure Whisper API error:", errorText);
    throw new Error(`Azure Whisper transcription failed: ${response.status} ${response.statusText}`);
  }

  const transcript = await response.text();
  return transcript.trim();
}
