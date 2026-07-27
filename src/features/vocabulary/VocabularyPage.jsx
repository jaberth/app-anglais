// Module vocabulaire : lancement d'une serie de revision, puis banque complete.
//
// Perimetre V1 : uniquement les deux domaines ci-dessous. Gestion de projet
// studio/agence et management d'equipe sont explicitement reportes en V2.

import { useState } from 'react'
import { Button, Card, CardTitle } from '../../components/Card.jsx'
import { VOCAB_DOMAINS, VOCABULARY, getVocabularyByDomain } from '../../../shared/vocabulary.js'
import ReviewScreen, { ReviewSummary } from './ReviewScreen.jsx'
import { useVocabularyReview } from './useVocabularyReview.js'

export default function VocabularyPage({ progress, updateProgress, onNavigate }) {
  // `serie` sert de cle de remontage : relancer une serie doit repartir d'un
  // etat vierge et recalculer la sequence a partir de la progression a jour.
  const [serie, setSerie] = useState(null)

  if (serie !== null) {
    return (
      <RevisionEnCours
        key={serie}
        progress={progress}
        updateProgress={updateProgress}
        onQuit={() => setSerie(null)}
        onRestart={() => setSerie(serie + 1)}
        onNavigate={onNavigate}
      />
    )
  }

  const vus = Object.keys(progress.vocabulary.seen).length
  const acquis = Object.values(progress.vocabulary.seen).filter((suivi) => suivi.mastered).length

  return (
    <div className="space-y-4">
      <Card className="border-brand-200 bg-brand-50">
        <CardTitle>Série de révision</CardTitle>
        <p className="mt-1 text-sm text-ink-700">
          Huit cartes, deux minutes. Les termes que tu ne retrouves pas reviennent en priorité, et le
          coach cherche à les replacer dans tes dialogues.
        </p>
        <p className="mt-2 text-xs font-medium text-brand-700">
          {acquis} / {VOCABULARY.length} termes maîtrisés · {vus} rencontrés
        </p>
        <Button className="mt-3 w-full" onClick={() => setSerie(0)}>
          Commencer
        </Button>
      </Card>

      {VOCAB_DOMAINS.map((domain) => {
        const entries = getVocabularyByDomain(domain.id)

        return (
          <Card key={domain.id}>
            <CardTitle>{domain.label}</CardTitle>
            <p className="mt-1 text-sm text-ink-500">{domain.description}</p>

            <ul className="mt-3 divide-y divide-slate-100">
              {entries.map((entry) => {
                const suivi = progress.vocabulary.seen[entry.id]

                return (
                  <li key={entry.id} className="flex items-start justify-between gap-3 py-2">
                    <span>
                      <span lang="en" className="block text-sm font-semibold text-ink-900">
                        {entry.term}
                      </span>
                      <span className="block text-xs text-ink-500">{entry.translation}</span>
                      <span lang="en" className="mt-0.5 block text-xs italic text-ink-400">
                        {entry.example}
                      </span>
                    </span>
                    {suivi?.mastered && (
                      <span
                        className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                        title={`Vu ${suivi.seenCount} fois`}
                      >
                        acquis
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        )
      })}
    </div>
  )
}

function RevisionEnCours({ progress, updateProgress, onQuit, onRestart, onNavigate }) {
  const review = useVocabularyReview({ progress, updateProgress })

  if (review.finished) {
    return <ReviewSummary review={review} onRestart={onRestart} onNavigate={onNavigate} />
  }

  return <ReviewScreen review={review} onQuit={onQuit} />
}
