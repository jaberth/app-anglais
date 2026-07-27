// Restitution du test.
//
// Ordre volontaire : niveau, puis points forts, puis points a travailler. Le
// profil cible sous-estime son niveau reel — ouvrir sur les lacunes confirmerait
// ce qu'elle croit deja et ferait rater l'objectif du test.

import { Button, Card, CardTitle } from '../../components/Card.jsx'
import { getGrammarTopic } from '../../../shared/grammarTopics.js'

export default function ResultScreen({ result, onNavigate }) {
  return (
    <div className="space-y-4">
      <Card className="border-brand-200 bg-brand-50">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          Ton niveau estimé
        </p>
        <p className="mt-1 text-5xl font-bold text-brand-700">{result.level}</p>
        {result.total > 0 && (
          <p className="mt-1 text-xs text-ink-500">
            {result.score} bonnes réponses sur {result.total}
          </p>
        )}
        {result.summary && <p className="mt-3 text-sm text-ink-700">{result.summary}</p>}
      </Card>

      {result.strengths.length > 0 && (
        <Card>
          <CardTitle>Ce qui est déjà solide</CardTitle>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
            {result.strengths.map((strength) => (
              <li key={strength} className="flex gap-2">
                <span aria-hidden className="text-brand-600">
                  ✓
                </span>
                {strength}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardTitle>À travailler en priorité</CardTitle>
        <p className="mt-1 text-sm text-ink-500">
          Ces points passent en tête de ta file de révision.
        </p>
        <ol className="mt-3 space-y-2">
          {result.weakPoints.map((point, index) => (
            <li key={point.topicTag} className="flex gap-3 rounded-xl border border-slate-200 p-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink-900">
                  {point.label || getGrammarTopic(point.topicTag)?.label || point.topicTag}
                </span>
                {point.advice && <span className="block text-xs text-ink-500">{point.advice}</span>}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="flex flex-col gap-2">
        <Button onClick={() => onNavigate('grammar')}>Voir ma file de révision</Button>
        <Button variant="secondary" onClick={() => onNavigate('dashboard')}>
          Retour à l’accueil
        </Button>
      </div>
    </div>
  )
}
