// Serie d'exercices sur un point de grammaire.
//
// Difference avec le test de placement : ici la correction est IMMEDIATE. Le
// test mesure et ne doit rien reveler ; l'exercice enseigne, et une regle
// expliquee au moment ou l'erreur est fraiche s'ancre bien mieux qu'un bilan
// lu dix questions plus tard.

import { useCallback, useEffect, useRef, useState } from 'react'
import { generateGrammarExercises } from '../../lib/api/coachClient.js'

// Seuil de maitrise. Volontairement exigeant mais pas parfait : demander 100 %
// rendrait le point impossible a sortir de la file sur une inattention.
const SEUIL_MAITRISE = 0.8

export function useGrammarDrill({ progress, updateProgress }) {
  const [phase, setPhase] = useState('idle')
  const [topicId, setTopicId] = useState(null)
  const [items, setItems] = useState([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [error, setError] = useState(null)

  const startedAtRef = useRef(null)
  const abortRef = useRef(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const start = useCallback(
    async (id) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setTopicId(id)
      setPhase('loading')
      setError(null)

      try {
        const { items: generated } = await generateGrammarExercises(
          {
            topicId: id,
            level: progress.profile.level ?? 'B1',
            // Ses propres fautes sur ce point, collectees en dialogue.
            examples: progress.recurringErrors[id]?.examples ?? [],
          },
          { signal: controller.signal },
        )
        if (!aliveRef.current || controller.signal.aborted) return

        startedAtRef.current = new Date().toISOString()
        setItems(generated)
        setIndex(0)
        setAnswers({})
        setPhase('running')
      } catch (caught) {
        if (caught.name === 'AbortError' || !aliveRef.current) return
        setError({ message: caught.message, kind: caught.kind })
        setPhase('error')
      }
    },
    [progress.profile.level, progress.recurringErrors],
  )

  /** Enregistre la reponse. La correction s'affiche aussitot, sans avancer. */
  const answer = useCallback(
    (choiceIndex) => {
      const item = items[index]
      if (!item || answers[item.id] !== undefined) return
      setAnswers((current) => ({ ...current, [item.id]: choiceIndex }))
    },
    [answers, index, items],
  )

  const finish = useCallback(
    async (finalAnswers) => {
      const correct = items.filter((item) => finalAnswers[item.id] === item.answerIndex).length
      const ratio = items.length > 0 ? correct / items.length : 0
      const at = new Date().toISOString()

      await updateProgress((state) => {
        const stats = state.grammar.stats[topicId] ?? { attempts: 0, correct: 0, lastSeenAt: null }
        const maitrise = ratio >= SEUIL_MAITRISE

        return {
          ...state,
          grammar: {
            ...state.grammar,
            stats: {
              ...state.grammar.stats,
              [topicId]: {
                attempts: stats.attempts + items.length,
                correct: stats.correct + correct,
                lastSeenAt: at,
              },
            },
            mastered:
              maitrise && !state.grammar.mastered.includes(topicId)
                ? [...state.grammar.mastered, topicId]
                : state.grammar.mastered,
          },
          recurringErrors: decrementerErreurs(state.recurringErrors, topicId, correct),
          sessions: [
            ...state.sessions,
            {
              id: crypto.randomUUID(),
              startedAt: startedAtRef.current ?? at,
              endedAt: at,
              type: 'grammar',
              ref: topicId,
              summary: `${correct} / ${items.length} sur ce point`,
            },
          ],
        }
      })

      if (aliveRef.current) setPhase('result')
    },
    [items, topicId, updateProgress],
  )

  /** Passe a l'item suivant, ou cloture la serie. */
  const next = useCallback(() => {
    if (index < items.length - 1) {
      setIndex(index + 1)
      return
    }
    finish(answers)
  }, [answers, finish, index, items.length])

  const quit = useCallback(() => {
    abortRef.current?.abort()
    setPhase('idle')
    setTopicId(null)
    setItems([])
    setAnswers({})
    setIndex(0)
    setError(null)
  }, [])

  const currentItem = items[index] ?? null
  const correctCount = items.filter((item) => answers[item.id] === item.answerIndex).length

  return {
    phase,
    topicId,
    items,
    index,
    answers,
    error,
    currentItem,
    correctCount,
    // La reponse a l'item courant est-elle deja donnee (donc corrigee) ?
    answered: currentItem ? answers[currentItem.id] !== undefined : false,
    seuilMaitrise: SEUIL_MAITRISE,
    start,
    answer,
    next,
    quit,
    retry: () => start(topicId),
  }
}

/**
 * Reduit le compteur d'erreurs recurrentes du point travaille, d'une unite par
 * bonne reponse. L'entree disparait quand elle tombe a zero : la lacune a ete
 * traitee, elle n'a plus a peser sur l'ordre de la file de revision.
 */
function decrementerErreurs(current, topicId, correct) {
  const entree = current[topicId]
  if (!entree || correct <= 0) return current

  const next = { ...current }
  const restant = Math.max(0, entree.count - correct)

  if (restant === 0) {
    delete next[topicId]
  } else {
    next[topicId] = { ...entree, count: restant }
  }

  return next
}
