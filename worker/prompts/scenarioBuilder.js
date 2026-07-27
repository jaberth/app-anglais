// Fabrique un scenario de dialogue a partir d'une situation decrite librement.
//
// L'ecran de creation est conversationnel : elle decrit sa situation, le modele
// propose un scenario, elle l'ajuste ("plutot un client americain", "il est
// agressif"). Chaque ajustement rejoue la generation complete avec l'historique
// des demandes, plutot que de patcher le scenario precedent — c'est plus simple
// et le resultat reste coherent.
//
// Les champs produits sont exactement ceux des scenarios livres avec l'app :
// titre, description et objectifs en francais (ils s'affichent a l'ecran), role
// et replique d'ouverture en anglais (ils entrent dans le prompt du dialogue).

import { normalizeCustomScenario } from '../../shared/scenarios.js'
import { stripCodeFence, asString, TUTOIEMENT, CONTEXTE_EUROPEEN } from './dialogue.js'

const MAX_DESCRIPTION_LENGTH = 1200
const MAX_REFINEMENTS = 6
const MAX_REFINEMENT_LENGTH = 300

export function buildScenarioRequest({ description, refinements }) {
  const situation = asString(description)
  if (!situation) throw new Error('Description manquante')
  if (situation.length > MAX_DESCRIPTION_LENGTH) throw new Error('Description trop longue')

  const ajustements = (Array.isArray(refinements) ? refinements : [])
    .map((item) => asString(item).slice(0, MAX_REFINEMENT_LENGTH))
    .filter(Boolean)
    .slice(-MAX_REFINEMENTS)

  const demande = [
    `Situation décrite par l'utilisatrice :\n${situation}`,
    ...ajustements.map((ajustement, index) => `Ajustement ${index + 1} : ${ajustement}`),
  ].join('\n\n')

  return {
    systemPrompt: SYSTEM_PROMPT,
    contents: [{ role: 'user', parts: [{ text: demande }] }],
  }
}

const SYSTEM_PROMPT = `You turn a real professional situation, described in French by a French Digital Marketing & Creative Director, into a role-play scenario for English conversation practice.

${TUTOIEMENT}

${CONTEXTE_EUROPEEN}

She is assessed around B1, under-confident when speaking, and practises meetings in English. The scenario must be a realistic WORK conversation she could actually have.

Unless her description names a nationality, cast a European counterpart — Spanish, German or British — and say which one in "aiRole". Never cast an American, even when the situation would make one plausible.

Produce:
- "title": a short French label she will recognise in a list (max 8 words).
- "subtitle": the same situation named in English, in a few words.
- "description": 1-2 sentences in French situating the scene — who she is talking to, about what, and what is at stake.
- "aiRole": in English, the character YOU will play, described the way a casting brief would: seniority, nationality if it matters, and above all attitude (impatient, evasive, sceptical, friendly). This single line drives the whole role-play, so make it specific.
- "userRole": in English, who SHE is in this conversation.
- "opener": in English, the first line your character says to open the conversation. It must sound spoken, not written, and end with a question or an explicit invitation to respond, so she never faces a blank screen.
- "goals": 2 to 4 concrete objectives in French, each one an action she should manage to perform during the conversation (not a vague theme).

If her description is vague, make reasonable professional assumptions rather than asking questions — she can adjust afterwards.

If the description is not a professional conversation at all, still produce the closest realistic work scenario, and say so in "description".

Answer ONLY with a valid JSON object:
{
  "title": string,
  "subtitle": string,
  "description": string,
  "aiRole": string,
  "userRole": string,
  "opener": string,
  "goals": [string]
}`

export function parseScenarioResponse(text) {
  const parsed = JSON.parse(stripCodeFence(text))

  const scenario = normalizeCustomScenario(parsed)
  if (!scenario) throw new Error('Scenario incomplet')

  return { scenario }
}
