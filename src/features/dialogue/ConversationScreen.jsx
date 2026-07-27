// Fil de conversation d'un scenario.
//
// Le feedback correctif s'affiche SOUS la phrase concernee et non dans un encart
// separe : c'est la qu'elle regarde, et c'est ce qui permet de relire sa propre
// formulation a cote de la version corrigee.
//
// L'encouragement passe toujours en premier, les corrections ensuite. Le profil
// cible sous-estime son niveau ; ouvrir sur la faute est exactement ce qui
// reactive le blocage qu'on cherche a lever.

import { useEffect, useRef, useState } from 'react'
import { Button, Card, CardTitle } from '../../components/Card.jsx'

export default function ConversationScreen({ scenario, dialogue, onQuit, onSwitchToVoice }) {
  const { turns, pending, echangesCount, send, retry, finish } = dialogue
  const [draft, setDraft] = useState('')
  const finRef = useRef(null)

  // Le fil suit la derniere replique, sinon le feedback apparait hors ecran.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns])

  function envoyer() {
    if (!draft.trim() || pending) return
    send(draft)
    setDraft('')
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
            onClick={onQuit}
            className="shrink-0 text-sm font-medium text-ink-500 hover:text-ink-900"
          >
            Quitter
          </button>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-ink-500">
          {scenario.goals.map((goal) => (
            <li key={goal} className="flex gap-2">
              <span aria-hidden className="text-brand-600">
                •
              </span>
              {goal}
            </li>
          ))}
        </ul>
      </Card>

      <ol className="space-y-3">
        {turns.map((turn) =>
          turn.role === 'coach' ? (
            <RepliqueCoach key={turn.id} turn={turn} />
          ) : (
            <RepliqueUtilisatrice key={turn.id} turn={turn} onRetry={() => retry(turn.id)} />
          ),
        )}
      </ol>

      {pending && (
        <p className="text-sm text-ink-400" role="status">
          Le coach répond…
        </p>
      )}

      <div ref={finRef} />

      <Card>
        <label htmlFor="reponse" className="text-xs font-medium text-ink-500">
          Ta réponse, en anglais
        </label>
        <textarea
          id="reponse"
          lang="en"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Écris comme tu le dirais à l’oral…"
          className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500"
        />
        <div className="mt-2 flex items-center gap-3">
          <Button className="flex-1" onClick={envoyer} disabled={pending || !draft.trim()}>
            Envoyer
          </Button>
          {echangesCount > 0 && (
            <Button variant="secondary" onClick={finish}>
              Terminer
            </Button>
          )}
        </div>

        {onSwitchToVoice && (
          <button
            type="button"
            onClick={onSwitchToVoice}
            className="mt-3 flex w-full items-center justify-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-600"
          >
            <MicroIcon className="size-4" />
            Passer à l’oral
          </button>
        )}
      </Card>
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

function RepliqueCoach({ turn }) {
  return (
    <li className="max-w-[85%]">
      <p
        lang="en"
        className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-3 text-sm leading-relaxed text-ink-900"
      >
        {turn.text}
      </p>
      {turn.vocabulary?.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {turn.vocabulary.map((item) => (
            <li
              key={item.term}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-ink-700"
              title={item.translation}
            >
              <span lang="en" className="font-medium">
                {item.term}
              </span>
              <span className="text-ink-400"> · {item.translation}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function RepliqueUtilisatrice({ turn, onRetry }) {
  return (
    <li>
      <p
        lang="en"
        className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-600 p-3 text-sm leading-relaxed text-white"
      >
        {turn.text}
      </p>

      {turn.status === 'sending' && (
        <p className="mt-1 text-right text-xs text-ink-400">envoi…</p>
      )}

      {turn.status === 'failed' && (
        <div className="mt-1.5 flex items-center justify-end gap-2">
          <span className="text-xs text-ink-500">{turn.error?.message}</span>
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-semibold text-brand-700 hover:text-brand-600"
          >
            Réessayer
          </button>
        </div>
      )}

      {turn.feedback && <Feedback feedback={turn.feedback} />}
    </li>
  )
}

function Feedback({ feedback }) {
  const { encouragement, corrections, reformulation, reformulationNote } = feedback

  return (
    <div className="mt-2 rounded-2xl border border-brand-100 bg-brand-50 p-3">
      {encouragement && <p className="text-sm text-ink-900">{encouragement}</p>}

      {corrections.length > 0 && (
        <ul className="mt-2 space-y-2">
          {corrections.map((correction) => (
            <li key={correction.original + correction.corrected}>
              <p className="text-sm">
                <span lang="en" className="text-ink-500 line-through decoration-ink-400">
                  {correction.original}
                </span>
                <span aria-hidden className="mx-1.5 text-ink-400">
                  →
                </span>
                <span lang="en" className="font-semibold text-emerald-700">
                  {correction.corrected}
                </span>
              </p>
              {correction.explanation && (
                <p className="text-xs text-ink-500">{correction.explanation}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {reformulation && (
        <div className="mt-2 border-t border-brand-100 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Comme le dirait un pro
          </p>
          <p lang="en" className="mt-0.5 text-sm text-ink-900">
            {reformulation}
          </p>
          {reformulationNote && <p className="text-xs text-ink-500">{reformulationNote}</p>}
        </div>
      )}
    </div>
  )
}
