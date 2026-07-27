// Etat d'une session de dialogue scenarise.
//
// Un tour d'utilisatrice porte son propre feedback : c'est ce qui permet de
// l'afficher juste sous sa phrase, la ou elle regarde, plutot que dans un
// encart separe qu'il faudrait aller chercher.
//
// Regle de conception issue du brief : la saisie n'est JAMAIS desactivee. Le
// blocage a l'oral se rejoue a l'ecrit des que l'interface donne l'impression
// d'attendre un verdict. Seul le bouton d'envoi s'eteint pendant l'appel, pour
// garder les tours dans l'ordre — on peut continuer a ecrire sa phrase suivante.

import { useCallback, useEffect, useRef, useState } from 'react'
import { continueDialogue } from '../../lib/api/coachClient.js'
import { getGrammarTopic, isKnownTag } from '../../../shared/grammarTopics.js'
import { VOCABULARY, vocabularyForDialogue } from '../../../shared/vocabulary.js'

const MAX_EXAMPLES_PAR_TAG = 3

export function useDialogue({ scenario, progress, updateProgress }) {
  const [turns, setTurns] = useState(() => [
    { id: crypto.randomUUID(), role: 'coach', text: scenario.opener, status: 'done' },
  ])
  const [pending, setPending] = useState(false)
  const [finished, setFinished] = useState(false)

  const startedAtRef = useRef(new Date().toISOString())
  const abortRef = useRef(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const exchange = useCallback(
    async (userTurnId, text, history) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setPending(true)

      try {
        const response = await continueDialogue(
          {
            scenarioId: scenario.id,
            level: progress.profile.level ?? 'B1',
            history,
            userMessage: text,
            // Le front decide quels termes meritent d'etre remis en circulation
            // (il connait la progression) ; le Worker se contente de les mettre
            // en forme dans le prompt.
            vocabularyIds: vocabularyForDialogue({ seen: progress.vocabulary.seen }),
          },
          { signal: controller.signal },
        )
        if (!aliveRef.current || controller.signal.aborted) return

        warnUnknownTags(response.feedback.corrections)

        setTurns((current) => [
          ...current.map((turn) =>
            turn.id === userTurnId
              ? { ...turn, status: 'done', feedback: response.feedback, error: null }
              : turn,
          ),
          {
            id: crypto.randomUUID(),
            role: 'coach',
            text: response.reply,
            status: 'done',
            vocabulary: response.suggestedVocabulary,
          },
        ])
      } catch (caught) {
        if (caught.name === 'AbortError' || !aliveRef.current) return
        // Le tour reste dans le fil, marque en echec : sa phrase n'est pas
        // perdue et elle peut relancer sans la reecrire.
        setTurns((current) =>
          current.map((turn) =>
            turn.id === userTurnId
              ? { ...turn, status: 'failed', error: { message: caught.message, kind: caught.kind } }
              : turn,
          ),
        )
      } finally {
        if (aliveRef.current) setPending(false)
      }
    },
    [progress.profile.level, progress.vocabulary.seen, scenario.id],
  )

  const send = useCallback(
    (rawText) => {
      const text = rawText.trim()
      if (!text || pending) return

      const userTurnId = crypto.randomUUID()
      const history = turns
        .filter((turn) => turn.status === 'done')
        .map((turn) => ({ role: turn.role, text: turn.text }))

      setTurns((current) => [
        ...current,
        { id: userTurnId, role: 'user', text, status: 'sending' },
      ])
      exchange(userTurnId, text, history)
    },
    [exchange, pending, turns],
  )

  /** Relance un tour dont l'envoi a echoue, sans reecrire la phrase. */
  const retry = useCallback(
    (turnId) => {
      const turn = turns.find((item) => item.id === turnId)
      if (!turn || turn.status !== 'failed' || pending) return

      const history = turns
        .slice(0, turns.indexOf(turn))
        .filter((item) => item.status === 'done')
        .map((item) => ({ role: item.role, text: item.text }))

      setTurns((current) =>
        current.map((item) => (item.id === turnId ? { ...item, status: 'sending' } : item)),
      )
      exchange(turnId, turn.text, history)
    },
    [exchange, pending, turns],
  )

  /**
   * Cloture la session et reporte ce qu'elle a produit dans la progression :
   * l'historique, les erreurs recurrentes qui alimenteront le module grammaire,
   * et le vocabulaire rencontre.
   */
  const finish = useCallback(async () => {
    const echanges = turns.filter((turn) => turn.role === 'user' && turn.status === 'done')
    const corrections = echanges.flatMap((turn) => turn.feedback?.corrections ?? [])
    const termes = turns.flatMap((turn) => turn.vocabulary ?? [])

    const endedAt = new Date().toISOString()

    // Un point de grammaire qui ressort ici n'est plus acquis. Sans ce retrait,
    // buildReviewQueue() l'excluerait a vie de la file : il compterait dans
    // recurringErrors sans jamais redonner lieu a un exercice.
    const retombees = new Set(
      corrections.map((correction) => correction.errorTag).filter((tag) => getGrammarTopic(tag)),
    )

    await updateProgress((state) => ({
      ...state,
      grammar: {
        ...state.grammar,
        mastered: state.grammar.mastered.filter((id) => !retombees.has(id)),
      },
      sessions: [
        ...state.sessions,
        {
          id: crypto.randomUUID(),
          startedAt: startedAtRef.current,
          endedAt,
          type: 'dialogue',
          ref: scenario.id,
          summary: `${echanges.length} échange${echanges.length > 1 ? 's' : ''}, ${corrections.length} correction${corrections.length > 1 ? 's' : ''}`,
        },
      ],
      recurringErrors: mergeRecurringErrors(state.recurringErrors, corrections, endedAt),
      vocabulary: { ...state.vocabulary, seen: mergeSeenVocabulary(state.vocabulary.seen, termes, endedAt) },
    }))

    if (aliveRef.current) setFinished(true)
  }, [scenario.id, turns, updateProgress])

  const echangesCount = turns.filter((turn) => turn.role === 'user' && turn.status === 'done').length

  return { turns, pending, finished, echangesCount, send, retry, finish }
}

