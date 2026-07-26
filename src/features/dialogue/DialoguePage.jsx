import { useState } from 'react'
import { Card, CardTitle, ComingSoon } from '../../components/Card.jsx'
import { SCENARIOS } from '../../../shared/scenarios.js'

// TODO(V1) - Module de dialogue
//
// L'ecran de selection ci-dessous est fonctionnel ; reste a implementer la
// conversation elle-meme :
//  1. fil de discussion (repliques IA + reponses utilisatrice) ;
//  2. envoi via continueDialogue() -> lib/api/coachClient.js, en passant
//     scenarioId, level (profile.level), history et userMessage ;
//  3. affichage du feedback correctif SOUS la reponse envoyee : encouragement,
//     corrections (max 2), reformulation "plus pro" ;
//  4. fin de session -> updateProgress() : ajout dans sessions[], incrementation
//     de recurringErrors[errorTag], ajout des termes dans vocabulary.seen.
//
// Point d'attention : ne jamais bloquer la saisie pendant l'appel reseau, le
// blocage a l'oral se rejoue a l'ecrit si l'interface donne l'impression de
// juger. Afficher un etat "le coach repond..." discret.

export default function DialoguePage() {
  const [selected, setSelected] = useState(null)
  const scenario = SCENARIOS.find((item) => item.id === selected)

  if (scenario) {
    return (
      <div className="space-y-4">
        <Card>
          <CardTitle>{scenario.title}</CardTitle>
          <p className="mt-1 text-sm text-ink-500">{scenario.description}</p>
          <ul className="mt-3 space-y-1 text-sm text-ink-700">
            {scenario.goals.map((goal) => (
              <li key={goal} className="flex gap-2">
                <span aria-hidden className="text-brand-600">
                  •
                </span>
                {goal}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mt-4 text-sm font-medium text-ink-500 hover:text-ink-900"
          >
            ← Changer de scénario
          </button>
        </Card>

        <ComingSoon title="Conversation">
          <p>
            Fil de discussion à implémenter : réplique du personnage, zone de réponse, et feedback
            correctif après chaque message.
          </p>
        </ComingSoon>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">
        Choisis la situation que tu veux travailler aujourd’hui.
      </p>
      {SCENARIOS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setSelected(item.id)}
          className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50"
        >
          <span className="block text-sm font-semibold text-ink-900">{item.title}</span>
          <span className="block text-xs italic text-ink-400">{item.subtitle}</span>
          <span className="mt-1 block text-sm text-ink-500">{item.description}</span>
        </button>
      ))}
    </div>
  )
}
