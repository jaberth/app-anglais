// Test de placement : intro -> passage item par item -> restitution.
//
// Objectif du brief : restituer un niveau et au moins 2 points faibles nommes en
// moins de 10 minutes. Toute la logique est dans usePlacementTest.js ; ce fichier
// ne fait qu'aiguiller vers l'ecran correspondant a la phase courante.

import { Button, Card, CardTitle } from '../../components/Card.jsx'
import QuestionScreen from './QuestionScreen.jsx'
import ResultScreen from './ResultScreen.jsx'
import { usePlacementTest } from './usePlacementTest.js'

export default function PlacementTestPage({ progress, updateProgress, onNavigate }) {
  const test = usePlacementTest({ progress, updateProgress })

  switch (test.phase) {
    case 'generating':
      return (
        <Waiting
          title="Le coach prépare ton test"
          detail="Une vingtaine de questions adaptées à ton métier. Quelques secondes."
        />
      )

    case 'evaluating':
      return (
        <Waiting
          title="Analyse de tes réponses"
          detail="Le coach relit tes phrases pour situer ton niveau. Ne ferme pas l’app."
        />
      )

    case 'running':
      return test.currentItem ? (
        <QuestionScreen
          item={test.currentItem}
          index={test.index}
          total={test.items.length}
          savedAnswer={test.answers[test.currentItem.id]}
          canGoBack={test.index > 0}
          onAnswer={test.answerAndAdvance}
          onBack={test.goBack}
        />
      ) : null

    case 'result':
      return <ResultScreen result={test.result} onNavigate={onNavigate} />

    case 'error':
      return <ErrorScreen error={test.error} onRetry={test.retry} onNavigate={onNavigate} />

    default:
      return (
        <IntroScreen
          level={progress.profile.level}
          resumable={test.resumable}
          onStart={test.start}
          onResume={test.resume}
          onDiscard={test.discard}
        />
      )
  }
}

function IntroScreen({ level, resumable, onStart, onResume, onDiscard }) {
  const answered = resumable ? Object.keys(resumable.answers).length : 0

  return (
    <div className="space-y-4">
      {resumable && (
        <Card className="border-brand-200 bg-brand-50">
          <CardTitle>Tu as un test en cours</CardTitle>
          <p className="mt-1 text-sm text-ink-700">
            {answered} question{answered > 1 ? 's' : ''} déjà répondue{answered > 1 ? 's' : ''} sur{' '}
            {resumable.items.length}. Tes réponses sont conservées.
          </p>
          <Button className="mt-3 w-full" onClick={onResume}>
            Reprendre où j’en étais
          </Button>
          <button
            type="button"
            onClick={onDiscard}
            className="mt-2 w-full text-sm font-medium text-ink-500 hover:text-ink-900"
          >
            Recommencer de zéro
          </button>
        </Card>
      )}

      <Card>
        <CardTitle>{level ? 'Refaire le test de niveau' : 'Test de niveau'}</CardTitle>
        <p className="mt-2 text-sm text-ink-700">
          Une vingtaine de questions, moins de 10 minutes. Grammaire, compréhension d’un contenu
          professionnel, et deux courtes réponses écrites en situation de réunion.
        </p>

        <ul className="mt-3 space-y-1.5 text-sm text-ink-500">
          <li className="flex gap-2">
            <span aria-hidden className="text-brand-600">
              •
            </span>
            Aucune correction affichée pendant le test : on mesure, on ne juge pas.
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-brand-600">
              •
            </span>
            « Je ne sais pas » est une réponse valable — et plus utile qu’une réponse au hasard.
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-brand-600">
              •
            </span>
            Si tu fermes l’app, tu reprendras où tu t’es arrêtée.
          </li>
        </ul>

        {level && (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-ink-500">
            Ton niveau actuel est {level}. Refaire le test remplacera ce résultat et réordonnera ta
            file de révision.
          </p>
        )}

        {!resumable && (
          <Button className="mt-4 w-full" onClick={onStart}>
            Commencer
          </Button>
        )}
      </Card>
    </div>
  )
}

function Waiting({ title, detail }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="size-5 shrink-0 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
        />
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-0.5 text-sm text-ink-500">{detail}</p>
        </div>
      </div>
    </Card>
  )
}

function ErrorScreen({ error, onRetry, onNavigate }) {
  // Une evaluation qui echoue ne perd pas les reponses : le brouillon est encore
  // en base, il suffit de relancer l'analyse.
  const isEvaluation = error?.action === 'evaluate'

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>{isEvaluation ? 'L’analyse n’a pas abouti' : 'Le test n’a pas pu démarrer'}</CardTitle>
        <p className="mt-2 text-sm text-ink-700">{error?.message}</p>
        {isEvaluation && (
          <p className="mt-2 text-sm text-ink-500">
            Tes réponses sont enregistrées. Tu peux relancer l’analyse maintenant ou plus tard.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={onRetry}>{isEvaluation ? 'Relancer l’analyse' : 'Réessayer'}</Button>
          <Button variant="secondary" onClick={() => onNavigate('dashboard')}>
            Retour à l’accueil
          </Button>
        </div>
      </Card>
    </div>
  )
}
