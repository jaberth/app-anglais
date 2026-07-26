import { Card, CardTitle, ComingSoon } from '../../components/Card.jsx'
import { VOCAB_DOMAINS, getVocabularyByDomain } from '../../data/vocabulary.js'

// TODO(V1) - Module vocabulaire
//
// Reste a implementer :
//  1. mode revision (carte -> traduction -> "je connais / a revoir") sur une
//     sequence courte de 8-10 termes ;
//  2. updateProgress() : vocabulary.seen[termId] = { seenCount, lastSeenAt,
//     mastered } ;
//  3. reinjection des termes vus dans les prompts de dialogue, pour qu'ils
//     reapparaissent en situation plutot que d'etre appris hors contexte.
//
// Perimetre V1 : uniquement les deux domaines ci-dessous. Gestion de projet
// studio/agence et management d'equipe sont explicitement reportes en V2.

export default function VocabularyPage({ progress }) {
  return (
    <div className="space-y-4">
      {VOCAB_DOMAINS.map((domain) => {
        const entries = getVocabularyByDomain(domain.id)
        const seenCount = entries.filter((entry) => progress.vocabulary.seen[entry.id]).length

        return (
          <Card key={domain.id}>
            <CardTitle>{domain.label}</CardTitle>
            <p className="mt-1 text-sm text-ink-500">{domain.description}</p>
            <p className="mt-2 text-xs font-medium text-brand-700">
              {seenCount} / {entries.length} termes vus
            </p>

            <ul className="mt-3 divide-y divide-slate-100">
              {entries.map((entry) => (
                <li key={entry.id} className="py-2">
                  <p className="text-sm font-semibold text-ink-900">{entry.term}</p>
                  <p className="text-xs text-ink-500">{entry.translation}</p>
                  <p className="mt-0.5 text-xs italic text-ink-400">{entry.example}</p>
                </li>
              ))}
            </ul>
          </Card>
        )
      })}

      <ComingSoon title="Mode révision">
        <p>
          Séquence de cartes à implémenter, avec suivi des termes maîtrisés et réinjection dans les
          dialogues.
        </p>
      </ComingSoon>
    </div>
  )
}
