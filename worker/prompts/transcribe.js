// Transcription audio — chemin de REPLI du mode conversation.
//
// N'est sollicitee que si la reconnaissance vocale du navigateur est absente ou
// defaillante (iOS en PWA installee, principalement). Le chemin nominal ne
// coute rien ; celui-ci consomme du quota a chaque tour, d'ou les plafonds.

import { asString } from './dialogue.js'

// ~1 Mo de base64, soit environ une minute d'audio compresse. Un tour de
// reunion depasse rarement 30 secondes ; au-dela, c'est un micro reste ouvert.
const MAX_AUDIO_BASE64 = 1_400_000

const MIMES_AUTORISES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/aac',
  'audio/flac',
])

export function buildTranscribeRequest({ audioBase64, mimeType }) {
  const audio = asString(audioBase64)
  if (!audio) throw new Error('Audio manquant')
  if (audio.length > MAX_AUDIO_BASE64) throw new Error('Enregistrement trop long')

  // Le navigateur renvoie souvent "audio/webm;codecs=opus" : Gemini veut le
  // type de base, sans parametres.
  const mime = asString(mimeType).split(';')[0].trim().toLowerCase()
  if (!MIMES_AUTORISES.has(mime)) throw new Error('Format audio non supporte')

  return {
    systemPrompt: `You transcribe short spoken English from a French professional practising business meetings.

Transcribe EXACTLY what she said, including her grammar mistakes. Do not correct, do not improve, do not complete unfinished sentences: the app grades her real production, so a cleaned-up transcript would hide the very errors it must catch.

Keep filler words out ("uh", "um", "euh") — they are noise, not mistakes. If she spoke French, transcribe the French as-is. If nothing intelligible was said, return an empty string.

Answer ONLY with a valid JSON object: { "transcript": string }`,
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: mime, data: audio } }],
      },
    ],
  }
}

export function parseTranscribeResponse(text) {
  const parsed = JSON.parse(
    text
      .trim()
      .replace(/^```(json)?/i, '')
      .replace(/```$/, '')
      .trim(),
  )

  return { transcript: asString(parsed.transcript) }
}
