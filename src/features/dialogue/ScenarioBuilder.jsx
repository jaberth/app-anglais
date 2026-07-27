// Creation d'un scenario sur mesure, par le dialogue.
//
// Elle decrit sa situation en francais, le coach propose un scenario, elle
// l'ajuste autant de fois qu'elle veut. Chaque ajustement rejoue la generation
// avec l'historique complet des demandes : le scenario reste coherent, la ou
// des retouches successives finiraient par se contredire.
//
// La description est en FRANCAIS, volontairement. Cet ecran sert a preparer la
// conversation, pas a l'entrainer : lui demander de decrire sa situation en
// anglais rajouterait un obstacle avant meme le debut de l'exercice.

import { useRef, useState } from 'react'
import { Button, Card, CardTitle } from '../../components/Card.jsx'
import { buildScenario } from '../../lib/api/coachClient.js'

const EXEMPLES = [
  'Jeudi je dois annoncer à notre agence que la campagne est en retard et hors budget, et obtenir un nouveau planning.',
  'Un client américain conteste nos résultats d’acquisition et je dois défendre nos chiffres.',
  'Je dois recadrer un collaborateur qui rend son travail en retard depuis trois semaines.',
]

export default function ScenarioBuilder({ onStart, onCancel }) {
  const [description, setDescription] = useState('')
  const [refinements, setRefinements] = useState([])
  const [ajustement, setAjustement] = useState('')
  const [scenario, setScenario] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)

  const abortRef = useRef(null)

  async function generer(nextRefinements) {
    const situation = description.trim()
    if (!situation || pending) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setPending(true)
    setError(null)

    try {
      const response = await buildScenario(
        { description: situation, refinements: nextRefinements },
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      setScenario(response.scenario)
      setRefinements(nextRefinements)
      setAjustement('')
    } catch (caught) {
      if (caught.name === 'AbortError') return
      setError(caught)
    } finally {
      if (!controller.signal.aborted) setPending(false)
    }
  }

  function ajuster() {
    const texte = ajustement.trim()
    if (!texte || pending) return
    generer([...refinements, texte])
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>Créer ma situation</CardTitle>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 text-sm font-medium text-ink-500 hover:text-ink-900"
          >
            Retour
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Décris en français la conversation que tu veux préparer. Le coach en fait un scénario que
          tu pourras ajuster.
        </p>

        <textarea
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ex : jeudi je dois annoncer à l’agence que la campagne est en retard…"
          className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500"
        />

        {!scenario && (
          <>
            <ul className="mt-2 space-y-1.5">
              {EXEMPLES.map((exemple) => (
                <li key={exemple}>
                  <button
                    type="button"
                    onClick={() => setDescription(exemple)}
                    className="text-left text-xs text-ink-500 underline decoration-slate-300 underline-offset-2 hover:text-ink-900"
                  >
                    {exemple}
                  </button>
                </li>
              ))}
            </ul>
            <Button
              className="mt-3 w-full"
              onClick={() => generer([])}
              disabled={pending || !description.trim()}
            >
              {pending ? 'Le coach prépare…' : 'Créer le scénario'}
            </Button>
          </>
        )}
      </Card>

      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-ink-900">{error.message}</p>
          {error.kind === 'session' ? (
            <Button className="mt-3 w-full" onClick={() => window.location.reload()}>
              Recharger la page
            </Button>
          ) : (
            <Button className="mt-3 w-full" onClick={() => generer(refinements)} disabled={pending}>
              Réessayer
            </Button>
          )}
        </Card>
      )}

      {scenario && (
        <>
          <Card className="border-brand-200">
            <CardTitle>{scenario.title}</CardTitle>
            <p className="mt-0.5 text-xs italic text-ink-400">{scenario.subtitle}</p>
            <p className="mt-2 text-sm text-ink-700">{scenario.description}</p>

            {scenario.goals.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-ink-500">
                {scenario.goals.map((goal) => (
                  <li key={goal} className="flex gap-2">
                    <span aria-hidden className="text-brand-600">
                      •
                    </span>
                    {goal}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                Première réplique
              </p>
              <p lang="en" className="mt-0.5 text-sm text-ink-900">
                {scenario.opener}
              </p>
            </div>
          </Card>

          <Card>
            <label htmlFor="ajustement" className="text-xs font-medium text-ink-500">
              Quelque chose à ajuster ?
            </label>
            <input
              id="ajustement"
              value={ajustement}
              onChange={(event) => setAjustement(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && ajuster()}
              placeholder="Ex : rends-le plus agressif, c’est un client américain…"
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500"
            />
            <div className="mt-2 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={ajuster}
                disabled={pending || !ajustement.trim()}
              >
                {pending ? 'Ajustement…' : 'Ajuster'}
              </Button>
              <Button className="flex-1" onClick={() => onStart(scenario)} disabled={pending}>
                Démarrer
              </Button>
            </div>
            {refinements.length > 0 && (
              <p className="mt-2 text-xs text-ink-400">
                {refinements.length} ajustement{refinements.length > 1 ? 's' : ''} pris en compte.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
