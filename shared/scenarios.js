// Definition des 3 scenarios de dialogue, partagee entre le front (libelles de
// l'ecran de selection) et le Worker (construction du prompt Gemini).
// Source unique de verite : un scenario ajoute ici est disponible des deux cotes.
//
// `opener` est la premiere replique du personnage joue par l'IA. Elle est ecrite
// ici plutot que generee : continueDialogue() exige un userMessage pour produire
// son feedback, la conversation ne peut donc pas s'ouvrir par un appel a l'API.
// C'est aussi mieux ainsi — la session demarre instantanement, et c'est le
// personnage qui parle en premier, ce qui evite a l'utilisatrice d'affronter un
// champ de saisie vide sans contexte.

export const SCENARIOS = [
  {
    id: 'weekly-agency',
    title: 'Point hebdo avec l’agence',
    subtitle: 'Weekly check-in with a creative agency',
    description:
      'Un point d’avancement hebdomadaire avec une agence créative anglophone : suivi des livrables, arbitrages, recadrage sur le brief.',
    // Role tenu par l'IA, injecte dans le prompt systeme.
    aiRole:
      'a senior account director at a London-based creative agency, running the weekly status call',
    userRole: 'the client-side Digital Marketing & Creative Director',
    opener:
      'Hi! Thanks for making the time. Before I run through the status, is there anything you want us to cover first?',
    goals: [
      'Demander un point d’avancement et challenger un retard',
      'Donner du feedback sur une création sans être agressive',
      'Arbitrer une priorité et fixer une échéance claire',
    ],
  },
  {
    id: 'board-pitch',
    title: 'Pitch à un board / client',
    subtitle: 'Presenting a recommendation to a board',
    description:
      'Présentation d’une recommandation stratégique à un comité de direction ou un client anglophone, suivie de questions.',
    aiRole:
      'a demanding board member who asks short, pointed questions about business impact and budget',
    userRole: 'the Digital Marketing & Creative Director presenting the recommendation',
    opener:
      'Right, we have fifteen minutes. Give me the headline first: what are you recommending, and what does it cost?',
    goals: [
      'Poser le contexte et la recommandation en moins de trois phrases',
      'Justifier un budget avec des chiffres',
      'Répondre à une objection sans se justifier à l’excès',
    ],
  },
  {
    id: 'one-to-one',
    title: 'One-to-one management',
    subtitle: 'One-to-one with a team member',
    description:
      'Entretien individuel avec un collaborateur anglophone : suivi, feedback, motivation, recadrage bienveillant.',
    aiRole:
      'a mid-level marketing manager reporting to the user, currently a bit demotivated and vague about progress',
    userRole: 'their manager, the Digital Marketing & Creative Director',
    opener: 'Hi, you wanted to see me? Things are… fine, I guess. Busy month.',
    goals: [
      'Ouvrir l’échange et faire parler le collaborateur',
      'Formuler un feedback correctif clair et respectueux',
      'S’accorder sur un plan d’action',
    ],
  },
]

export function getScenario(id) {
  return SCENARIOS.find((scenario) => scenario.id === id) || null
}

// --- Scenarios personnalises ------------------------------------------------
//
// Un scenario sur mesure ne peut pas etre resolu par getScenario() : il n'existe
// pas dans la liste ci-dessus, il est fabrique a la demande puis transmis par le
// client a chaque tour. Cela veut dire que du texte venu du navigateur entre
// dans le prompt systeme, alors que jusqu'ici le front n'envoyait que des
// identifiants.
//
// D'ou cette normalisation, appliquee des DEUX cotes : le front s'en sert pour
// stocker une forme propre, le Worker pour ne jamais faire confiance a ce qu'il
// recoit. Les plafonds sont volontairement serres — ils bornent a la fois la
// surface d'injection et la consommation de quota.

export const CUSTOM_SCENARIO_PREFIX = 'custom:'

const LIMITS = {
  title: 120,
  subtitle: 160,
  description: 700,
  aiRole: 400,
  userRole: 250,
  opener: 500,
  goal: 200,
  goals: 5,
}

export function isCustomScenarioId(id) {
  return typeof id === 'string' && id.startsWith(CUSTOM_SCENARIO_PREFIX)
}

function clamp(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Ramene un scenario d'origine quelconque a la forme exacte attendue par le
 * prompt. Retourne null si l'essentiel manque : mieux vaut refuser que lancer
 * un dialogue sans role ni replique d'ouverture.
 */
export function normalizeCustomScenario(raw, { id } = {}) {
  if (!raw || typeof raw !== 'object') return null

  const goals = (Array.isArray(raw.goals) ? raw.goals : [])
    .map((goal) => clamp(goal, LIMITS.goal))
    .filter(Boolean)
    .slice(0, LIMITS.goals)

  const scenario = {
    id: id ?? (isCustomScenarioId(raw.id) ? raw.id : `${CUSTOM_SCENARIO_PREFIX}${crypto.randomUUID()}`),
    custom: true,
    title: clamp(raw.title, LIMITS.title),
    subtitle: clamp(raw.subtitle, LIMITS.subtitle),
    description: clamp(raw.description, LIMITS.description),
    aiRole: clamp(raw.aiRole, LIMITS.aiRole),
    userRole: clamp(raw.userRole, LIMITS.userRole),
    opener: clamp(raw.opener, LIMITS.opener),
    goals,
  }

  // aiRole et opener portent tout le jeu de role ; description situe la scene.
  // Sans eux il n'y a pas de scenario, juste un titre.
  if (!scenario.aiRole || !scenario.opener || !scenario.description) return null
  if (!scenario.title) scenario.title = 'Ma situation'

  return scenario
}
