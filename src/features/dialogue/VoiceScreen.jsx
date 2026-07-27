// Mode conversation : on parle, on ecoute, rien d'autre.
//
// Choix assume : AUCUNE correction n'est affichee pendant la conversation. Le
// feedback est bien produit a chaque tour et stocke — il est simplement garde
// pour le bilan de fin de session. Afficher une correction au milieu d'un
// echange parle ramenerait exactement ce qu'on cherche a supprimer : le regard
// qui quitte la conversation pour aller verifier si c'est juste.
//
// Le fil reste visible en petit, en retrait. Il sert de filet quand elle n'a pas
// compris la replique, pas de support de lecture — d'ou l'affichage attenue.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, CardTitle } from '../../components/Card.jsx'
import { transcribeAudio } from '../../lib/api/coachClient.js'
import { supportsNativeRecognition, useRecognition, useRecorder, useSpeaker } from './useSpeech.js'

export default function VoiceScreen({ scenario, dialogue, onQuit, onSwitchToText }) {
  const { turns, pending, echangesCount, send, finish } = dialogue

  const [fallback, setFallback] = useState(() => !supportsNativeRecognition())
  const [transcribing, setTranscribing] = useState(false)
  const [notice, setNotice] = useState(null)

  const { speaking, speak, shutUp } = useSpeaker()

  // La derniere replique du coach est dite a voix haute des qu'elle arrive.
  const derniereRepliqueRef = useRef(null)
  const derniereReplique = [...turns].reverse().find((turn) => turn.role === 'coach')

  useEffect(() => {
    if (!derniereReplique || derniereRepliqueRef.current === derniereReplique.id) return
    derniereRepliqueRef.current = derniereReplique.id
    speak(derniereReplique.text)
  }, [derniereReplique, speak])

  const basculerEnRepli = useCallback(() => {
    setFallback(true)
    setNotice(
      'La reconnaissance vocale de ce navigateur n’a pas fonctionné. On passe par l’enregistrement, ça marche partout.',
    )
  }, [])

  const recognition = useRecognition({ onResult: send, onFallbackNeeded: basculerEnRepli })

  const recorder = useRecorder({
    onRecorded: async (blob) => {
      setTranscribing(true)
      setNotice(null)
      try {
        const { transcript } = await transcribeAudio({ blob })
        if (transcript) send(transcript)
        else setNotice('Rien n’a été entendu. Réessaie en parlant un peu plus fort.')
      } catch (caught) {
        setNotice(caught.message)
      } finally {
        setTranscribing(false)
      }
    },
  })

  const enEcoute = fallback ? recorder.recording : recognition.listening
  const occupe = pending || transcribing

  function basculerMicro() {
    // Le coach se tait des qu'elle prend la parole : se parler dessus est le
    // travers classique de ces interfaces, et c'est desagreable.
    shutUp()

    if (enEcoute) {
      if (fallback) recorder.stop()
      else recognition.stop()
    } else {
      setNotice(null)
      if (fallback) recorder.start()
      else recognition.start()
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{scenario.title}</CardTitle>
            <p className="mt-0.5 text-xs italic text-ink-400">{scenario.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              shutUp()
              onQuit()
            }}
            className="shrink-0 text-sm font-medium text-ink-500 hover:text-ink-900"
          >
            Quitter
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Parle comme en réunion. Les corrections arrivent à la fin, pas pendant.
        </p>
      </Card>

      <Card className="flex flex-col items-center py-8">
        <StatutVocal
          enEcoute={enEcoute}
          occupe={occupe}
          speaking={speaking}
          transcript={recognition.transcript}
        />

        <button
          type="button"
          onClick={basculerMicro}
          disabled={occupe}
          aria-label={enEcoute ? 'Arrêter de parler' : 'Prendre la parole'}
          className={`mt-5 flex size-24 items-center justify-center rounded-full text-white shadow-lg transition-all disabled:opacity-40 ${
            enEcoute ? 'scale-105 bg-rose-600 animate-pulse' : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          <MicroIcon className="size-10" />
        </button>

        <p className="mt-3 text-center text-xs text-ink-400">
          {enEcoute ? 'Touche pour envoyer ta réponse' : 'Touche pour parler'}
        </p>

        {(recorder.error || notice) && (
          <p className="mt-3 max-w-xs text-center text-xs text-amber-700">
            {recorder.error || notice}
          </p>
        )}
      </Card>

      <FilAttenue turns={turns} />

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onSwitchToText}>
          Passer à l’écrit
        </Button>
        {echangesCount > 0 && (
          <Button
            className="flex-1"
            onClick={() => {
              shutUp()
              finish()
            }}
          >
            Terminer
          </Button>
        )}
      </div>
    </div>
  )
}

function StatutVocal({ enEcoute, occupe, speaking, transcript }) {
  if (enEcoute) {
    return (
      <div className="text-center" role="status">
        <p className="text-sm font-semibold text-rose-600">Je t’écoute…</p>
        {transcript && (
          <p lang="en" className="mt-2 max-w-xs text-sm text-ink-700">
            {transcript}
          </p>
        )}
      </div>
    )
  }

  if (occupe) {
    return (
      <p className="text-sm text-ink-500" role="status">
        Le coach réfléchit…
      </p>
    )
  }

  if (speaking) {
    return (
      <p className="text-sm text-brand-700" role="status">
        Le coach parle…
      </p>
    )
  }

  return <p className="text-sm text-ink-400">À toi.</p>
}

/**
 * Fil de secours : ce qui a ete dit, en petit. Utile quand une replique n'a pas
 * ete comprise a l'oral, sans transformer l'exercice en lecture.
 */
function FilAttenue({ turns }) {
  const finRef = useRef(null)

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns])

  return (
    <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-2xl bg-white/60 p-3">
      {turns.map((turn) => (
        <p
          key={turn.id}
          lang="en"
          className={`text-xs leading-relaxed ${
            turn.role === 'coach' ? 'text-ink-500' : 'text-right text-brand-700'
          }`}
        >
          {turn.text}
        </p>
      ))}
      <div ref={finRef} />
    </div>
  )
}

function MicroIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor" stroke="none" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" strokeLinecap="round" />
      <path d="M12 17.5V21" strokeLinecap="round" />
    </svg>
  )
}