/**
 * Cumule les erreurs par point de grammaire.
 *
 * On filtre sur GRAMMAR_TOPICS et non sur l'ensemble des tags connus : les tags
 * hors grammaire (`general`, `vocabulary`…) sont des reponses legitimes du
 * modele, mais ils ne correspondent a aucun exercice. Les compter ici creerait
 * un compteur mort, affiche a l'utilisatrice sous un bouton "travailler ces
 * points" qui ne menerait nulle part. Le nombre total de corrections reste
 * visible par ailleurs dans le bilan de session.
 */
function mergeRecurringErrors(current, corrections, at) {
  const next = { ...current }

  for (const correction of corrections) {
    const tag = correction.errorTag
    if (!tag || !getGrammarTopic(tag)) continue

    const previous = next[tag] ?? { count: 0, lastSeenAt: null, examples: [] }
    next[tag] = {
      count: previous.count + 1,
      lastSeenAt: at,
      // On garde les dernieres formulations fautives : elles serviront a
      // illustrer l'exercice de grammaire avec ses propres phrases.
      examples: [...previous.examples, correction.original]
        .filter(Boolean)
        .slice(-MAX_EXAMPLES_PAR_TAG),
    }
  }

  return next
}

/**
 * Marque comme vus les termes suggeres qui figurent au catalogue.
 *
 * Le modele suggere librement ; `vocabulary.seen` est indexe par l'id du
 * catalogue. Un terme hors catalogue reste affiche dans la conversation mais
 * n'est pas persiste — le stocker demanderait une entree de schema pour les
 * termes libres, ce qui n'est pas justifie tant que la banque est courte.
 */
function mergeSeenVocabulary(current, termes, at) {
  const next = { ...current }

  for (const terme of termes) {
    const id = findVocabularyId(terme.term)
    if (!id) continue

    const previous = next[id] ?? { seenCount: 0, lastSeenAt: null, mastered: false }
    next[id] = { ...previous, seenCount: previous.seenCount + 1, lastSeenAt: at }
  }

  return next
}

/** Rapproche un terme suggere du catalogue, en ignorant casse, ponctuation et
 *  acronymes entre parentheses ("customer acquisition cost (CAC)"). */
function findVocabularyId(term) {
  const normalise = (value) =>
    String(value ?? '')
      .toLowerCase()
      .replace(/\(.*?\)/g, ' ')
      .replace(/[^a-z ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const cible = normalise(term)
  if (!cible) return null

  return VOCABULARY.find((entry) => normalise(entry.term) === cible)?.id ?? null
}

/** Meme filet que pour le test de placement : le prompt impose la liste fermee,
 *  on veut savoir si le modele s'en ecarte quand meme. */
function warnUnknownTags(corrections) {
  const unknown = corrections
    .map((correction) => correction.errorTag)
    .filter((tag) => tag && !isKnownTag(tag))

  if (unknown.length > 0) {
    console.warn(
      `[dialogue] errorTag hors catalogue, non compte dans les erreurs recurrentes : ${unknown.join(', ')}`,
    )
  }
}
