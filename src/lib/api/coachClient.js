// Client HTTP vers le Worker Cloudflare.
//
// IMPORTANT : aucune cle Gemini ne transite ici. Le navigateur ne parle qu'au
// Worker (meme origine), qui detient seul le secret et appelle Gemini.

const API_BASE = '/api'

class CoachApiError extends Error {
  constructor(message, { status, detail } = {}) {
    super(message)
    this.name = 'CoachApiError'
    this.status = status
    this.detail = detail
  }
}

async function postJSON(path, body, { signal } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    // AbortError = l'utilisatrice a quitte l'ecran, ce n'est pas une panne.
    if (error.name === 'AbortError') throw error
    throw new CoachApiError('Connexion impossible. Verifie ta connexion internet.', {
      detail: error.message,
    })
  }

  const rawBody = await response.text()

  if (!response.ok) {
    throw new CoachApiError(
      response.status === 429
        ? "Quota Gemini atteint pour le moment. Reessaie dans quelques minutes."
        : "Le coach n'a pas pu repondre. Reessaie dans un instant.",
      { status: response.status, detail: rawBody },
    )
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    throw new CoachApiError('Reponse du coach illisible.', {
      status: response.status,
      detail: rawBody,
    })
  }
}

/**
 * Genere les items du test de placement.
 * TODO(V1) : brancher sur l'ecran PlacementTestPage.
 */
export function generatePlacementTest({ itemCount = 18 } = {}, options) {
  return postJSON('/placement-test', { itemCount }, options)
}

/**
 * Evalue les reponses du test et restitue niveau + points faibles.
 * TODO(V1) : brancher sur l'ecran PlacementTestPage.
 */
export function evaluatePlacementTest({ answers }, options) {
  return postJSON('/placement-test/evaluate', { answers }, options)
}

/**
 * Fait avancer un dialogue scenarise et retourne la replique suivante du role
 * joue par l'IA, accompagnee du feedback correctif sur la derniere reponse.
 * TODO(V1) : brancher sur l'ecran DialoguePage.
 */
export function continueDialogue({ scenarioId, level, history, userMessage }, options) {
  return postJSON('/dialogue', { scenarioId, level, history, userMessage }, options)
}

export { CoachApiError }
