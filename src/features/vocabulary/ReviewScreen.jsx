// Carte de revision : terme d'abord, traduction ensuite.
//
// Le terme anglais est montre seul et la traduction reste cachee jusqu'au clic.
// C'est le rappel actif : essayer de retrouver le sens avant de le lire ancre
// bien mieux que relire une liste bilingue. Le bouton de retournement est donc
// l'element principal de l'ecran, pas un detail.

import { Button, Card, CardTitle } from '../../components/Card.jsx'

export default function ReviewScreen({ review, onQuit }) {
  const { sequence, index, revealed, current, reveal, answer } = review
  if (!current) return null

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between text-xs text-ink-500">
          <span>
            Carte {index + 1} sur {sequence.length}
          </span>
          <button type="button" onClick={onQuit} className="font-medium hover:text-ink-900">
            Quitter
          </button>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={sequence.length}
          aria-label="Avancement de la révision"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
            style={{ width: `${((index + 1) / sequence.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="min-h-52">
        <p lang="en" className="text-xl font-semibold text-ink-900">
          {current.term}
        </p>

        {revealed ? (
          <div className="mt-3 space-y-2">
            <p className="text-base text-brand-700">{current.translation}</p>
            <p lang="en" className="border-l-2 border-slate-200 pl-3 text-sm italic text-ink-500">
              {current.example}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-400">
            Essaie de retrouver le sens avant de retourner la carte.
          </p>
        )}
      </Card>

      {revealed ? (
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => answer(false)}>
            À revoir
          </Button>
          <Button className="flex-1" onClick={() => answer(true)}>
            Je connais
          </Button>
        </div>
      ) : (
        <Button className="w-full" onClick={reveal}>
          Retourner la carte
        </Button>
      )}
    </div>
  )
}

export function ReviewSummary({ review, onRestart, onNavigate }) {
  const { sequence, resultats } = review
  const acquis = sequence.filter((entry) => resultats[entry.id])
  const aRevoir = sequence.filter((entry) => resultats[entry.id] === false)

  return (
    <div className="space-y-4">
      <Card className="border-brand-200 bg-brand-50">
        <CardTitle>Révision terminée</CardTitle>
        <p className="mt-1 text-sm text-ink-700">
          {acquis.length} terme{acquis.length > 1 ? 's' : ''} sur {sequence.length} maîtrisé
          {acquis.length > 1 ? 's' : ''}.
        </p>
        <p className="mt-2 text-sm text-ink-700">
          Les termes à revoir remonteront en tête de ta prochaine série, et le coach essaiera de les
          replacer dans tes dialogues.
        </p>
      </Card>

      {aRevoir.length > 0 && (
        <Card>
          <CardTitle>À revoir</CardTitle>
          <ul className="mt-2 divide-y divide-slate-100">
            {aRevoir.map((entry) => (
              <li key={entry.id} className="py-2">
                <p lang="en" className="text-sm font-semibold text-ink-900">
                  {entry.term}
                </p>
                <p className="text-xs text-ink-500">{entry.translation}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <Button onClick={onRestart}>Nouvelle série</Button>
        <Button variant="secondary" onClick={() => onNavigate('dialogue')}>
          Les employer en dialogue
        </Button>
        <Button variant="ghost" onClick={() => onNavigate('dashboard')}>
          Retour à l’accueil
        </Button>
      </div>
    </div>
  )
}
