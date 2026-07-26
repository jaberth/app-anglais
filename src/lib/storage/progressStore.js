// Seul point d'acces a la progression persistee.
//
// L'API est volontairement ASYNCHRONE alors que localStorage est synchrone :
// c'est ce qui permettra de basculer vers Cloudflare KV (fetch vers
// /api/progress) en ne reecrivant que les trois fonctions du bas de ce fichier,
// sans toucher a un seul composant.

import { STORAGE_KEY, createInitialState, migrate } from './schema.js'

const listeners = new Set()

/** Lit la progression, en la migrant si elle vient d'une version anterieure. */
export async function loadProgress() {
  const raw = await backend.read()
  if (raw === null) return createInitialState()

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Donnees corrompues : on repart proprement plutot que de bloquer l'app.
    return createInitialState()
  }

  const migrated = migrate(parsed)
  // On reecrit immediatement l'etat migre pour ne pas rejouer la migration a
  // chaque demarrage.
  if (migrated.schemaVersion !== parsed.schemaVersion) {
    await backend.write(JSON.stringify(migrated))
  }
  return migrated
}

/** Ecrit la progression et notifie les abonnes. */
export async function saveProgress(state) {
  await backend.write(JSON.stringify(state))
  for (const listener of listeners) listener(state)
  return state
}

/**
 * Lecture-modification-ecriture atomique cote app.
 * `updater` recoit l'etat courant et doit retourner le nouvel etat (immutable).
 */
export async function updateProgress(updater) {
  const current = await loadProgress()
  const next = updater(current)
  return saveProgress(next)
}

/** Efface toute la progression (utilise par un eventuel "repartir de zero"). */
export async function resetProgress() {
  await backend.remove()
  const fresh = createInitialState()
  for (const listener of listeners) listener(fresh)
  return fresh
}

/** S'abonne aux changements. Retourne la fonction de desabonnement. */
export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// --- Backend de persistance -------------------------------------------------
// V1 : localStorage. Pour passer a Cloudflare KV, remplacer cet objet par des
// appels fetch vers le Worker ; le reste du fichier et de l'app est inchange.

const backend = {
  async read() {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      // Mode navigation privee ou stockage sature : l'app doit rester utilisable
      // le temps de la session, meme sans persistance.
      return null
    }
  },

  async write(serialized) {
    try {
      localStorage.setItem(STORAGE_KEY, serialized)
    } catch {
      // Idem : on n'interrompt pas une session en cours pour un echec d'ecriture.
    }
  },

  async remove() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Rien a faire de plus.
    }
  },
}
