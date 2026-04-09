import axios from 'axios';
import FormData from 'form-data';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const SARVAM_BASE_URL = 'https://api.sarvam.ai';

interface STTResponse {
  transcript: string;
  language: string;
  duration: number;
}

interface NMTResponse {
  translated_text: string;
  source_language: string;
  target_language: string;
}

interface TTSResponse {
  audioUrl: string;
  audioData: string; // base64
  duration: number;
}

/**
 * Speech-to-Text: Convert Telugu audio to text.
 *
 * Sarvam STT requires multipart/form-data with the audio file bytes.
 * Endpoint: POST https://api.sarvam.ai/speech-to-text
 * Docs: https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe
 */
export async function sarvamSTT(
  audioBuffer: Buffer,
  contentType: string = 'audio/webm'
): Promise<STTResponse> {
  const ext = contentType.includes('mp4') || contentType.includes('m4a')
    ? 'm4a'
    : contentType.includes('mp3')
    ? 'mp3'
    : contentType.includes('ogg') || contentType.includes('opus')
    ? 'ogg'
    : 'webm';

  const form = new FormData();
  form.append('file', audioBuffer, { filename: `audio.${ext}`, contentType });
  form.append('model', 'saarika:v2.5');
  form.append('language_code', 'te-IN');

  console.log(`Calling Sarvam STT (${audioBuffer.length} bytes, ${contentType})`);

  const response = await axios.post(
    `${SARVAM_BASE_URL}/speech-to-text`,
    form,
    {
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
        ...form.getHeaders(),
      },
    }
  );

  console.log('STT response:', response.data);

  return {
    transcript: response.data.transcript || '',
    language: 'te',
    duration: response.data.duration || 0,
  };
}

/**
 * Neural Machine Translation: Translate text from Telugu to English.
 * Endpoint: POST https://api.sarvam.ai/translate
 */
export async function sarvamNMT(
  text: string,
  sourceLang: string = 'te-IN',
  targetLang: string = 'en-IN'
): Promise<NMTResponse> {
  console.log('Calling Sarvam Translate API...');

  const response = await axios.post(
    `${SARVAM_BASE_URL}/translate`,
    {
      input: text,
      source_language_code: sourceLang,
      target_language_code: targetLang,
      model: 'mayura:v1',
    },
    {
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    translated_text: response.data.translated_text || '',
    source_language: sourceLang,
    target_language: targetLang,
  };
}

/**
 * Text-to-Speech: Generate English audio from text.
 * Endpoint: POST https://api.sarvam.ai/text-to-speech
 * Returns base64-encoded WAV audio.
 */
export async function sarvamTTS(
  text: string,
  language: string = 'en-IN'
): Promise<TTSResponse> {
  console.log('Calling Sarvam TTS API...');

  const response = await axios.post(
    `${SARVAM_BASE_URL}/text-to-speech`,
    {
      text,
      target_language_code: language,
      speaker: 'shubh',
      model: 'bulbul:v3',
      pace: 1.0,
    },
    {
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  // Response: { audios: [base64string, ...] }
  const audioData: string = response.data.audios?.[0] || '';

  return {
    audioUrl: `data:audio/wav;base64,${audioData}`,
    audioData,
    duration: 0,
  };
}

/**
 * Combined pipeline: STT then translate.
 */
export async function sarvamSTTandTranslate(
  audioBuffer: Buffer,
  contentType: string = 'audio/webm'
): Promise<{ teluguText: string; englishText: string }> {
  const sttResult = await sarvamSTT(audioBuffer, contentType);
  const nmtResult = await sarvamNMT(sttResult.transcript, 'te-IN', 'en-IN');

  return {
    teluguText: sttResult.transcript,
    englishText: nmtResult.translated_text,
  };
}

/**
 * Complete pipeline: STT + translate + TTS.
 */
export async function sarvamCompletePipeline(
  audioBuffer: Buffer,
  contentType: string = 'audio/webm'
): Promise<{
  teluguText: string;
  englishText: string;
  audioData: string;
  audioUrl: string;
}> {
  const sttResult = await sarvamSTT(audioBuffer, contentType);
  console.log('STT complete');

  const nmtResult = await sarvamNMT(sttResult.transcript, 'te-IN', 'en-IN');
  console.log('NMT complete');

  const ttsResult = await sarvamTTS(nmtResult.translated_text, 'en-IN');
  console.log('TTS complete');

  return {
    teluguText: sttResult.transcript,
    englishText: nmtResult.translated_text,
    audioData: ttsResult.audioData,
    audioUrl: ttsResult.audioUrl,
  };
}
