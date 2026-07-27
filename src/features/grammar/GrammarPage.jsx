// Module de revision grammaticale : file priorisee, puis series d'exercices.
//
// L'ordre de la file est le produit des deux autres modules — les lacunes du
// test de placement, puis les erreurs qui reviennent en dialogue. C'est le point
// ou la boucle pedagogique se referme.

import { Button, Card, CardTitle } from '../../components/Card.jsx'
import { buildReviewQueue, getGrammarTopic } from '../../../shared/grammarTopics.js'
import DrillScreen, { DrillSummary } from './DrillScreen.jsx'
import { useGrammarDrill } from './useGrammarDrill.js'

export default function GrammarPage({ progress, updateProgress, onNavigate }) {
  const drill = useGrammarDrill({ progress, updateProgress })

  const queue = buildReviewQueue({
    weakPointTags: progress.profile.weakPoints.map((point) => point.topicTag ?? point),
    masteredTags: progress.grammar.mastered,
  })
  const topics = queue.map(getGrammarTopic).filter(Boolean)
  const topicEnCours = getGrammarTopic(drill.topicId)

  if (drill.phase === 'loading') {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="size-5 shrink-0 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
          />
          <div>
            <CardTitle>Le coach prépare ta série</CardTitle>
            <p className="mt-0.5 text-sm text-ink-500">
              Des phrases tirées de ton quotidien, sur {topicEnCours?.label ?? 'ce point'}.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  if (drill.phase === 'error') {
    return (
      <Card>
        <CardTitle>La série n’a pas pu être générée</CardTitle>
        <p className="mt-2 text-sm text-ink-700">{drill.error?.message}</p>
        <div className="mt-4 flex flex-col gap-2">
          {drill.error?.kind === 'session' ? (
            <Button onClick={() => window.location.reload()}>Recharger la page</Button>
          ) : (
            <Button onClick={drill.retry}>Réessayer</Button>
          )}
          <Button variant="secondary" onClick={drill.quit}>
            Revenir à la file
          </Button>
        </div>
      </Card>
    )
  }

  if (drill.phase === 'running' && topicEnCours) {
    return <DrillScreen topic={topicEnCours} drill={drill} onQuit={drill.quit} />
  }

  if (drill.phase === 'result' && topicEnCours) {
    return (
      <DrillSummary
        topic={topicEnCours}
        drill={drill}
        onRestart={() => drill.start(topicEnCours.id)}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <div className="space-y-4">
      {topics.length === 0 ? (
        <Card className="border-brand-200 bg-brand-50">
          <CardTitle>Tout est acquis</CardTitle>
          <p className="mt-1 text-sm text-ink-700">
            Aucun point ne reste à travailler. Les erreurs qui reviendront en dialogue
            réalimenteront cette file d’elles-mêmes.
          </p>
        </Card>
      ) : (
        <Card>
          <CardTitle>Ta file de révision</CardTitle>
          <p className="mt-1 text-sm text-ink-500">
            {progress.profile.level
              ? 'Ordonnée selon tes lacunes et les erreurs qui reviennent en dialogue.'
              : 'Ordre pédagogique par défaut — passe le test de niveau pour l’adapter à tes lacunes.'}
          </p>

          <ol className="mt-3 space-y-2">
            {topics.slice(0, 5).map((topic, index) => {
              const erreurs = progress.recurringErrors[topic.id]?.count ?? 0
              const stats = progress.grammar.stats[topic.id]

              return (
                <li key={topic.id} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-900">{topic.label}</span>
                    <span className="block text-xs text-ink-500">{topic.why}</span>
                    {(erreurs > 0 || stats) && (
                      <span className="mt-1 block text-xs text-brand-700">
                        {erreurs > 0 && `${erreurs} erreur${erreurs > 1 ? 's' : ''} en dialogue`}
                        {erreurs > 0 && stats && ' · '}
                        {stats && `${stats.correct}/${stats.attempts} en exercice`}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ol>

          <Button className="mt-4 w-full" onClick={() => drill.start(topics[0].id)}>
            Travailler « {topics[0].label} »
          </Button>
        </Card>
      )}
    </div>
  )
}
