import axios from 'axios';

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
 * Speech-to-Text: Convert Telugu audio to English text
 * Uses /speech-to-text endpoint
 */
export async function sarvamSTT(audioUrl: string): Promise<STTResponse> {
  try {
    console.log('🎤 Calling Sarvam STT API with URL:', audioUrl);
    
    // Sarvam accepts audioUrl parameter for remote files
    const response = await axios.post(
      `${SARVAM_BASE_URL}/speech-to-text`,
      {
        audioUrl: audioUrl,
        language_code: 'te-IN',
      },
      {
        headers: {
          'api-subscription-key': SARVAM_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('STT Response:', response.data);

    return {
      transcript: response.data.transcript || '',
      language: 'te',
      duration: response.data.duration || 0,
    };
  } catch (error: any) {
    console.error('Sarvam STT Error Details:', error.response?.data);
    console.error('Sarvam STT Error Status:', error.response?.status);
    throw new Error(`STT failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Neural Machine Translation: Translate text from Telugu to English
 */
export async function sarvamNMT(text: string, sourceLang: string = 'te-IN', targetLang: string = 'en-IN'): Promise<NMTResponse> {
  try {
    console.log('🔤 Calling Sarvam Translate API...');
    
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
  } catch (error: any) {
    console.error('Sarvam NMT Error:', error.response?.data || error.message);
    throw new Error(`NMT failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Text-to-Speech: Generate English audio from text
 */
export async function sarvamTTS(text: string, language: string = 'en-IN'): Promise<TTSResponse> {
  try {
    console.log('🔊 Calling Sarvam TTS API...');
    
    const response = await axios.post(
      `${SARVAM_BASE_URL}/text-to-speech`,
      {
        text: text,
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

    // Response contains base64-encoded audio
    const audioData = response.data.audios?.[0] || '';

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
    const nmtResult = await sarvamNMT(sttResult.transcript, 'te-IN', 'en-IN');

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
    console.log('✅ STT Complete');

    // Step 2: Translate to English
    const nmtResult = await sarvamNMT(sttResult.transcript, 'te-IN', 'en-IN');
    console.log('✅ NMT Complete');

    // Step 3: Generate English audio from translated text
    const ttsResult = await sarvamTTS(nmtResult.translated_text, 'en-IN');
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
