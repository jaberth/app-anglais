// Banque de vocabulaire metier, limitee aux deux sous-domaines prioritaires
// de la V1. Les autres domaines (gestion de projet studio/agence, management
// d'equipe) sont explicitement hors perimetre -> V2.
//
// Amorce volontairement courte : elle sert a valider le format et l'ecran.
// Le contenu complet se remplit au fil des sessions.
//
// Vit dans shared/ et non dans src/data/ parce que le Worker en a besoin : le
// prompt de dialogue reinjecte ces termes pour que le coach les remploie en
// situation. C'est ce qui fait la difference entre apprendre un terme sur une
// carte et le rencontrer dans une phrase de reunion.

export const VOCAB_DOMAINS = [
  {
    id: 'brand-strategy',
    label: 'Brand strategy & positionnement créatif',
    description: 'Le vocabulaire des ateliers de marque, des briefs créatifs et des arbitrages.',
  },
  {
    id: 'growth-acquisition',
    label: 'Growth & acquisition',
    description: 'Ads, funnel, data : le vocabulaire des points de performance.',
  },
]

export const VOCABULARY = [
  // --- Brand strategy & positionnement créatif ---
  {
    id: 'brand-positioning',
    domain: 'brand-strategy',
    term: 'brand positioning',
    translation: 'positionnement de marque',
    example: 'We need to sharpen our brand positioning before the next campaign.',
  },
  {
    id: 'value-proposition',
    domain: 'brand-strategy',
    term: 'value proposition',
    translation: 'proposition de valeur',
    example: 'The value proposition is not coming across in the current creative.',
  },
  {
    id: 'tone-of-voice',
    domain: 'brand-strategy',
    term: 'tone of voice',
    translation: 'ton de marque',
    example: 'This copy drifts away from our tone of voice.',
  },
  {
    id: 'creative-brief',
    domain: 'brand-strategy',
    term: 'creative brief',
    translation: 'brief créatif',
    example: 'Let me walk you through the creative brief before you start.',
  },
  {
    id: 'brand-awareness',
    domain: 'brand-strategy',
    term: 'brand awareness',
    translation: 'notoriété de marque',
    example: 'This campaign is about brand awareness, not conversion.',
  },
  {
    id: 'look-and-feel',
    domain: 'brand-strategy',
    term: 'look and feel',
    translation: 'direction artistique / rendu visuel',
    example: 'The look and feel is close, but the typography feels off-brand.',
  },
  {
    id: 'stakeholder-buy-in',
    domain: 'brand-strategy',
    term: 'stakeholder buy-in',
    translation: 'adhésion des parties prenantes',
    example: 'We will not ship this without stakeholder buy-in.',
  },

  // --- Growth & acquisition ---
  {
    id: 'funnel',
    domain: 'growth-acquisition',
    term: 'funnel',
    translation: 'tunnel de conversion',
    example: 'We are losing people in the middle of the funnel.',
  },
  {
    id: 'customer-acquisition-cost',
    domain: 'growth-acquisition',
    term: 'customer acquisition cost (CAC)',
    translation: 'coût d’acquisition client',
    example: 'Our customer acquisition cost went up 20% quarter over quarter.',
  },
  {
    id: 'return-on-ad-spend',
    domain: 'growth-acquisition',
    term: 'return on ad spend (ROAS)',
    translation: 'retour sur investissement publicitaire',
    example: 'Return on ad spend is flat despite the extra budget.',
  },
  {
    id: 'conversion-rate',
    domain: 'growth-acquisition',
    term: 'conversion rate',
    translation: 'taux de conversion',
    example: 'The landing page conversion rate dropped after the redesign.',
  },
  {
    id: 'attribution',
    domain: 'growth-acquisition',
    term: 'attribution',
    translation: 'attribution (des conversions)',
    example: 'Attribution is unreliable since the tracking change.',
  },
  {
    id: 'to-scale-a-campaign',
    domain: 'growth-acquisition',
    term: 'to scale a campaign',
    translation: 'monter en puissance sur une campagne',
    example: 'Before we scale this campaign, I want a clean test read.',
  },
  {
    id: 'incrementality',
    domain: 'growth-acquisition',
    term: 'incrementality',
    translation: 'incrémentalité (effet réel)',
    example: 'These numbers look great, but what is the incrementality?',
  },
]

export function getVocabularyByDomain(domainId) {
  return VOCABULARY.filter((entry) => entry.domain === domainId)
}

export function getVocabularyEntry(id) {
  return VOCABULARY.find((entry) => entry.id === id) || null
}

/**
 * Sequence de revision, courte par construction : une session dure 10-15 min et
 * le vocabulaire n'en est qu'une partie.
 *
 * Priorite : ce qui a ete vu mais pas acquis d'abord (c'est la que le rappel
 * paie), puis ce qui n'a jamais ete vu, et seulement ensuite ce qui est deja
 * acquis — pour l'entretenir sans y passer la session.
 */
export function buildReviewSequence({ seen = {}, size = 8 } = {}) {
  const rang = (entry) => {
    const suivi = seen[entry.id]
    if (!suivi) return 1 // jamais vu
    if (!suivi.mastered) return 0 // vu, pas acquis : prioritaire
    return 2 // acquis : entretien
  }

  return [...VOCABULARY]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const ecart = rang(a.entry) - rang(b.entry)
      // A rang egal, on garde l'ordre du catalogue plutot qu'un aleatoire : la
      // sequence reste reproductible, donc debuggable.
      return ecart !== 0 ? ecart : a.index - b.index
    })
    .slice(0, size)
    .map(({ entry }) => entry.id)
}

/**
 * Termes a remettre en circulation dans un dialogue.
 *
 * Meme priorite que la revision, mais l'objectif differe : il ne s'agit pas de
 * faire reciter, seulement de donner au coach de quoi les employer naturellement
 * dans sa replique.
 */
export function vocabularyForDialogue({ seen = {}, limit = 10 } = {}) {
  return buildReviewSequence({ seen, size: limit })
}
