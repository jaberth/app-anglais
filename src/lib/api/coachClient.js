// Client HTTP vers le Worker Cloudflare.
//
// IMPORTANT : aucune cle Gemini ne transite ici. Le navigateur ne parle qu'au
// Worker (meme origine), qui detient seul le secret et appelle Gemini.

const API_BASE = '/api'

/**
 * `kind` permet a l'UI de proposer la bonne action sans reinterpreter le
 * message : 'session' appelle un rechargement, 'quota' une attente, le reste
 * une nouvelle tentative.
 */
class CoachApiError extends Error {
  constructor(message, { status, detail, kind = 'server' } = {}) {
    super(message)
    this.name = 'CoachApiError'
    this.status = status
    this.detail = detail
    this.kind = kind
  }
}

const SESSION_EXPIREE = 'Ta session a expiré. Recharge la page pour te reconnecter.'

async function postJSON(path, body, { signal } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
      // Sans `manual`, la redirection que Cloudflare Access renvoie vers sa page
      // de connexion serait suivie vers un autre domaine, echouerait sur CORS,
      // et arriverait ici en simple TypeError — indiscernable d'une coupure
      // reseau. On la veut visible pour pouvoir la nommer.
      redirect: 'manual',
    })
  } catch (error) {
    // AbortError = l'utilisatrice a quitte l'ecran, ce n'est pas une panne.
    if (error.name === 'AbortError') throw error
    throw new CoachApiError('Connexion impossible. Vérifie ta connexion internet.', {
      detail: error.message,
      kind: 'network',
    })
  }

  // Access intercepte avant le Worker : redirection vers l'ecran de connexion.
  if (response.type === 'opaqueredirect' || response.status === 0) {
    throw new CoachApiError(SESSION_EXPIREE, { status: 0, kind: 'session' })
  }

  // Access a laisse passer mais le jeton n'est plus valide : c'est le 401 pose
  // par worker/access.js.
  if (response.status === 401 || response.status === 403) {
    throw new CoachApiError(SESSION_EXPIREE, { status: response.status, kind: 'session' })
  }

  const rawBody = await response.text()

  if (!response.ok) {
    throw new CoachApiError(
      response.status === 429
        ? 'Quota Gemini atteint pour le moment. Réessaie dans quelques minutes.'
        : "Le coach n'a pas pu répondre. Réessaie dans un instant.",
      { status: response.status, detail: rawBody, kind: response.status === 429 ? 'quota' : 'server' },
    )
  }

  // Access peut aussi servir sa page de connexion en 200 : du HTML la ou on
  // attend du JSON signe la meme expiration, pas une reponse corrompue.
  if (/^\s*</.test(rawBody)) {
    throw new CoachApiError(SESSION_EXPIREE, { status: response.status, kind: 'session' })
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    throw new CoachApiError('Réponse du coach illisible.', {
      status: response.status,
      detail: rawBody,
      kind: 'server',
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
export function continueDialogue(
  { scenarioId, level, history, userMessage, vocabularyIds },
  options,
) {
  return postJSON(
    '/dialogue',
    { scenarioId, level, history, userMessage, vocabularyIds },
    options,
  )
}

/**
 * Genere une serie d'exercices ciblee sur un point de grammaire.
 * `examples` = les formulations fautives qu'elle a reellement produites en
 * dialogue sur ce point, quand il y en a.
 */
export function generateGrammarExercises({ topicId, level, examples }, options) {
  return postJSON('/grammar', { topicId, level, examples }, options)
}

export { CoachApiError }
