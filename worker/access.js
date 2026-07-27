// Verification du jeton Cloudflare Access.
//
// Access refuse deja les requetes non authentifiees en amont du Worker. Ce
// module est une defense en profondeur : si Access etait desactive par erreur,
// mal configure, ou si le Worker etait un jour joignable par un autre chemin,
// l'URL workers.dev laisserait n'importe qui bruler le quota Gemini. L'app n'a
// aucune authentification applicative, c'est donc la seule barriere restante.
//
// On ne fait PAS confiance a l'en-tete Cf-Access-Authenticated-User-Email :
// n'importe quel client peut l'inventer. On verifie la signature RS256 du jeton
// contre le JWKS du locataire Zero Trust.
//
// Ecrit sur le modele de Golf Tracker, avec trois durcissements :
//  - l'algorithme annonce est verifie (refus de tout ce qui n'est pas RS256) ;
//  - l'emetteur est verifie, pour qu'un jeton signe par un autre locataire
//    Access ne soit pas accepte ;
//  - le JWKS est reinterroge une fois si le `kid` est inconnu, sinon une
//    rotation de cle rendrait l'app inaccessible jusqu'a expiration du cache.

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000

let cachedJwks = null
let cachedJwksAt = 0

/**
 * Retourne le payload du jeton si celui-ci est authentique, sinon null.
 * Aucune exception ne sort d'ici : tout echec est un refus.
 */
export async function verifyAccessJwt(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!token) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, signatureB64] = parts

  let header
  let payload
  try {
    header = JSON.parse(base64UrlToString(headerB64))
    payload = JSON.parse(base64UrlToString(payloadB64))
  } catch {
    return null
  }

  // Sans ce controle, un jeton annoncant `alg: none` ou un algorithme
  // symetrique pourrait etre soumis a une verification qui ne prouve rien.
  if (header.alg !== 'RS256' || !header.kid) return null

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!env.ACCESS_AUD || !audiences.includes(env.ACCESS_AUD)) return null

  // L'emetteur attendu est l'origine du JWKS : un jeton parfaitement valide
  // mais emis par un autre locataire Cloudflare Access doit etre refuse.
  const expectedIssuer = issuerFromJwksUrl(env.ACCESS_JWKS_URL)
  if (!expectedIssuer || payload.iss !== expectedIssuer) return null

  const nowSeconds = Date.now() / 1000
  if (typeof payload.exp === 'number' && nowSeconds > payload.exp) return null
  if (typeof payload.nbf === 'number' && nowSeconds < payload.nbf) return null

  const key = await findSigningKey(env.ACCESS_JWKS_URL, header.kid)
  if (!key) return null

  let cryptoKey
  try {
    cryptoKey = await crypto.subtle.importKey(
      'jwk',
      key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
  } catch {
    return null
  }

  let valid
  try {
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      base64UrlToBytes(signatureB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    )
  } catch {
    return null
  }

  return valid ? payload : null
}

/**
 * Cherche la cle correspondant au `kid`. Si elle est absente du cache, on
 * reinterroge le JWKS une seule fois : Access fait tourner ses cles, et sans ce
 * rafraichissement l'app serait inaccessible jusqu'a expiration du cache.
 */
async function findSigningKey(jwksUrl, kid) {
  let jwks = await fetchJwks(jwksUrl, false)
  let key = jwks?.keys?.find((candidate) => candidate.kid === kid)
  if (key) return key

  jwks = await fetchJwks(jwksUrl, true)
  key = jwks?.keys?.find((candidate) => candidate.kid === kid)
  return key ?? null
}

async function fetchJwks(jwksUrl, force) {
  const now = Date.now()
  if (!force && cachedJwks && now - cachedJwksAt < JWKS_CACHE_TTL_MS) {
    return cachedJwks
  }

  try {
    const response = await fetch(jwksUrl)
    if (!response.ok) return cachedJwks
    const jwks = await response.json()
    cachedJwks = jwks
    cachedJwksAt = now
    return jwks
  } catch {
    // Panne reseau : on garde le cache existant plutot que de bloquer une
    // utilisatrice legitime. Si le cache est vide, la verification echouera.
    return cachedJwks
  }
}

function issuerFromJwksUrl(jwksUrl) {
  try {
    return new URL(jwksUrl).origin
  } catch {
    return null
  }
}

function base64UrlToBytes(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64UrlToString(base64Url) {
  return new TextDecoder().decode(base64UrlToBytes(base64Url))
}
