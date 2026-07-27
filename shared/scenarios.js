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
