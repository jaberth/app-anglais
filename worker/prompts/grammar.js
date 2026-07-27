// Prompt des series d'exercices de grammaire.
//
// Le module recoit un point de grammaire du catalogue et, quand on en a, les
// formulations fautives reellement produites par l'utilisatrice en dialogue
// (recurringErrors[tag].examples). C'est ce qui separe cet exercice d'un manuel
// generique : elle retravaille SES phrases, dans SON contexte metier.

import { getGrammarTopic } from '../../shared/grammarTopics.js'
import { TUTOIEMENT, asArray, asString, stripCodeFence } from './dialogue.js'

const MIN_ITEMS = 4
const MAX_ITEMS = 8
const LEVELS = ['A2', 'B1', 'B2']
// Au-dela, on paie des tokens pour des exemples redondants : les trois derniers
// suffisent a ancrer l'exercice dans ses erreurs reelles.
const MAX_EXAMPLES = 3

export function buildGrammarRequest({ topicId, level, examples }) {
  const topic = getGrammarTopic(topicId)
  if (!topic) throw new Error('Point de grammaire inconnu')

  const safeLevel = LEVELS.includes(level) ? level : 'B1'

  const sesErreurs = (Array.isArray(examples) ? examples : [])
    .filter((example) => typeof example === 'string' && example.trim())
    .slice(-MAX_EXAMPLES)
    .map((example) => example.trim().slice(0, 200))

  return {
    systemPrompt: `You write a short grammar drill for a French Digital Marketing & Creative Director working in tech/consulting, assessed at ${safeLevel}. She underestimates her own level and freezes when speaking, so the drill must build confidence, not catch her out.

TARGET POINT: ${topic.id} — ${topic.label}.
Why it matters to her: ${topic.why}

Produce ${MIN_ITEMS} to ${MAX_ITEMS} multiple-choice items, ordered from easiest to hardest, ALL probing that single point. Do not drift to other grammar points.

Every sentence must sit in her real working world: agency status calls, campaign briefs, media budgets, board reviews, creative feedback, performance numbers. No textbook sentences about trains, weather or holidays.

Each item shows one English sentence with a blank marked exactly "___", and 3 choices. Exactly one is correct. The wrong choices must be the mistakes a French speaker actually makes on this point, not absurd options.

The "prompt" and "explanation" fields are written in French; every English fragment stays in English. ${TUTOIEMENT} Keep each explanation to one or two sentences, and state the rule rather than merely repeating the correct answer.${
      sesErreurs.length > 0
        ? `

She recently produced these exact mistakes on this point. Build at least two items directly around them, so she recognises her own phrasing:
${sesErreurs.map((example) => `- "${example}"`).join('\n')}`
        : ''
    }

Answer ONLY with a valid JSON object:
{
  "items": [
    {
      "id": string,
      "prompt": string,
      "sentence": string,
      "choices": [string, string, string],
      "answerIndex": number,
      "explanation": string
    }
  ]
}`,
    contents: [
      {
        role: 'user',
        parts: [{ text: `Genere la serie d'exercices sur ${topic.id}.` }],
      },
    ],
  }
}

export function parseGrammarResponse(text) {
  const parsed = JSON.parse(stripCodeFence(text))
  const items = asArray(parsed.items)
    .map(normalizeItem)
    .filter((item) => item !== null)

  if (items.length < MIN_ITEMS) throw new Error('Serie incomplete')

  return { items: items.slice(0, MAX_ITEMS) }
}

function normalizeItem(raw) {
  const sentence = asString(raw.sentence)
  if (!sentence) return null

  const choices = Array.isArray(raw.choices)
    ? raw.choices.filter((choice) => typeof choice === 'string' && choice.trim())
    : []
  if (choices.length < 2) return null

  const answerIndex = Number.isInteger(raw.answerIndex) ? raw.answerIndex : null
  if (answerIndex === null || answerIndex < 0 || answerIndex >= choices.length) return null

  return {
    id: asString(raw.id) || crypto.randomUUID(),
    // Une consigne vide est rattrapable ; une phrase ou une reponse absente ne
    // l'est pas, d'ou le rejet plus haut.
    prompt: asString(raw.prompt) || 'Complète la phrase.',
    sentence,
    choices,
    answerIndex,
    explanation: asString(raw.explanation),
  }
}
