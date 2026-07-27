// Schema unique de la progression, versionne.
//
// Tout tient dans UN seul objet serialisable, volontairement : c'est ce qui rend
// la migration vers Cloudflare KV triviale (un blob JSON par utilisatrice, comme
// dans Golf Tracker). Aucun composant ne doit ecrire dans localStorage
// directement : tout passe par progressStore.js.

export const SCHEMA_VERSION = 2

export const STORAGE_KEY = 'coach-anglais:progress'

/** Niveaux restitues par le test de placement (echelle informative). */
export const LEVELS = ['A2', 'B1', 'B2']

/**
 * Etat vierge, avant tout test de placement.
 *
 * Conventions :
 * - toutes les dates sont des chaines ISO 8601 (comparables et lisibles en JSON) ;
 * - les collections indexees sont des objets `{ [id]: valeur }` pour permettre
 *   une mise a jour ponctuelle sans reecrire tout un tableau.
 */
export function createInitialState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),

    // Resultat du dernier test de placement.
    profile: {
      level: null, // 'A2' | 'B1' | 'B2' | null tant que le test n'est pas passe
      assessedAt: null,
      weakPoints: [], // ex: ['present-perfect-vs-past-simple', 'prepositions']
    },

    // Historique des tests, pour tracer la progression dans le temps.
    placementTests: [], // { id, takenAt, level, score, total, weakPoints[] }

    // Historique des sessions terminees (dialogue / grammaire / vocabulaire).
    sessions: [], // { id, startedAt, endedAt, type, ref, summary }

    // Suivi grammatical : ce qui est acquis vs a retravailler en priorite.
    grammar: {
      mastered: [], // ids de topics (voir shared/grammarTopics.js)
      toReview: [], // ids ordonnes par priorite, alimentes par le test
      stats: {}, // topicId -> { attempts, correct, lastSeenAt }
    },

    // Vocabulaire metier deja rencontre.
    vocabulary: {
      seen: {}, // termId -> { seenCount, lastSeenAt, mastered }
    },

    // Erreurs recurrentes detectees par le feedback correctif, toutes sources
    // confondues : c'est la matiere premiere du module grammaire.
    recurringErrors: {}, // errorTag -> { count, lastSeenAt, examples[] }

    // Test de placement en cours, s'il y en a un. Le brief impose de pouvoir
    // reprendre un test interrompu : les items generes coutent un appel Gemini
    // et le test dure 10 minutes, le refaire de zero serait doublement punitif.
    // Remis a null des que le test est evalue ou abandonne explicitement.
    placementDraft: null, // { id, startedAt, index, items[], answers{} }
  }
}

/**
 * Migrations successives, indexees par version de depart.
 * Ajouter une entree `[n]: (state) => next` a chaque evolution du schema, et
 * incrementer SCHEMA_VERSION. Ne jamais modifier une migration deja livree.
 */
const MIGRATIONS = {
  // v1 -> v2 : arrivee du test de placement reprenable.
  1: (state) => ({ ...state, schemaVersion: 2, placementDraft: null }),
}

/**
 * Amene un etat quelconque a la version courante du schema.
 * Retourne toujours un objet exploitable : en cas d'etat illisible ou de
 * migration manquante, on repart d'un etat vierge plutot que de planter l'app.
 */
export function migrate(state) {
  if (!state || typeof state !== 'object' || typeof state.schemaVersion !== 'number') {
    return createInitialState()
  }

  let current = state
  while (current.schemaVersion < SCHEMA_VERSION) {
    const migration = MIGRATIONS[current.schemaVersion]
    if (!migration) return createInitialState()
    current = migration(current)
  }

  // Un etat plus recent que le code (retour arriere de version) n'est pas
  // interpretable : on prefere repartir de zero que corrompre la progression.
  if (current.schemaVersion > SCHEMA_VERSION) return createInitialState()

  return { ...createInitialState(), ...current }
}
