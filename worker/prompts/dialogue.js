// Prompt du module de dialogue scenarise.
//
// Chaque tour renvoie DEUX choses en un seul appel Gemini (pour tenir dans le
// quota gratuit et garder la latence basse) :
//  - le feedback correctif sur la reponse de l'utilisatrice ;
//  - la replique suivante du personnage joue par l'IA.

import { getScenario } from '../../shared/scenarios.js'

const LEVELS = ['A2', 'B1', 'B2']
const MAX_HISTORY_TURNS = 12
const MAX_MESSAGE_LENGTH = 1500

export function buildDialogueRequest({ scenarioId, level, history, userMessage }) {
  const scenario = getScenario(scenarioId)
  if (!scenario) throw new Error('Scenario inconnu')

  const safeLevel = LEVELS.includes(level) ? level : 'B1'

  if (typeof userMessage !== 'string' || !userMessage.trim()) {
    throw new Error('Message utilisateur manquant')
  }
  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    // Garde-fou de quota : une session de coaching n'a aucune raison d'envoyer
    // des pavés de plusieurs milliers de caracteres.
    throw new Error('Message trop long')
  }

  const safeHistory = Array.isArray(history)
    ? history
        .slice(-MAX_HISTORY_TURNS)
        .filter((turn) => turn && typeof turn.text === 'string')
        .map((turn) => ({
          role: turn.role === 'coach' ? 'model' : 'user',
          parts: [{ text: turn.text.slice(0, MAX_MESSAGE_LENGTH) }],
        }))
    : []

  return {
    systemPrompt: buildSystemPrompt(scenario, safeLevel),
    contents: [...safeHistory, { role: 'user', parts: [{ text: userMessage.trim() }] }],
  }
}

function buildSystemPrompt(scenario, level) {
  return `You are an English coach for a French professional: ${scenario.userRole}. Assume the learner profile this app targets: assessed at ${level}, but under-confident when speaking and prone to freezing. Your priority is therefore to keep her talking.

ROLE-PLAY: you are ${scenario.aiRole}. Stay in character for the dialogue line.

Context of the conversation: ${scenario.description}

RULES:
- Keep your in-character reply short (1-3 sentences) and always end with a question or an explicit invitation to respond, so the conversation never stalls.
- Adapt your vocabulary and speed to a ${level} learner: natural professional English, no rare idioms.
- Never switch to French in the dialogue line.
- In the feedback, be encouraging first, then correct. Never correct more than the 2 most important mistakes per turn, so she is not discouraged.
- The "reformulation" must be what a confident native professional would actually say in that meeting - not just a grammatically fixed version of her sentence.
- Feedback fields are written in French (she is French); the dialogue and reformulation are in English.
- Tag each mistake with a stable kebab-case identifier (e.g. "past-simple-vs-present-perfect", "prepositions", "article-usage", "word-order") so the app can track recurring errors over time.

Answer ONLY with a valid JSON object matching this schema:
{
  "feedback": {
    "encouragement": string,
    "corrections": [{ "original": string, "corrected": string, "explanation": string, "errorTag": string }],
    "reformulation": string,
    "reformulationNote": string
  },
  "reply": string,
  "suggestedVocabulary": [{ "term": string, "translation": string }]
}`
}

export function parseDialogueResponse(text) {
  const parsed = JSON.parse(stripCodeFence(text))

  if (typeof parsed.reply !== 'string' || !parsed.reply.trim()) {
    throw new Error('Replique manquante')
  }

  const feedback = parsed.feedback || {}

  // On normalise ici pour que l'UI n'ait jamais a se defendre contre des champs
  // absents ou d'un type inattendu.
  return {
    reply: parsed.reply.trim(),
    feedback: {
      encouragement: asString(feedback.encouragement),
      reformulation: asString(feedback.reformulation),
      reformulationNote: asString(feedback.reformulationNote),
      corrections: asArray(feedback.corrections).map((correction) => ({
        original: asString(correction.original),
        corrected: asString(correction.corrected),
        explanation: asString(correction.explanation),
        errorTag: asString(correction.errorTag),
      })),
    },
    suggestedVocabulary: asArray(parsed.suggestedVocabulary).map((item) => ({
      term: asString(item.term),
      translation: asString(item.translation),
    })),
  }
}

// Malgre responseMimeType: 'application/json', le modele encadre parfois sa
// sortie de balises markdown : on les retire avant JSON.parse.
export function stripCodeFence(text) {
  return text
    .trim()
    .replace(/^```(json)?/i, '')
    .replace(/```$/, '')
    .trim()
}

export function asString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function asArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []
}
