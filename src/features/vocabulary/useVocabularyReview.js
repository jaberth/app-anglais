// Sequence de revision par cartes.
//
// Aucun appel a Gemini ici : le contenu est statique, et le rappel actif
// (essayer de se souvenir avant de retourner la carte) n'a pas besoin d'un
// modele pour fonctionner. C'est aussi le seul module utilisable hors ligne.

import { useCallback, useState } from 'react'
import { buildReviewSequence, getVocabularyEntry } from '../../../shared/vocabulary.js'

const TAILLE_SEQUENCE = 8

export function useVocabularyReview({ progress, updateProgress }) {
  // Initialiseur paresseux : la sequence est fixee au montage et ne doit pas se
  // reordonner sous les doigts de l'utilisatrice au fil de ses reponses — or
  // chaque reponse reecrit la progression, donc `seen`.
  const [sequence] = useState(() =>
    buildReviewSequence({ seen: progress.vocabulary.seen, size: TAILLE_SEQUENCE })
      .map(getVocabularyEntry)
      .filter(Boolean),
  )

  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [resultats, setResultats] = useState({})
  const [finished, setFinished] = useState(false)

  const reveal = useCallback(() => setRevealed(true), [])

  const answer = useCallback(
    async (known) => {
      const entry = sequence[index]
      if (!entry) return

      const suivants = { ...resultats, [entry.id]: known }
      setResultats(suivants)

      if (index < sequence.length - 1) {
        setIndex(index + 1)
        setRevealed(false)
        return
      }

      const at = new Date().toISOString()
      const acquis = Object.values(suivants).filter(Boolean).length

      await updateProgress((state) => ({
        ...state,
        vocabulary: {
          ...state.vocabulary,
          seen: appliquerResultats(state.vocabulary.seen, suivants, at),
        },
        sessions: [
          ...state.sessions,
          {
            id: crypto.randomUUID(),
            startedAt: at,
            endedAt: at,
            type: 'vocabulary',
            ref: null,
            summary: `${sequence.length} termes, ${acquis} acquis`,
          },
        ],
      }))

      setFinished(true)
    },
    [index, resultats, sequence, updateProgress],
  )

  return {
    sequence,
    index,
    revealed,
    resultats,
    finished,
    current: sequence[index] ?? null,
    reveal,
    answer,
  }
}

/**
 * Reporte les reponses sur le suivi.
 *
 * `mastered` suit la DERNIERE reponse et n'est pas cumulatif : un terme qu'elle
 * ne retrouve plus redevient a revoir, meme s'il avait ete marque acquis. C'est
 * ce qui fait remonter les termes qui s'effacent, plutot que de les considerer
 * comme definitivement acquis.
 */
function appliquerResultats(current, resultats, at) {
  const next = { ...current }

  for (const [id, known] of Object.entries(resultats)) {
    const previous = next[id] ?? { seenCount: 0, lastSeenAt: null, mastered: false }
    next[id] = {
      seenCount: previous.seenCount + 1,
      lastSeenAt: at,
      mastered: known,
    }
  }

  return next
}
