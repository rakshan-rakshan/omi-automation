import axios from 'axios';
import FormData from 'form-data';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const SARVAM_BASE_URL = 'https://api.sarvam.ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NMTResponse {
  translated_text: string;
}

export interface TTSResponse {
  audioUrl: string;  // data:audio/wav;base64,...
  audioData: string; // raw base64
}

// ---------------------------------------------------------------------------
// Speech-to-Text (single file, < 30 s) — kept for short-clip use
// ---------------------------------------------------------------------------

export async function sarvamSTT(
  audioBuffer: Buffer,
  contentType: string = 'audio/webm'
): Promise<string> {
  const ext = contentType.includes('mp4') || contentType.includes('m4a')
    ? 'm4a' : contentType.includes('mp3') ? 'mp3'
    : contentType.includes('ogg') ? 'ogg' : 'webm';

  const form = new FormData();
  form.append('file', audioBuffer, { filename: `audio.${ext}`, contentType });
  form.append('model', 'saarika:v2.5');
  form.append('language_code', 'te-IN');

  const res = await axios.post(`${SARVAM_BASE_URL}/speech-to-text`, form, {
    headers: { 'api-subscription-key': SARVAM_API_KEY, ...form.getHeaders() },
  });
  return res.data.transcript || '';
}

// ---------------------------------------------------------------------------
// Neural Machine Translation
// ---------------------------------------------------------------------------

export async function sarvamNMT(
  text: string,
  sourceLang: string = 'te-IN',
  targetLang: string = 'en-IN'
): Promise<NMTResponse> {
  const res = await axios.post(
    `${SARVAM_BASE_URL}/translate`,
    { input: text, source_language_code: sourceLang, target_language_code: targetLang, model: 'mayura:v1' },
    { headers: { 'api-subscription-key': SARVAM_API_KEY, 'Content-Type': 'application/json' } }
  );
  return { translated_text: res.data.translated_text || '' };
}

// ---------------------------------------------------------------------------
// Text-to-Speech
// ---------------------------------------------------------------------------

export async function sarvamTTS(
  text: string,
  language: string = 'en-IN'
): Promise<TTSResponse> {
  const res = await axios.post(
    `${SARVAM_BASE_URL}/text-to-speech`,
    { inputs: [text], target_language_code: language, speaker: 'shruti', model: 'bulbul:v2' },
    { headers: { 'api-subscription-key': SARVAM_API_KEY, 'Content-Type': 'application/json' } }
  );
  const audioData: string = res.data.audios?.[0] || '';
  return { audioUrl: `data:audio/wav;base64,${audioData}`, audioData };
}
