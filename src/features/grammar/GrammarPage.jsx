import { Card, CardTitle, ComingSoon } from '../../components/Card.jsx'
import { buildReviewQueue, getGrammarTopic } from '../../data/grammarTopics.js'

// TODO(V1) - Module de revision grammaticale
//
// La file de priorite est deja calculee (buildReviewQueue) ; reste a implementer
// l'exercice lui-meme :
//  1. pour le topic en tete de file, generer 5-8 items cibles via le Worker
//     (nouvelle route /api/grammar a ajouter dans worker/index.js + un module
//     worker/prompts/grammar.js sur le modele de placementTest.js) ;
//  2. correction immediate avec explication courte ;
//  3. updateProgress() : grammar.stats[topicId], passage en grammar.mastered
//     au-dela d'un seuil de reussite, decrementation de recurringErrors.
//
// Les exercices doivent utiliser le contexte metier de l'utilisatrice (agence,
// campagne, board) : c'est ce qui fait la difference avec une app generique.

export default function GrammarPage({ progress }) {
  const queue = buildReviewQueue({
    weakPointTags: progress.profile.weakPoints.map((point) => point.topicTag ?? point),
    masteredTags: progress.grammar.mastered,
  })
  const topics = queue.map(getGrammarTopic).filter(Boolean)

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Ta file de révision</CardTitle>
        <p className="mt-1 text-sm text-ink-500">
          {progress.profile.level
            ? 'Ordonnée selon les lacunes détectées au test de niveau.'
            : 'Ordre pédagogique par défaut — passe le test de niveau pour l’adapter à tes lacunes.'}
        </p>
        <ol className="mt-3 space-y-2">
          {topics.slice(0, 5).map((topic, index) => (
            <li key={topic.id} className="flex gap-3 rounded-xl border border-slate-200 p-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink-900">{topic.label}</span>
                <span className="block text-xs text-ink-500">{topic.why}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <ComingSoon title="Exercices">
        <p>
          Séries d’exercices à implémenter, générées pour le point en tête de file et corrigées
          immédiatement.
        </p>
      </ComingSoon>
    </div>
  )
}
