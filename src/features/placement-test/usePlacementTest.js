// Machine a etats du test de placement.
//
// Toute la logique vit ici pour que PlacementTestPage ne fasse que du rendu.
// Trois responsabilites :
//  1. enchainer generation -> passage -> evaluation ;
//  2. persister un brouillon a chaque reponse, pour reprendre un test interrompu ;
//  3. ecrire le resultat dans la progression (profil, historique, file de revision).
//
// Le brouillon est une exigence du brief : les items coutent un appel Gemini et
// le test dure 10 minutes. Fermer l'app par accident ne doit pas tout annuler.

import { useCallback, useEffect, useRef, useState } from 'react'
import { evaluatePlacementTest, generatePlacementTest } from '../../lib/api/coachClient.js'
import { buildReviewQueue, getGrammarTopic } from '../../data/grammarTopics.js'

const ITEM_COUNT = 18

/** Phases de l'ecran : intro | generating | running | evaluating | result | error */
export function usePlacementTest({ progress, updateProgress }) {
  // Lecture unique au premier rendu : ensuite c'est l'etat local qui fait foi,
  // sinon chaque ecriture du brouillon relancerait le test depuis le store.
  const [resumable, setResumable] = useState(() => readDraft(progress))

  const [phase, setPhase] = useState('intro')
  const [testId, setTestId] = useState(null)
  const [startedAt, setStartedAt] = useState(null)
  const [items, setItems] = useState([])
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Une seule requete en vol a la fois, annulee si l'ecran est quitte.
  const abortRef = useRef(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  /** Ecrit le brouillon. Volontairement non attendu : la saisie ne doit jamais
   *  attendre le stockage. */
  const persistDraft = useCallback(
    (draft) => {
      updateProgress((state) => ({ ...state, placementDraft: draft })).catch(() => {
        // Stockage indisponible (navigation privee) : le test reste jouable en
        // memoire, seule la reprise est perdue. Rien a signaler a l'utilisatrice.
      })
    },
    [updateProgress],
  )

  const start = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setPhase('generating')
    setError(null)

    try {
      const { items: generated } = await generatePlacementTest(
        { itemCount: ITEM_COUNT },
        { signal: controller.signal },
      )
      if (!aliveRef.current || controller.signal.aborted) return

      const id = crypto.randomUUID()
      const openedAt = new Date().toISOString()
      setTestId(id)
      setStartedAt(openedAt)
      setItems(generated)
      setAnswers({})
      setIndex(0)
      setResumable(null)
      setPhase('running')
      persistDraft({ id, startedAt: openedAt, index: 0, items: generated, answers: {} })
    } catch (caught) {
      if (caught.name === 'AbortError' || !aliveRef.current) return
      setError({ message: caught.message, action: 'generate' })
      setPhase('error')
    }
  }, [persistDraft])

  const resume = useCallback(() => {
    if (!resumable) return
    setTestId(resumable.id)
    setStartedAt(resumable.startedAt)
    setItems(resumable.items)
    setAnswers(resumable.answers)
    // Un brouillon corrompu ne doit pas pointer hors des items.
    setIndex(Math.max(0, Math.min(resumable.index, resumable.items.length - 1)))
    setResumable(null)
    setPhase('running')
  }, [resumable])

  /** Abandonne le test en cours et efface le brouillon. */
  const discard = useCallback(() => {
    setResumable(null)
    setTestId(null)
    setStartedAt(null)
    setItems([])
    setAnswers({})
    setIndex(0)
    setResult(null)
    setError(null)
    setPhase('intro')
    persistDraft(null)
  }, [persistDraft])

  const submit = useCallback(
    async (finalAnswers = answers) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setPhase('evaluating')
      setError(null)

      try {
        const evaluation = await evaluatePlacementTest(
          { answers: buildAnswersPayload(items, finalAnswers) },
          { signal: controller.signal },
        )
        if (!aliveRef.current || controller.signal.aborted) return

        warnUnknownTags(evaluation.weakPoints)

        const takenAt = new Date().toISOString()
        const total = evaluation.total || items.length
        const entry = {
          id: testId ?? crypto.randomUUID(),
          takenAt,
          level: evaluation.level,
          score: evaluation.score,
          total,
          weakPoints: evaluation.weakPoints,
        }

        await updateProgress((state) => ({
          ...state,
          profile: {
            level: evaluation.level,
            assessedAt: takenAt,
            weakPoints: evaluation.weakPoints,
          },
          placementTests: [...state.placementTests, entry],
          grammar: {
            ...state.grammar,
            toReview: buildReviewQueue({
              weakPointTags: evaluation.weakPoints.map((point) => point.topicTag),
              masteredTags: state.grammar.mastered,
            }),
          },
          // Le test est evalue : le brouillon n'a plus de raison d'exister.
          placementDraft: null,
        }))

        if (!aliveRef.current) return
        setResult({ ...evaluation, total })
        setPhase('result')
      } catch (caught) {
        if (caught.name === 'AbortError' || !aliveRef.current) return
        // On garde items et answers : le brouillon est intact, elle peut
        // relancer l'evaluation sans repasser le test.
        setError({ message: caught.message, action: 'evaluate' })
        setPhase('error')
      }
    },
    [answers, items, testId, updateProgress],
  )

  /** Enregistre la reponse a l'item courant puis avance (ou declenche l'evaluation). */
  const answerAndAdvance = useCallback(
    (value) => {
      const item = items[index]
      if (!item) return

      const nextAnswers = { ...answers, [item.id]: value }
      const isLast = index === items.length - 1
      const nextIndex = isLast ? index : index + 1

      setAnswers(nextAnswers)
      persistDraft({ id: testId, startedAt, index: nextIndex, items, answers: nextAnswers })

      if (isLast) {
        submit(nextAnswers)
        return
      }
      setIndex(nextIndex)
    },
    [answers, index, items, persistDraft, startedAt, submit, testId],
  )

  const goBack = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1))
  }, [])

  const retry = useCallback(() => {
    if (error?.action === 'evaluate') return submit()
    return start()
  }, [error, start, submit])

  return {
    phase,
    items,
    index,
    answers,
    result,
    error,
    resumable,
    currentItem: items[index] ?? null,
    start,
    resume,
    discard,
    goBack,
    answerAndAdvance,
    retry,
  }
}

