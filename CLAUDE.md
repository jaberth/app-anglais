# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

```bash
npm run dev          # front seul, http://localhost:5173
npm run dev:worker   # build + wrangler dev : seul mode où /api/* fonctionne
npm run build        # build Vite vers dist/ + génération du service worker
npm run lint         # oxlint
npm run deploy       # build + wrangler deploy
```

`npm run dev` ne sert **pas** les routes `/api/*` : il n'y a pas de Worker devant
le serveur Vite. Tout test touchant Gemini passe par `npm run dev:worker`.

Il n'y a pas de suite de tests dans ce projet.

## Architecture

PWA mono-utilisatrice (une seule apprenante) de coaching en anglais
professionnel. Sessions de 10-15 min. **V1 texte uniquement** : pas de Web Speech
API, pas d'audio — le chat écrit est le dispositif choisi pour lever un blocage à
l'oral. Toute proposition de fonctionnalité vocale est hors périmètre.

### Le Worker est la seule porte vers Gemini

`worker/index.js` sert à la fois les assets statiques (`dist/` via le binding
`ASSETS`) et les routes `/api/*`. La clé Gemini vient du Secrets Store Cloudflare
et n'existe jamais côté client — le navigateur ne parle qu'au Worker, en même
origine. Aucun code sous `src/` ne doit appeler `generativelanguage.googleapis.com`.

Ajouter une capacité IA = deux gestes :

1. un module dans `worker/prompts/` exportant `buildXRequest(body)` (valide
   l'entrée, lève sur donnée invalide) et `parseXResponse(text)` (normalise, lève
   si inexploitable) ;
2. une entrée dans la table `ROUTES` de `worker/index.js`.

`worker/access.js` garde l'entrée des routes `/api/*` : il vérifie la signature
du jeton Cloudflare Access plutôt que de faire confiance à l'en-tête
`Cf-Access-Authenticated-User-Email`. La vérification est court-circuitée sur
`localhost` uniquement (`isLocalDev`), sans quoi `dev:worker` serait inutilisable.

`callGemini()` est générique et n'a pas à être modifiée. Les réponses du modèle
sont toujours normalisées avant d'atteindre l'UI : aucun composant ne doit se
défendre contre un champ manquant.

### Les identifiants kebab-case relient les trois modules

C'est l'invariant central de l'app. Un même identifiant (`prepositions`,
`present-perfect-vs-past-simple`, …) circule sous trois noms :

- `topicTag` sur les items du test de placement et ses `weakPoints` ;
- `errorTag` sur les corrections renvoyées par le module dialogue ;
- `id` dans `shared/grammarTopics.js`.

C'est ce qui permet à `buildReviewQueue()` de remonter en tête de file un point
de grammaire parce qu'il rate en dialogue. Un tag absent de `GRAMMAR_TOPICS`
casse ce lien **en silence** : il s'affiche à l'écran mais n'est jamais converti
en exercice.

Les prompts du Worker injectent donc la liste fermée des tags via
`tagsForPrompt()` plutôt que de donner des exemples — c'est précisément ce qui
avait dérivé : deux des quatre tags cités en exemple dans le prompt de dialogue
n'existaient pas. Ajouter un point de grammaire = une entrée dans
`GRAMMAR_TOPICS`, et les deux prompts le connaissent aussitôt. Ne jamais écrire
un tag en dur dans un prompt.

### Persistance : asynchrone exprès

`src/lib/storage/progressStore.js` est le **seul** point d'accès au stockage.
Aucun composant n'appelle `localStorage` directement. L'API est asynchrone alors
que localStorage est synchrone : c'est délibéré, pour que la bascule vers
Cloudflare KV (prévue si le multi-appareils devient nécessaire) ne touche que le
`backend` en bas de ce fichier.

Toute la progression tient dans **un seul objet sérialisable**, versionné par
`SCHEMA_VERSION` dans `schema.js` (v2 depuis l'arrivée de `placementDraft`, le
brouillon qui rend un test de placement interrompu reprenable). Faire évoluer le
schéma = ajouter une entrée à `MIGRATIONS` et incrémenter la version. Ne jamais modifier une migration déjà
livrée. `migrate()` retourne un état vierge plutôt que de planter, y compris face
à un état venu d'une version plus récente.

