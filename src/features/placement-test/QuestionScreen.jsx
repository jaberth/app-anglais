// Un item par ecran : sur mobile, empiler plusieurs questions rend le test
// illisible et donne l'impression d'un examen. Une question, une action.
//
// Aucune correction n'est affichee pendant le passage : c'est un test de
// placement, pas un exercice. Montrer les erreurs au fil de l'eau reactiverait
// exactement le blocage qu'on cherche a lever.

import { useState } from 'react'
import { Button, Card } from '../../components/Card.jsx'

export default function QuestionScreen({
  item,
  index,
  total,
  savedAnswer,
  canGoBack,
  onAnswer,
  onBack,
}) {
  const isLast = index === total - 1

  return (
    <div className="space-y-4">
      <Progress index={index} total={total} />

      <Card>
        {item.passage && (
          <p
            lang="en"
            className="mb-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-ink-700"
          >
            {item.passage}
          </p>
        )}

        <p className="text-base font-medium text-ink-900">{item.prompt}</p>

        {item.type === 'mcq' ? (
          <ChoiceList
            key={item.id}
            choices={item.choices}
            savedIndex={savedAnswer?.selectedIndex ?? null}
            isLast={isLast}
            onAnswer={onAnswer}
          />
        ) : (
          <OpenAnswer
            key={item.id}
            savedText={savedAnswer?.text ?? ''}
            isLast={isLast}
            onAnswer={onAnswer}
          />
        )}
      </Card>

      {canGoBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-ink-500 hover:text-ink-900"
        >
          ← Question précédente
        </button>
      )}
    </div>
  )
}

function Progress({ index, total }) {
  const done = Math.round(((index + 1) / total) * 100)

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-ink-500">
        <span>
          Question {index + 1} sur {total}
        </span>
        <span>{done} %</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label="Avancement du test"
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
          style={{ width: `${done}%` }}
        />
      </div>
    </div>
  )
}

function ChoiceList({ choices, savedIndex, isLast, onAnswer }) {
  const [selected, setSelected] = useState(savedIndex)

  return (
    <>
      <ul className="mt-4 space-y-2">
        {choices.map((choice, choiceIndex) => {
          const active = selected === choiceIndex
          return (
            <li key={choice}>
              <button
                type="button"
                lang="en"
                aria-pressed={active}
                onClick={() => setSelected(choiceIndex)}
                className={`min-h-11 w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                  active
                    ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700'
                    : 'border-slate-200 text-ink-700 hover:border-brand-200 hover:bg-brand-50'
                }`}
              >
                {choice}
              </button>
            </li>
          )
        })}
      </ul>

      <Actions
        isLast={isLast}
        canSubmit={selected !== null}
        onSubmit={() => onAnswer({ selectedIndex: selected })}
        onSkip={() => onAnswer({ selectedIndex: null })}
        skipLabel="Je ne sais pas"
      />
    </>
  )
}

function OpenAnswer({ savedText, isLast, onAnswer }) {
  const [text, setText] = useState(savedText)
  const trimmed = text.trim()

  return (
    <>
      <textarea
        lang="en"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        placeholder="Écris ta réponse en anglais…"
        className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500"
      />
      <p className="mt-1 text-xs text-ink-400">
        Une ou deux phrases suffisent. Les fautes ne sont pas comptées comme des erreurs : c’est
        justement ce qu’on mesure.
      </p>

      <Actions
        isLast={isLast}
        canSubmit={trimmed.length > 0}
        onSubmit={() => onAnswer({ text: trimmed })}
        onSkip={() => onAnswer({ text: '' })}
        skipLabel="Passer"
      />
    </>
  )
}

function Actions({ isLast, canSubmit, onSubmit, onSkip, skipLabel }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <Button className="flex-1" disabled={!canSubmit} onClick={onSubmit}>
        {isLast ? 'Terminer le test' : 'Suivant'}
      </Button>
      <Button variant="ghost" onClick={onSkip}>
        {skipLabel}
      </Button>
    </div>
  )
}
