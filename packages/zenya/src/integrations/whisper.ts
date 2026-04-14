// Whisper transcription — converts audio attachments to text via OpenAI API
// Used when Chatwoot/Baileys does not transcribe audio messages automatically

/**
 * Downloads an audio file from a URL and transcribes it using OpenAI Whisper.
 * Returns the transcribed text, or null if transcription fails.
 */
export async function transcribeAudioUrl(audioUrl: string): Promise<string | null> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) return null;

  try {
    // Download the audio file
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      console.warn(`[zenya] whisper: failed to download audio (${audioRes.status})`);
      return null;
    }

    const audioBuffer = await audioRes.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' });

    // Send to Whisper API
    const form = new FormData();
    form.append('file', audioBlob, 'audio.ogg');
    form.append('model', 'whisper-1');
    form.append('language', 'pt');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn(`[zenya] whisper: transcription failed (${res.status}): ${err}`);
      return null;
    }

    const data = (await res.json()) as { text?: string };
    return data.text?.trim() || null;
  } catch (err) {
    console.warn('[zenya] whisper: unexpected error:', err);
    return null;
  }
}
