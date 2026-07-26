// Catalogue des points de grammaire travailles par le module de revision.
//
// Les `id` servent de cle commune a tout l'app : ils sont utilises comme
// `topicTag` par le test de placement et comme `errorTag` par le feedback des
// dialogues. C'est ce qui permet de dire "cette erreur revient en dialogue,
// donc on remonte ce point dans la file de revision".
//
// `order` = progression pedagogique par defaut, du plus structurant au plus fin.

export const GRAMMAR_TOPICS = [
  {
    id: 'present-perfect-vs-past-simple',
    order: 1,
    label: 'Present perfect vs past simple',
    why: 'Le piège n°1 des francophones : "I work here since 2019" au lieu de "I have been working here since 2019".',
    level: 'B1',
  },
  {
    id: 'prepositions',
    order: 2,
    label: 'Prepositions',
    why: 'in / on / at / for / by : les erreurs les plus visibles à l’oral, alors que la règle est courte.',
    level: 'A2',
  },
  {
    id: 'word-order',
    order: 3,
    label: 'Ordre des mots',
    why: 'Calquer l’ordre français rend la phrase difficile à suivre, même quand le vocabulaire est juste.',
    level: 'A2',
  },
  {
    id: 'articles',
    order: 4,
    label: 'Articles (a / an / the / zero)',
    why: '"The marketing is important" sonne immédiatement non natif.',
    level: 'A2',
  },
  {
    id: 'question-forms',
    order: 5,
    label: 'Formes interrogatives',
    why: 'Indispensable pour animer une réunion : relancer, challenger, faire préciser.',
    level: 'B1',
  },
  {
    id: 'modals',
    order: 6,
    label: 'Modaux (can / could / should / would)',
    why: 'Le levier principal de diplomatie : "you should" vs "you could maybe" change tout en réunion.',
    level: 'B1',
  },
  {
    id: 'conditionals',
    order: 7,
    label: 'Conditionnels',
    why: 'Nécessaire pour présenter des scénarios et des hypothèses budgétaires.',
    level: 'B1',
  },
  {
    id: 'reported-speech',
    order: 8,
    label: 'Discours rapporté',
    why: 'Rapporter ce qu’a dit l’agence ou le client est le quotidien d’un point hebdo.',
    level: 'B2',
  },
  {
    id: 'passive-voice',
    order: 9,
    label: 'Voix passive',
    why: 'Très fréquente à l’écrit professionnel et dans les comptes rendus.',
    level: 'B2',
  },
  {
    id: 'gerund-vs-infinitive',
    order: 10,
    label: 'Gérondif vs infinitif',
    why: '"I look forward to hear from you" est l’erreur classique des emails pro.',
    level: 'B2',
  },
]

export function getGrammarTopic(id) {
  return GRAMMAR_TOPICS.find((topic) => topic.id === id) || null
}

/**
 * File de revision : les lacunes detectees d'abord (dans l'ordre de priorite
 * fourni par le test), puis la progression par defaut pour la suite.
 * Les topics deja maitrises sont exclus.
 */
export function buildReviewQueue({ weakPointTags = [], masteredTags = [] } = {}) {
  const mastered = new Set(masteredTags)
  const prioritized = weakPointTags.filter(
    (tag) => !mastered.has(tag) && GRAMMAR_TOPICS.some((topic) => topic.id === tag),
  )
  const seen = new Set(prioritized)

  const rest = [...GRAMMAR_TOPICS]
    .sort((a, b) => a.order - b.order)
    .map((topic) => topic.id)
    .filter((id) => !mastered.has(id) && !seen.has(id))

  return [...prioritized, ...rest]
}
