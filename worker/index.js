// Point d'entree unique du Worker Cloudflare (Workers + Static Assets).
//
// Deux responsabilites :
//  1. /api/* : proxy securise vers l'API Gemini. La cle vit dans le Secrets
//     Store Cloudflare et n'est JAMAIS exposee au navigateur.
//  2. tout le reste : les fichiers statiques du build Vite (dist/), servis via
//     le binding ASSETS.

import { verifyAccessJwt } from './access.js'
import { buildDialogueRequest, parseDialogueResponse } from './prompts/dialogue.js'
import { buildGrammarRequest, parseGrammarResponse } from './prompts/grammar.js'
import {
  buildPlacementTestRequest,
  parsePlacementTestResponse,
  buildPlacementEvaluationRequest,
  parsePlacementEvaluationResponse,
} from './prompts/placementTest.js'

// Modele epingle explicitement, jamais un alias type `gemini-flash-latest` : le
// Worker depend d'un format JSON strict, un changement de modele silencieux le
// casserait sans que rien ne le signale.
//
// gemini-2.5-flash n'est plus servi aux projets Google Cloud crees recemment
// (404 "no longer available to new users"), alors qu'il apparait encore dans le
// listing des modeles. Ne pas y revenir.
const GEMINI_MODEL = 'gemini-3.6-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// Meme origine uniquement : le front est servi par ce meme Worker, donc aucune
// raison d'ouvrir CORS a des tiers (et donc au pillage du quota Gemini).
const JSON_HEADERS = { 'content-type': 'application/json' }

// Table de routage : chaque route decrit comment fabriquer la requete Gemini
// et comment interpreter sa reponse. Ajouter une capacite = ajouter une entree.
const ROUTES = {
  '/api/placement-test': {
    build: buildPlacementTestRequest,
    parse: parsePlacementTestResponse,
  },
  '/api/placement-test/evaluate': {
    build: buildPlacementEvaluationRequest,
    parse: parsePlacementEvaluationResponse,
  },
  '/api/dialogue': {
    build: buildDialogueRequest,
    parse: parseDialogueResponse,
  },
  '/api/grammar': {
    build: buildGrammarRequest,
    parse: parseGrammarResponse,
  },
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      const route = ROUTES[url.pathname]
      if (!route) return jsonError('Route inconnue', 404)

      // Seules les routes /api/* consomment du quota Gemini : c'est la ce qu'il
      // y a a proteger. Les assets statiques ne sont qu'une coquille sans
      // elles, et Access les couvre de toute facon en amont.
      if (!isLocalDev(url)) {
        const identity = await verifyAccessJwt(request, env)
        if (!identity) return jsonError('Non authentifie', 401)
      }

      return handleAiRoute(request, env, route)
    }

    const assetResponse = await env.ASSETS.fetch(request)
    // Defense en profondeur : meme si Cloudflare Access etait un jour desactive
    // par erreur, on demande explicitement aux robots de ne pas indexer l'app.
    const response = new Response(assetResponse.body, assetResponse)
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return response
  },
}

async function handleAiRoute(request, env, route) {
  if (request.method !== 'POST') {
    return jsonError('Methode non autorisee', 405)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('Corps de requete JSON invalide', 400)
  }

  let geminiRequest
  try {
    geminiRequest = route.build(body)
  } catch (error) {
    // Les fonctions build() valident leur entree et levent sur donnee invalide.
    return jsonError(error.message || 'Parametres invalides', 400)
  }

  const text = await callGemini(env, geminiRequest)
  if (!text.ok) return jsonError(text.error, text.status)

  let payload
  try {
    payload = route.parse(text.value)
  } catch {
    // Le modele n'a pas respecte le format demande : on ne renvoie pas sa sortie
    // brute au client, elle n'est pas exploitable par l'UI.
    return jsonError('Reponse du modele inexploitable', 502)
  }

  return new Response(JSON.stringify(payload), { status: 200, headers: JSON_HEADERS })
}

/**
 * Appelle Gemini et retourne le texte concatene des parts.
 * Retourne { ok: true, value } ou { ok: false, error, status }.
 */
async function callGemini(env, { systemPrompt, contents, generationConfig }) {
  let response
  try {
    // Le binding Secrets Store expose un objet, pas la valeur directement :
    // il faut l'appel asynchrone .get() pour recuperer la cle reelle.
    const apiKey = await env.GEMINI_API_KEY.get()

    response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          // Le coach doit produire du JSON strict : on evite la creativite
          // sur la structure, pas sur le contenu pedagogique.
          responseMimeType: 'application/json',
          ...generationConfig,
        },
      }),
    })
  } catch (error) {
    // Le detail va dans les logs du Worker (wrangler tail), jamais dans la
    // reponse : le client n'a pas a savoir comment on parle a Gemini.
    console.error('[gemini] echec reseau', error?.message)
    return { ok: false, error: "Erreur reseau lors de l'appel a l'API Gemini", status: 502 }
  }

  // Jamais .json() direct : on lit le texte brut d'abord, en try/catch.
  const rawBody = await response.text()

  if (!response.ok) {
    // Idem : seul le log serveur porte le detail renvoye par Gemini. Ce corps
    // ne contient jamais la cle, uniquement le motif du refus.
    console.error(`[gemini] HTTP ${response.status} ${rawBody.slice(0, 400)}`)

    // 429 = quota atteint : on le transmet tel quel pour que l'UI affiche un
    // message specifique plutot qu'une erreur generique.
    return {
      ok: false,
      error: response.status === 429 ? 'Quota Gemini atteint' : 'Erreur API Gemini',
      status: response.status === 429 ? 429 : 502,
    }
  }

  let parsed
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return { ok: false, error: 'Reponse Gemini illisible', status: 502 }
  }

  const parts = parsed.candidates?.[0]?.content?.parts || []
  const value = parts
    .map((part) => part.text || '')
    .join('')
    .trim()

  if (!value) return { ok: false, error: 'Reponse Gemini vide', status: 502 }

  return { ok: true, value }
}

/**
 * `wrangler dev` sert le Worker sur localhost, ou aucun jeton Access n'existe :
 * l'exiger rendrait tout developpement local impossible. En production le
 * Worker n'est joignable que via son hostname workers.dev (ou son domaine
 * personnalise) — c'est ce hostname qui arrive ici, et le routage Cloudflare en
 * depend, donc il ne peut pas etre remplace par "localhost" par un tiers.
 */
function isLocalDev(url) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS })
}
