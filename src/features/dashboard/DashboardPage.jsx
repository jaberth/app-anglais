import { Button, Card, CardTitle } from '../../components/Card.jsx'
import { GRAMMAR_TOPICS, buildReviewQueue, getGrammarTopic } from '../../../shared/grammarTopics.js'
import { SCENARIOS } from '../../../shared/scenarios.js'

// Tableau de bord : point d'entree de chaque session. Il repond a une seule
// question — "qu'est-ce que je fais aujourd'hui ?" — et laisse tout le reste
// accessible en second rideau.

export default function DashboardPage({ progress, onNavigate }) {
  const { profile, sessions, vocabulary } = progress
  const hasLevel = Boolean(profile.level)

  const reviewQueue = buildReviewQueue({
    weakPointTags: profile.weakPoints.map((point) => point.topicTag ?? point),
    masteredTags: progress.grammar.mastered,
  })
  const nextTopic = getGrammarTopic(reviewQueue[0])
  const vocabSeenCount = Object.keys(vocabulary.seen).length

  return (
    <div className="space-y-4">
      {!hasLevel && (
        <Card className="border-brand-200 bg-brand-50">
          <CardTitle>Commence par le test de niveau</CardTitle>
          <p className="mt-1 text-sm text-ink-700">
            15 à 20 questions, moins de 10 minutes. Il donne ton niveau réel et les 2-3 points qui
            bloquent le plus ta fluidité — c’est lui qui règle tout le reste de l’app.
          </p>
          <Button className="mt-3 w-full" onClick={() => onNavigate('placement')}>
            Passer le test
          </Button>
        </Card>
      )}

      {hasLevel && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Niveau estimé</CardTitle>
              <p className="mt-1 text-3xl font-bold text-brand-700">{profile.level}</p>
              <p className="text-xs text-ink-400">
                Évalué le {formatDate(profile.assessedAt)}
              </p>
            </div>
            <Button variant="secondary" onClick={() => onNavigate('placement')}>
              Refaire le test
            </Button>
          </div>

          {profile.weakPoints.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                À travailler en priorité
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {profile.weakPoints.map((point) => (
                  <li
                    key={point.topicTag ?? point}
                    className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                  >
                    {point.label ?? point.topicTag ?? point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card>
        <CardTitle>Ta session du jour</CardTitle>
        <p className="mt-1 text-sm text-ink-500">10 à 15 minutes. Choisis un format.</p>

        <div className="mt-3 space-y-2">
          <SessionChoice
            title="Dialogue de réunion"
            detail={`${SCENARIOS.length} scénarios — feedback après chaque réponse`}
            onClick={() => onNavigate('dialogue')}
          />
          <SessionChoice
            title="Grammaire ciblée"
            detail={
              nextTopic
                ? `Prochain point : ${nextTopic.label}`
                : `${GRAMMAR_TOPICS.length} points de grammaire`
            }
            onClick={() => onNavigate('grammar')}
          />
          <SessionChoice
            title="Vocabulaire métier"
            detail={`${vocabSeenCount} terme${vocabSeenCount > 1 ? 's' : ''} déjà vu${
              vocabSeenCount > 1 ? 's' : ''
            }`}
            onClick={() => onNavigate('vocabulary')}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Historique</CardTitle>
        {sessions.length === 0 ? (
          <p className="mt-1 text-sm text-ink-500">
            Aucune session terminée pour l’instant. Ta progression est enregistrée sur cet appareil.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {sessions.slice(-5).reverse().map((session) => (
              <li key={session.id} className="flex justify-between py-2">
                <span className="text-ink-700">{session.type}</span>
                <span className="text-ink-400">{formatDate(session.endedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function SessionChoice({ title, detail, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50"
    >
      <span>
        <span className="block text-sm font-semibold text-ink-900">{title}</span>
        <span className="block text-xs text-ink-500">{detail}</span>
      </span>
      <span aria-hidden className="text-ink-400">
        ›
      </span>
    </button>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
