// Prompt du module de dialogue scenarise.
//
// Chaque tour renvoie DEUX choses en un seul appel Gemini (pour tenir dans le
// quota gratuit et garder la latence basse) :
//  - le feedback correctif sur la reponse de l'utilisatrice ;
//  - la replique suivante du personnage joue par l'IA.

import { tagsForPrompt } from '../../shared/grammarTopics.js'
import { getScenario, isCustomScenarioId, normalizeCustomScenario } from '../../shared/scenarios.js'
import { getVocabularyEntry } from '../../shared/vocabulary.js'

const LEVELS = ['A2', 'B1', 'B2']
const MAX_HISTORY_TURNS = 12
const MAX_MESSAGE_LENGTH = 1500
// Au-dela, la consigne se dilue : le modele saupoudre du jargon au lieu de
// placer un terme la ou il tombe juste.
const MAX_VOCABULARY_TERMS = 10

export function buildDialogueRequest({
  scenarioId,
  customScenario,
  level,
  history,
  userMessage,
  vocabularyIds,
}) {
  // Un scenario livre avec l'app est resolu par son identifiant ; un scenario
  // sur mesure voyage avec la requete, et n'est donc jamais cru sur parole :
  // normalizeCustomScenario() le retaille aux champs et longueurs attendus.
  const scenario = isCustomScenarioId(scenarioId)
    ? normalizeCustomScenario(customScenario, { id: scenarioId })
    : getScenario(scenarioId)

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

  // Le front envoie des identifiants, jamais du texte libre : on ne fait donc
  // entrer dans le prompt que des termes issus du catalogue.
  const vocabulaire = (Array.isArray(vocabularyIds) ? vocabularyIds : [])
    .map(getVocabularyEntry)
    .filter(Boolean)
    .slice(0, MAX_VOCABULARY_TERMS)

  return {
    systemPrompt: buildSystemPrompt(scenario, safeLevel, vocabulaire),
    contents: [...safeHistory, { role: 'user', parts: [{ text: userMessage.trim() }] }],
    // Ce tour est sur le chemin critique d'une conversation en temps reel : le
    // raisonnement etendu de Gemini 3 coute une latence perceptible a chaque
    // reponse. `thinkingBudget` (l'ancien levier, herite de Gemini 2.5) declenche
    // un 400 sur ce modele : Gemini 3 attend `thinkingLevel`. 'low' plutot que
    // 'minimal' pour garder assez de jugement sur le seuil de correction (voir
    // SEUIL_CORRECTION) — decider quoi taire n'est pas une tache mecanique.
    // Desactive ici seulement, pas dans les autres prompts ou la latence n'est
    // pas sur le chemin d'une conversation live.
    generationConfig: { thinkingConfig: { thinkingLevel: 'low' } },
  }
}

function buildSystemPrompt(scenario, level, vocabulaire) {
  const tags = tagsForPrompt()

  return `You are an English coach for a French professional: ${scenario.userRole}. Assume the learner profile this app targets: assessed at ${level}, but under-confident when speaking and prone to freezing. Your priority is therefore to keep her talking.

${CONTEXTE_EUROPEEN}

ROLE-PLAY: you are ${scenario.aiRole}. Stay in character for the dialogue line.

Context of the conversation: ${scenario.description}

${SEUIL_CORRECTION}

RULES:
- Keep your in-character reply short (1-3 sentences) and always end with a question or an explicit invitation to respond, so the conversation never stalls.
- Adapt your vocabulary and speed to a ${level} learner.
- Never switch to French in the dialogue line.
- Open the feedback with the encouragement, always.
- Never more than 2 corrections in a turn, even when more would qualify — pick the ones that cost her the most.
- The "reformulation" is not a correction: it is what a confident professional would actually say in that meeting. Provide it even when there is nothing to correct, because that is where the real progress lies.
- Feedback fields are written in French (she is French); the dialogue and reformulation are in English. ${TUTOIEMENT}
${vocabularySection(vocabulaire)}- Tag each mistake with an "errorTag" taken VERBATIM from the closed list below. Do not invent or reword a tag: the app counts these strings to spot recurring errors and to push the matching grammar exercise up her revision queue, so an unlisted value makes the mistake invisible to that mechanism.
  - grammar points: ${tags.grammar}
  - other: ${tags.other}

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

/**
 * Remet en circulation le vocabulaire metier que l'utilisatrice travaille.
 *
 * L'objectif est de le lui faire RENCONTRER en situation, pas de le lui faire
 * reciter : un terme croise dans la replique d'un directeur d'agence s'ancre
 * autrement qu'un terme lu sur une carte. D'ou la consigne de n'en placer que
 * s'ils tombent juste — un dialogue sature de jargon serait contre-productif.
 */
function vocabularySection(vocabulaire) {
  if (vocabulaire.length === 0) return ''

  const liste = vocabulaire.map((entry) => `"${entry.term}" (${entry.translation})`).join(', ')

  return `- She is currently building this business vocabulary: ${liste}. Weave one or two of these terms into your reply WHEN THEY GENUINELY FIT the conversation, so she meets them in context. Never force them in, and never more than two per reply.
- In "suggestedVocabulary", pick from that same list whenever a term is relevant to what she just wrote; only propose a term outside the list when nothing in it fits.
`
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

// Consigne de ton, partagee par tous les prompts. Toute l'interface tutoie ;
// sans cette ligne le modele vouvoie environ une fois sur deux, et le decalage
// se voit immediatement a l'ecran, sur une app qui se veut familiere.
export const TUTOIEMENT =
  'All French text you produce addresses her directly with "tu" (tutoiement), never "vous". The whole app does.'

// Contexte reel d'usage : l'anglais est ici une langue de travail entre
// Europeens, pas la langue maternelle d'un des deux cotes. Sans cette consigne,
// le modele produit spontanement des interlocuteurs americains et un anglais
// idiomatique qui ne correspond a aucune de ses reunions.
export const CONTEXTE_EUROPEEN = `WORKING CONTEXT: English is her working language, and her counterparts' too. She deals with Spanish, German and British colleagues, clients and agencies across Europe. She does NOT work with Americans — never cast an American character, and never use American slang or cultural references.

Speak the clear, idiom-light international English that Europeans actually use with each other. Non-British characters must sound like fluent non-native speakers: correct and professional, but plainer and more direct than a native would be.`

// Seuil de correction. C'est la consigne la plus importante du feedback : sans
// elle, le modele trouve TOUJOURS quelque chose a redire, et ce harcelement de
// details est exactement ce qui reactive le blocage qu'on cherche a lever.
export const SEUIL_CORRECTION = `CORRECTION THRESHOLD — this matters more than anything else in the feedback. Her goal is NOT to become bilingual, and NOT to speak flawless English. It is to hold her own credibly in professional meetings. So correct ONLY what actually gets in her way:
- something a European colleague could genuinely misunderstand;
- something that undermines her authority, or sounds unintentionally rude, curt or unsure;
- a mistake so systematic that it will follow her into every meeting.

Stay SILENT about: a missing or wrong article, a slightly off preposition, a singular/plural slip, unusual but perfectly clear word order, a tense that is not ideal but understood — in short, anything a fluent non-native European speaker would also produce. Her counterparts make those mistakes constantly and nobody notices.

If a turn contains nothing worth correcting, return an EMPTY "corrections" array and tell her warmly that it went through fine. That is a frequent and desirable outcome, not a failure to find something. Never invent a correction to fill the space.`

export function asString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function asArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []
}
