// Module de dialogue : choix du scenario, conversation, bilan de session.
//
// Le dispositif central de l'app. Le chat ecrit est un choix assume : il permet
// de se reprendre, de relire, et de recevoir une correction sans la pression de
// l'oral — c'est ce qui doit lever le blocage avant d'envisager la voix (V2).

import { useState } from 'react'
import { Button, Card, CardTitle } from '../../components/Card.jsx'
import { SCENARIOS } from '../../../shared/scenarios.js'
import { getGrammarTopic } from '../../../shared/grammarTopics.js'
import ConversationScreen from './ConversationScreen.jsx'
import { useDialogue } from './useDialogue.js'

export default function DialoguePage({ progress, updateProgress, onNavigate }) {
  const [selected, setSelected] = useState(null)
  const scenario = SCENARIOS.find((item) => item.id === selected)

  if (scenario) {
    return (
      // `key` : changer de scenario doit repartir d'une conversation vierge,
      // pas recycler l'etat du precedent.
      <DialogueSession
        key={scenario.id}
        scenario={scenario}
        progress={progress}
        updateProgress={updateProgress}
        onQuit={() => setSelected(null)}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">
        Choisis la situation que tu veux travailler aujourd’hui.
      </p>
      {SCENARIOS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setSelected(item.id)}
          className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50"
        >
          <span className="block text-sm font-semibold text-ink-900">{item.title}</span>
          <span className="block text-xs italic text-ink-400">{item.subtitle}</span>
          <span className="mt-1 block text-sm text-ink-500">{item.description}</span>
        </button>
      ))}
    </div>
  )
}

function DialogueSession({ scenario, progress, updateProgress, onQuit, onNavigate }) {
  const dialogue = useDialogue({ scenario, progress, updateProgress })

  if (dialogue.finished) {
    return <BilanSession scenario={scenario} turns={dialogue.turns} onNavigate={onNavigate} />
  }

  return <ConversationScreen scenario={scenario} dialogue={dialogue} onQuit={onQuit} />
}

function BilanSession({ scenario, turns, onNavigate }) {
  const echanges = turns.filter((turn) => turn.role === 'user' && turn.status === 'done')
  const corrections = echanges.flatMap((turn) => turn.feedback?.corrections ?? [])

  // Regroupe par point de grammaire : trois fois la meme faute est une
  // information, trois fautes differentes en est une autre.
  //
  // Seuls les tags qui correspondent a un point du catalogue sont listes : cette
  // carte mene au bouton "Travailler ces points", elle ne doit donc contenir que
  // ce qui est reellement travaillable.
  const parTag = new Map()
  for (const correction of corrections) {
    const topic = getGrammarTopic(correction.errorTag)
    if (!topic) continue
    parTag.set(topic.id, (parTag.get(topic.id) ?? 0) + 1)
  }

  return (
    <div className="space-y-4">
      <Card className="border-brand-200 bg-brand-50">
        <CardTitle>Session terminée</CardTitle>
        <p className="mt-1 text-sm text-ink-700">
          {scenario.title} — {echanges.length} échange{echanges.length > 1 ? 's' : ''} en anglais.
        </p>
        <p className="mt-2 text-sm text-ink-700">
          {corrections.length === 0
            ? 'Aucune correction sur cette session. C’est un signal, pas un hasard.'
            : `${corrections.length} correction${corrections.length > 1 ? 's' : ''} — chacune est enregistrée et remonte les points concernés dans ta file de révision.`}
        </p>
      </Card>

      {parTag.size > 0 && (
        <Card>
          <CardTitle>Ce qui est revenu</CardTitle>
          <ul className="mt-2 space-y-1.5">
            {[...parTag.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([tag, count]) => (
                <li key={tag} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink-900">{getGrammarTopic(tag).label}</span>
                  <span className="shrink-0 text-xs text-ink-400">
                    {count} fois
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <Button onClick={() => onNavigate('grammar')}>Travailler ces points</Button>
        <Button variant="secondary" onClick={() => onNavigate('dashboard')}>
          Retour à l’accueil
        </Button>
      </div>
    </div>
  )
}