### `shared/` est lu des deux côtés

Deux modules y vivent, pour la même raison : le front et le Worker en ont besoin
tous les deux, et les dupliquer ferait diverger le prompt de l'écran.

- `shared/scenarios.js` — les 3 scénarios de dialogue (libellés d'écran côté
  front, construction du prompt côté Worker) ;
- `shared/grammarTopics.js` — le catalogue de grammaire, la file de révision, et
  la liste fermée de tags injectée dans les prompts.

Ne pas dupliquer ces données dans `src/data/`, qui ne garde que ce dont le
Worker n'a aucun usage (`vocabulary.js`).

### Navigation

Pas de router : `src/App.jsx` mappe un état local à un composant d'écran. L'app a
5 écrans, tous atteints depuis le tableau de bord, en usage PWA plein écran. Ne
pas introduire de dépendance de routage sans besoin réel d'URL partageables.

## État d'implémentation

Le **test de placement est implémenté** (`features/placement-test/`) : intro,
passage item par item, évaluation, restitution, et écriture du profil + de la
file de révision. Il est la seule source de `profile.level` et
`profile.weakPoints`.

Le **module dialogue est implémenté** (`features/dialogue/`) : sélection du
scénario, fil de conversation, feedback correctif sous chaque réponse, bilan de
session. Il alimente `sessions[]`, `recurringErrors` et `vocabulary.seen`.

La première réplique vient du champ `opener` de `shared/scenarios.js`, pas d'un
appel Gemini : `continueDialogue()` exige un `userMessage` pour produire son
feedback, la conversation ne peut donc pas s'ouvrir par l'API.

`recurringErrors` ne compte que les tags présents dans `GRAMMAR_TOPICS`, pas
l'ensemble des tags connus. Les tags hors grammaire (`general`, …) sont des
réponses légitimes du modèle mais ne correspondent à aucun exercice : les
compter créerait un compteur mort affiché sous un bouton « travailler ces
points » qui ne mènerait nulle part.

`vocabulary.seen` n'enregistre que les termes suggérés qui figurent dans
`src/data/vocabulary.js`, puisqu'il est indexé par l'id du catalogue. En
pratique le modèle suggère surtout des termes contextuels, donc peu de choses y
atterrissent — c'est le module vocabulaire qui devra injecter le catalogue dans
le prompt de dialogue pour que les termes ciblés reviennent en situation.

Restent marqués `ComingSoon` : exercices de grammaire, mode révision du
vocabulaire. Chaque fichier concerné porte un bloc `TODO(V1)` en tête décrivant
le travail restant et les fonctions déjà en place.

Le module grammaire nécessitera une route `/api/grammar` qui n'existe pas encore.

## Conventions

- Commentaires de code en français **sans accents** (cohérence avec les autres
  projets de l'écosystème) ; texte affiché à l'utilisatrice en français
  **accentué**.
- Les exercices et dialogues doivent utiliser le contexte métier réel de
  l'utilisatrice (agence créative, campagne, board, budget média) plutôt que des
  situations génériques : c'est la valeur ajoutée face à une app d'anglais
  standard.
- Le feedback correctif se limite à 2 corrections par tour, encouragement
  d'abord. Le profil cible sous-estime son niveau réel ; une correction
  exhaustive est contre-productive et réactive le blocage.
- Vocabulaire limité à deux domaines en V1 : brand strategy et growth &
  acquisition. Gestion de projet studio/agence et management d'équipe sont V2.

## Déploiement

Voir `README.md`. Le bloc `[[secrets_store_secrets]]` est renseigné : le store
est partagé avec Golf Tracker, mais le `secret_name` est distinct
(`GEMINI_API_KEY_ANGLAIS`). Ne jamais créer de secret `GEMINI_API_KEY` dans ce
store, ce serait écraser la clé de l'autre app.

Le seul point restant est `ACCESS_AUD` dans `[vars]`, à reporter depuis
l'application Cloudflare Access une fois celle-ci créée. Tant qu'il vaut son
placeholder, `/api/*` répond 401 en production — fail-closed délibéré.
