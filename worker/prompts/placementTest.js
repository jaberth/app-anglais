// Prompts du test de placement.
//
// Deux etapes distinctes :
//  1. generation des items (QCM grammaire + comprehension + question ouverte) ;
//  2. evaluation des reponses -> niveau + points faibles nommes.
//
// Les points faibles utilisent les memes identifiants kebab-case que les
// errorTag du module dialogue : c'est ce qui permet au module grammaire de
// prioriser les memes lacunes, quelle que soit leur source.

import { isKnownTag, tagsForPrompt } from '../../shared/grammarTopics.js'
import { TUTOIEMENT, asArray, asString, stripCodeFence } from './dialogue.js'

const MIN_ITEMS = 12
const MAX_ITEMS = 25
const LEVELS = ['A2', 'B1', 'B2']

export function buildPlacementTestRequest({ itemCount }) {
  const count = Math.min(Math.max(Number(itemCount) || 18, MIN_ITEMS), MAX_ITEMS)
  const tags = tagsForPrompt()

  return {
    systemPrompt: `You design a short English placement test for the learner profile this app targets: a French Digital Marketing & Creative Director in tech/consulting, assessed around B1 but self-assessing at A2 and freezing when speaking.

Produce exactly ${count} items, ordered from easy to hard, mixing:
- grammar MCQs targeting the structures that typically block French speakers (tenses, present perfect vs past simple, prepositions, word order, articles, conditionals, reported speech);
- short reading-comprehension MCQs based on realistic professional marketing content (a client email, a campaign brief, an agency status update);
- 2 open-ended items asking her to write one or two sentences in a professional meeting situation.

The test must be completable in under 10 minutes. All instructions ("prompt" field) are in French; the English material stays in English. ${TUTOIEMENT}

TAGGING - this is a hard constraint. Every item carries a "topicTag" taken VERBATIM from the closed list below. Do not invent, pluralise, reorder or reword a tag: the app matches these strings exactly, and any unlisted value is silently dropped, so the learner never gets the exercise that would fix that weakness.
- grammar points: ${tags.grammar}
- non-grammar tags, to use only when no grammar point applies: ${tags.other}

Answer ONLY with a valid JSON object:
{
  "items": [
    {
      "id": string,
      "type": "mcq" | "open",
      "skill": "grammar" | "comprehension" | "writing",
      "topicTag": string,
      "level": "A2" | "B1" | "B2",
      "prompt": string,
      "passage": string | null,
      "choices": [string] | null,
      "answerIndex": number | null
    }
  ]
}`,
    contents: [
      {
        role: 'user',
        parts: [{ text: `Genere le test de placement de ${count} items.` }],
      },
    ],
  }
}

export function parsePlacementTestResponse(text) {
  const parsed = JSON.parse(stripCodeFence(text))
  const items = asArray(parsed.items)
    .map(normalizeItem)
    .filter((item) => item !== null)

  if (items.length < MIN_ITEMS) throw new Error('Test incomplet')

  return { items }
}

function normalizeItem(raw) {
  const type = raw.type === 'open' ? 'open' : 'mcq'
  const prompt = asString(raw.prompt)
  if (!prompt) return null

  const choices = Array.isArray(raw.choices)
    ? raw.choices.filter((choice) => typeof choice === 'string')
    : []

  // Un QCM sans choix exploitables est inutilisable : on le jette plutot que
  // d'afficher une question sans reponse possible.
  if (type === 'mcq' && choices.length < 2) return null

  const answerIndex = Number.isInteger(raw.answerIndex) ? raw.answerIndex : null
  if (type === 'mcq' && (answerIndex === null || answerIndex < 0 || answerIndex >= choices.length)) {
    return null
  }

  return {
    id: asString(raw.id) || crypto.randomUUID(),
    type,
    skill: ['grammar', 'comprehension', 'writing'].includes(raw.skill) ? raw.skill : 'grammar',
    // Le prompt impose la liste fermee, mais on ne lui fait pas confiance sur
    // parole : un tag hors catalogue est ramene a 'general' plutot que de
    // circuler dans l'app en pretendant designer un point de grammaire.
    topicTag: isKnownTag(asString(raw.topicTag)) ? asString(raw.topicTag) : 'general',
    level: LEVELS.includes(raw.level) ? raw.level : 'B1',
    prompt,
    passage: asString(raw.passage) || null,
    choices: type === 'mcq' ? choices : null,
    answerIndex: type === 'mcq' ? answerIndex : null,
  }
}

export function buildPlacementEvaluationRequest({ answers }) {
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new Error('Reponses manquantes')
  }

  const tags = tagsForPrompt()

  return {
    systemPrompt: `You grade a short English placement test for a French Digital Marketing & Creative Director (measured B1, feels A2, blocked when speaking).

You receive the items and her answers. MCQs are already scored; your job is to grade the open-ended answers, then produce an overall picture.

Return an informative CEFR-style level (A2, B1 or B2) and AT LEAST 2 named weak points, ordered by how much they block her fluency. Be honest but encouraging: the summary is written in French and read by someone who underestimates her own level. ${TUTOIEMENT}

TAGGING - this is a hard constraint. Each weak point carries a "topicTag" taken VERBATIM from the closed list below. Do not invent or reword a tag: the app matches these strings exactly to build her revision queue, and an unlisted value is shown to her but never turned into an exercise. Prefer a grammar tag whenever one fits; fall back on the other list only when nothing else applies. The "label" field is free text in French, so nuance belongs there, not in the tag.
- grammar points: ${tags.grammar}
- other: ${tags.other}

Answer ONLY with a valid JSON object:
{
  "level": "A2" | "B1" | "B2",
  "score": number,
  "total": number,
  "summary": string,
  "weakPoints": [{ "topicTag": string, "label": string, "advice": string }],
  "strengths": [string]
}`,
    contents: [
      {
        role: 'user',
        parts: [{ text: JSON.stringify({ answers }) }],
      },
    ],
  }
}

export function parsePlacementEvaluationResponse(text) {
  const parsed = JSON.parse(stripCodeFence(text))

  const weakPoints = asArray(parsed.weakPoints).map((point) => ({
    topicTag: asString(point.topicTag),
    label: asString(point.label),
    advice: asString(point.advice),
  }))

  // Le brief impose au moins 2 points faibles identifies : sans eux, le module
  // grammaire n'a rien a prioriser et le test rate son objectif.
  if (weakPoints.length < 2) throw new Error('Points faibles insuffisants')

  return {
    level: LEVELS.includes(parsed.level) ? parsed.level : 'B1',
    score: Number(parsed.score) || 0,
    total: Number(parsed.total) || 0,
    summary: asString(parsed.summary),
    weakPoints,
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((item) => typeof item === 'string')
      : [],
  }
}