// Tags legitimes qui ne sont pas des points de grammaire : le prompt du test les
// autorise explicitement, ils n'ont donc pas a declencher d'alerte.
const NON_GRAMMAR_TAGS = new Set(['comprehension', 'general', 'vocabulary', 'writing'])

/**
 * Un topicTag absent de GRAMMAR_TOPICS est ignore par buildReviewQueue() : le
 * point faible s'affiche dans la restitution mais ne remonte jamais dans la file
 * de revision. C'est le piege documente dans CLAUDE.md.
 *
 * Volontairement PAS conditionne a import.meta.env.DEV : `npm run dev:worker`,
 * seul mode ou /api/* repond, sert le build de production. Une alerte reservee
 * au mode dev ne se declencherait donc jamais la ou elle sert. Le cout est nul
 * (console uniquement, jamais visible dans l'UI).
 */
function warnUnknownTags(weakPoints) {
  const unknown = weakPoints
    .map((point) => point.topicTag)
    .filter((tag) => tag && !NON_GRAMMAR_TAGS.has(tag) && !getGrammarTopic(tag))

  if (unknown.length > 0) {
    console.warn(
      `[placement] topicTag inconnu de GRAMMAR_TOPICS, ignore par la file de revision : ${unknown.join(', ')}`,
    )
  }
}

/** Ne retient un brouillon que s'il est reellement rejouable. */
function readDraft(progress) {
  const draft = progress?.placementDraft
  if (!draft || !Array.isArray(draft.items) || draft.items.length === 0) return null

  return {
    id: draft.id ?? crypto.randomUUID(),
    startedAt: draft.startedAt ?? null,
    index: Number.isInteger(draft.index) ? draft.index : 0,
    items: draft.items,
    answers: draft.answers && typeof draft.answers === 'object' ? draft.answers : {},
  }
}

/**
 * Met les reponses en forme pour l'evaluation.
 * Les QCM sont corriges ici (`correct`) : le prompt d'evaluation les recoit
 * deja notes et ne s'occupe que des questions ouvertes. Le `passage` n'est
 * joint qu'aux items ouverts, seuls a en avoir besoin pour etre corriges — le
 * reste ne ferait que gonfler le nombre de tokens factures.
 */
function buildAnswersPayload(items, answers) {
  return items.map((item) => {
    const given = answers[item.id]

    if (item.type === 'mcq') {
      const selectedIndex = Number.isInteger(given?.selectedIndex) ? given.selectedIndex : null
      return {
        id: item.id,
        type: 'mcq',
        skill: item.skill,
        topicTag: item.topicTag,
        level: item.level,
        prompt: item.prompt,
        choices: item.choices,
        expectedIndex: item.answerIndex,
        selectedIndex,
        skipped: selectedIndex === null,
        correct: selectedIndex === item.answerIndex,
      }
    }

    const response = typeof given?.text === 'string' ? given.text.trim() : ''
    return {
      id: item.id,
      type: 'open',
      skill: item.skill,
      topicTag: item.topicTag,
      level: item.level,
      prompt: item.prompt,
      passage: item.passage,
      response,
      skipped: response === '',
    }
  })
}
