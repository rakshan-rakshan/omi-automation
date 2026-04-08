import axios from 'axios';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const SARVAM_BASE_URL = 'https://api.sarvam.ai/v1';

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
 * Speech-to-Text: Convert Telugu audio to English text
 */
export async function sarvamSTT(audioUrl: string): Promise<STTResponse> {
  try {
    const response = await axios.post(
      `${SARVAM_BASE_URL}/asr`,
      {
        audioUrl: audioUrl,
        language: 'te', // Telugu
      },
      {
        headers: {
          'Authorization': `Bearer ${SARVAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      transcript: response.data.transcript || response.data.text || '',
      language: 'te',
      duration: response.data.duration || 0,
    };
  } catch (error: any) {
    console.error('Sarvam STT Error:', error.response?.data || error.message);
    throw new Error(`STT failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Neural Machine Translation: Translate text from Telugu to English
 */
export async function sarvamNMT(text: string, sourceLang: string = 'te', targetLang: string = 'en'): Promise<NMTResponse> {
  try {
    const response = await axios.post(
      `${SARVAM_BASE_URL}/translate`,
      {
        input: text,
        source_language_code: sourceLang,
        target_language_code: targetLang,
      },
      {
        headers: {
          'Authorization': `Bearer ${SARVAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      translated_text: response.data.translated_text || response.data.output || '',
      source_language: sourceLang,
      target_language: targetLang,
    };
  } catch (error: any) {
    console.error('Sarvam NMT Error:', error.response?.data || error.message);
    throw new Error(`NMT failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Text-to-Speech: Generate English audio from text
 */
export async function sarvamTTS(text: string, language: string = 'en'): Promise<TTSResponse> {
  try {
    const response = await axios.post(
      `${SARVAM_BASE_URL}/tts`,
      {
        inputs: [text],
        target_language_code: language,
        speaker: 'meera',
        pitch: 1.0,
        pace: 1.0,
        loudness: 1.5,
      },
      {
        headers: {
          'Authorization': `Bearer ${SARVAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    const audioData = Buffer.from(response.data).toString('base64');

    return {
      audioUrl: `data:audio/wav;base64,${audioData}`,
      audioData: audioData,
      duration: 0,
    };
  } catch (error: any) {
    console.error('Sarvam TTS Error:', error.response?.data || error.message);
    throw new Error(`TTS failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Combined pipeline: STT + NMT in one call
 */
export async function sarvamSTTandTranslate(audioUrl: string): Promise<{ teluguText: string; englishText: string }> {
  try {
    // Step 1: Transcribe Telugu audio
    const sttResult = await sarvamSTT(audioUrl);

    // Step 2: Translate to English
    const nmtResult = await sarvamNMT(sttResult.transcript, 'te', 'en');

    return {
      teluguText: sttResult.transcript,
      englishText: nmtResult.translated_text,
    };
  } catch (error: any) {
    console.error('STT+Translate pipeline error:', error.message);
    throw error;
  }
}

/**
 * Complete pipeline: STT + NMT + TTS
 */
export async function sarvamCompletePipeline(audioUrl: string): Promise<{
  teluguText: string;
  englishText: string;
  audioData: string;
  audioUrl: string;
}> {
  try {
    // Step 1: Transcribe Telugu audio
    const sttResult = await sarvamSTT(audioUrl);
    console.log('✅ STT Complete:', sttResult.transcript.substring(0, 100));

    // Step 2: Translate to English
    const nmtResult = await sarvamNMT(sttResult.transcript, 'te', 'en');
    console.log('✅ NMT Complete:', nmtResult.translated_text.substring(0, 100));

    // Step 3: Generate English audio from translated text
    const ttsResult = await sarvamTTS(nmtResult.translated_text, 'en');
    console.log('✅ TTS Complete: Audio generated');

    return {
      teluguText: sttResult.transcript,
      englishText: nmtResult.translated_text,
      audioData: ttsResult.audioData,
      audioUrl: ttsResult.audioUrl,
    };
  } catch (error: any) {
    console.error('Complete pipeline error:', error.message);
    throw error;
  }
}
