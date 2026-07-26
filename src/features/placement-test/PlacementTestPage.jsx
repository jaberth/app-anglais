import { ComingSoon } from '../../components/Card.jsx'

// TODO(V1) - Test de placement
//
// Parcours a implementer :
//  1. ecran d'intro (duree annoncee, ce qui sera mesure) ;
//  2. generation des items via generatePlacementTest() -> lib/api/coachClient.js ;
//  3. passage item par item (QCM + 2 questions ouvertes), une question par ecran
//     pour rester lisible sur mobile ;
//  4. envoi des reponses a evaluatePlacementTest() ;
//  5. ecran de resultat : niveau + au moins 2 points faibles nommes + resume ;
//  6. ecriture dans la progression via updateProgress() :
//     - profile.level / profile.assessedAt / profile.weakPoints
//     - ajout d'une entree dans placementTests[]
//     - alimentation de grammar.toReview (voir buildReviewQueue()).
//
// Contrainte du brief : restituer un niveau et >= 2 points faibles en moins de
// 10 minutes. Prevoir une reprise si l'app est fermee en cours de test.

export default function PlacementTestPage() {
  return (
    <ComingSoon title="Test de niveau">
      <p>
        Écran à implémenter : génération des items via le Worker, passage question par question,
        puis restitution du niveau et des points faibles.
      </p>
      <p>
        Le contrat d’API est déjà posé dans{' '}
        <code className="rounded bg-slate-100 px-1">lib/api/coachClient.js</code> et les prompts
        dans <code className="rounded bg-slate-100 px-1">worker/prompts/placementTest.js</code>.
      </p>
    </ComingSoon>
  )
}
