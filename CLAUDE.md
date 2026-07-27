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
- `id` dans `src/data/grammarTopics.js`.

C'est ce qui permet à `buildReviewQueue()` de remonter en tête de file un point
de grammaire parce qu'il rate en dialogue. Introduire un tag qui n'existe pas
dans `GRAMMAR_TOPICS` casse silencieusement ce lien : le tag est alors ignoré par
la file de révision.

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

`shared/scenarios.js` est importé par le front (libellés d'écran) et par le
Worker (construction du prompt). Source unique de vérité pour les 3 scénarios de
dialogue. Ne pas dupliquer ces données dans `src/data/`.

### Navigation

Pas de router : `src/App.jsx` mappe un état local à un composant d'écran. L'app a
5 écrans, tous atteints depuis le tableau de bord, en usage PWA plein écran. Ne
pas introduire de dépendance de routage sans besoin réel d'URL partageables.

## État d'implémentation

Le **test de placement est implémenté** (`features/placement-test/`) : intro,
passage item par item, évaluation, restitution, et écriture du profil + de la
file de révision. Il est la seule source de `profile.level` et
`profile.weakPoints`.

Restent marqués `ComingSoon` : fil de conversation du dialogue, exercices de
grammaire, mode révision du vocabulaire. Chaque fichier concerné porte un bloc
`TODO(V1)` en tête décrivant le travail restant et les fonctions déjà en place.

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
