# Coach Anglais Pro

PWA de coaching en anglais professionnel, mono-utilisatrice. Sessions courtes
(10-15 min) : dialogues de réunion simulés, révision grammaticale ciblée et
vocabulaire métier (brand strategy / growth & acquisition).

**V1 = texte uniquement.** Aucune reconnaissance vocale ni enregistrement audio :
le chat écrit sert à lever le blocage à l'oral sans la pression de parler. La
pratique vocale est explicitement reportée en V2.

## Stack

| Aspect      | Choix                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Front       | React 19 + Vite 8 + Tailwind CSS 4                                    |
| PWA         | `vite-plugin-pwa` (manifest + service worker, `autoUpdate`)           |
| Backend     | Cloudflare Workers (Static Assets + proxy `/api/*`)                   |
| IA          | Gemini API (`gemini-2.5-flash`), appelée **uniquement** par le Worker |
| Persistance | LocalStorage (schéma versionné, migration-ready vers KV)              |
| Auth        | Aucune côté app — voir Cloudflare Access ci-dessous                   |

## Développement

```bash
npm install
npm run dev
```

Le front seul tourne sur `http://localhost:5173`. Les appels `/api/*` échouent
dans ce mode : il n'y a pas de Worker devant. Pour tester le proxy Gemini :

```bash
npm run dev:worker
```

(`wrangler dev` sert le build de `dist/` et exécute réellement `worker/index.js`.)

## Structure

```
src/
  components/           Primitives UI partagées (AppShell, Card, Button)
  features/
    dashboard/          Tableau de bord : session du jour, historique, niveau
    placement-test/     Test de placement (à implémenter)
    dialogue/           Dialogues scénarisés + feedback correctif
    grammar/            File de révision priorisée par les lacunes
    vocabulary/         Banque de vocabulaire métier
  data/                 Contenus statiques (grammaire, vocabulaire)
  lib/
    api/                Client HTTP vers le Worker
    storage/            Schéma, store et hook de progression
shared/                 Constantes partagées front + Worker (scénarios)
worker/
  index.js              Routage /api/* + appel Gemini
  prompts/              Construction et parsing des prompts, par capacité
```

Règle : **aucun composant n'écrit dans `localStorage` directement**, tout passe
par `src/lib/storage/progressStore.js`. Son API est asynchrone exprès — c'est ce
qui rendra la bascule vers Cloudflare KV indolore.

## Déploiement

### 1. Clé Gemini (Secrets Store)

La clé ne doit jamais apparaître dans le repo ni dans le bundle client.

```bash
npx wrangler secrets-store store create coach-anglais
```

```bash
npx wrangler secrets-store secret create <STORE_ID> --name GEMINI_API_KEY --scopes workers
```

Puis décommenter et renseigner le bloc `[[secrets_store_secrets]]` dans
`wrangler.toml` avec le `store_id` obtenu.

### 2. Déployer

```bash
npm run deploy
```

### 3. Protéger l'URL avec Cloudflare Access — recommandé

Sans cette étape, l'URL `*.workers.dev` est publique : n'importe qui la
découvrant peut consommer le quota Gemini du compte. L'app n'a aucune
authentification applicative (mono-utilisatrice), Access est donc la seule
barrière.

Dans le dashboard Cloudflare → **Zero Trust → Access → Applications** :

1. **Add an application** → _Self-hosted_
2. Domaine : celui du Worker déployé
3. Policy : _Allow_, règle **Emails** → l'adresse email de l'utilisatrice
4. Ajouter une seconde règle _Allow_ avec l'email de l'administrateur, sinon tu
   seras toi-même bloqué hors de ton app

Le Worker pose déjà `X-Robots-Tag: noindex, nofollow` sur toutes les réponses
statiques, en défense en profondeur.

### 4. Alerte de facturation

Le budget cible est de 0 € (tiers gratuits Gemini + Cloudflare). Configurer une
alerte de facturation côté Google Cloud dès la création de la clé Gemini.

## Reste à implémenter

Les écrans marqués `ComingSoon` dans l'UI portent chacun un bloc `TODO(V1)` en
tête de fichier détaillant le travail restant :

- `features/placement-test/` — génération, passage et restitution du test
- `features/dialogue/` — fil de conversation et affichage du feedback
- `features/grammar/` — séries d'exercices (nécessite une route `/api/grammar`)
- `features/vocabulary/` — mode révision par cartes

## Hors périmètre V1

Pratique orale (voix), comptes multiples, correction humaine, application native
en store, vocabulaire au-delà des deux sous-domaines prioritaires.
