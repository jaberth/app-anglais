// Un exercice par ecran, avec correction immediate.
//
// Apres la reponse, la phrase est reaffichee COMPLETE avec la bonne forme : lire
// l'enonce juste en entier ancre mieux que reperer le bon bouton parmi trois.

import { Button, Card, CardTitle } from '../../components/Card.jsx'

export default function DrillScreen({ topic, drill, onQuit }) {
  const { items, index, currentItem, answers, answered, answer, next } = drill
  if (!currentItem) return null

  const donnee = answers[currentItem.id]
  const juste = donnee === currentItem.answerIndex
  const dernier = index === items.length - 1

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between gap-3 text-xs text-ink-500">
          <span>
            {topic.label} — {index + 1} / {items.length}
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
          aria-valuemax={items.length}
          aria-label="Avancement de la série"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
            style={{ width: `${((index + 1) / items.length) * 100}%` }}
          />
        </div>
      </div>

      <Card>
        <p className="text-sm text-ink-500">{currentItem.prompt}</p>
        <p lang="en" className="mt-2 text-base leading-relaxed text-ink-900">
          {currentItem.sentence}
        </p>

        <ul className="mt-4 space-y-2">
          {currentItem.choices.map((choice, choiceIndex) => (
            <li key={choice}>
              <button
                type="button"
                lang="en"
                disabled={answered}
                onClick={() => answer(choiceIndex)}
                className={`min-h-11 w-full rounded-xl border p-3 text-left text-sm transition-colors ${classeChoix(
                  { answered, choiceIndex, donnee, bonne: currentItem.answerIndex },
                )}`}
              >
                {choice}
              </button>
            </li>
          ))}
        </ul>

        {answered && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className={`text-sm font-semibold ${juste ? 'text-emerald-700' : 'text-ink-900'}`}>
              {juste ? 'C’est juste.' : 'Pas tout à fait.'}
            </p>
            <p lang="en" className="mt-1 text-sm text-ink-900">
              {currentItem.sentence.replace('___', currentItem.choices[currentItem.answerIndex])}
            </p>
            {currentItem.explanation && (
              <p className="mt-1 text-sm text-ink-500">{currentItem.explanation}</p>
            )}
            <Button className="mt-3 w-full" onClick={next}>
              {dernier ? 'Voir le bilan' : 'Suivant'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

function classeChoix({ answered, choiceIndex, donnee, bonne }) {
  if (!answered) {
    return 'border-slate-200 text-ink-700 hover:border-brand-200 hover:bg-brand-50'
  }
  if (choiceIndex === bonne) {
    return 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-800'
  }
  if (choiceIndex === donnee) {
    return 'border-slate-300 bg-slate-50 text-ink-500 line-through'
  }
  return 'border-slate-200 text-ink-400'
}

export function DrillSummary({ topic, drill, onRestart, onNavigate }) {
  const { items, correctCount, seuilMaitrise } = drill
  const ratio = items.length > 0 ? correctCount / items.length : 0
  const maitrise = ratio >= seuilMaitrise

  return (
    <div className="space-y-4">
      <Card className="border-brand-200 bg-brand-50">
        <CardTitle>{topic.label}</CardTitle>
        <p className="mt-1 text-3xl font-bold text-brand-700">
          {correctCount} / {items.length}
        </p>
        <p className="mt-2 text-sm text-ink-700">
          {maitrise
            ? 'Ce point sort de ta file de révision. S’il ressort en dialogue, il y reviendra automatiquement.'
            : 'Ce point reste en tête de file — on le retravaillera à la prochaine session.'}
        </p>
      </Card>

      <div className="flex flex-col gap-2">
        <Button onClick={onRestart}>Nouvelle série sur ce point</Button>
        <Button variant="secondary" onClick={() => onNavigate('dialogue')}>
          Le mettre en pratique en dialogue
        </Button>
        <Button variant="ghost" onClick={() => onNavigate('dashboard')}>
          Retour à l’accueil
        </Button>
      </div>
    </div>
  )
}
