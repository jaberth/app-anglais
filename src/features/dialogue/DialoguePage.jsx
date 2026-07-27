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
import ScenarioBuilder from './ScenarioBuilder.jsx'
import VoiceScreen from './VoiceScreen.jsx'
import { useDialogue } from './useDialogue.js'

// Au-dela, la liste de choix devient une corvee de tri plutot qu'un raccourci.
const MAX_SCENARIOS_PERSONNALISES = 8

export default function DialoguePage({ progress, updateProgress, onNavigate }) {
  const [active, setActive] = useState(null)
  const [creating, setCreating] = useState(false)

  const customScenarios = progress.customScenarios ?? []

  /** Persiste le scenario cree, puis ouvre la conversation. */
  async function demarrerScenarioCree(scenario) {
    const createdAt = new Date().toISOString()

    await updateProgress((state) => ({
      ...state,
      customScenarios: [
        { ...scenario, createdAt },
        ...(state.customScenarios ?? []).filter((item) => item.id !== scenario.id),
      ].slice(0, MAX_SCENARIOS_PERSONNALISES),
    }))

    setCreating(false)
    setActive(scenario)
  }

  async function supprimerScenario(id) {
    await updateProgress((state) => ({
      ...state,
      customScenarios: (state.customScenarios ?? []).filter((item) => item.id !== id),
    }))
  }

  if (active) {
    return (
      // `key` : changer de scenario doit repartir d'une conversation vierge,
      // pas recycler l'etat du precedent.
      <DialogueSession
        key={active.id}
        scenario={active}
        progress={progress}
        updateProgress={updateProgress}
        onQuit={() => setActive(null)}
        onNavigate={onNavigate}
      />
    )
  }

  if (creating) {
    return <ScenarioBuilder onStart={demarrerScenarioCree} onCancel={() => setCreating(false)} />
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">
        Choisis la situation que tu veux travailler aujourd’hui.
      </p>

      {SCENARIOS.map((item) => (
        <ChoixScenario key={item.id} scenario={item} onSelect={() => setActive(item)} />
      ))}

      <button
        type="button"
        onClick={() => setCreating(true)}
        className="block w-full rounded-2xl border border-dashed border-brand-200 bg-brand-50 p-4 text-left transition-colors hover:border-brand-500"
      >
        <span className="block text-sm font-semibold text-brand-700">Créer ma situation</span>
        <span className="mt-1 block text-sm text-ink-500">
          Décris une réunion que tu as vraiment à préparer, le coach en fait un scénario.
        </span>
      </button>

      {customScenarios.length > 0 && (
        <>
          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Mes situations
          </p>
          {customScenarios.map((item) => (
            <ChoixScenario
              key={item.id}
              scenario={item}
              onSelect={() => setActive(item)}
              onDelete={() => supprimerScenario(item.id)}
            />
          ))}
        </>
      )}
    </div>
  )
}

function ChoixScenario({ scenario, onSelect, onDelete }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50"
      >
        <span className="block pr-16 text-sm font-semibold text-ink-900">{scenario.title}</span>
        <span className="block text-xs italic text-ink-400">{scenario.subtitle}</span>
        <span className="mt-1 block text-sm text-ink-500">{scenario.description}</span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute right-3 top-3 rounded-lg px-2 py-1 text-xs font-medium text-ink-400 hover:bg-white hover:text-ink-900"
        >
          Supprimer
        </button>
      )}
    </div>
  )
}

function DialogueSession({ scenario, progress, updateProgress, onQuit, onNavigate }) {
  const dialogue = useDialogue({ scenario, progress, updateProgress })
  // On demarre a l'ecrit : c'est le mode qui leve le blocage. La voix se prend
  // quand elle se sent prete, pas par defaut.
  const [mode, setMode] = useState('text')

  if (dialogue.finished) {
    return <BilanSession scenario={scenario} turns={dialogue.turns} onNavigate={onNavigate} />
  }

  if (mode === 'voice') {
    return (
      <VoiceScreen
        scenario={scenario}
        dialogue={dialogue}
        onQuit={onQuit}
        onSwitchToText={() => setMode('text')}
      />
    )
  }

  return (
    <ConversationScreen
      scenario={scenario}
      dialogue={dialogue}
      onQuit={onQuit}
      onSwitchToVoice={() => setMode('voice')}
    />
  )
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
