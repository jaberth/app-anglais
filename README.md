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
| IA          | Gemini API (`gemini-3.6-flash`), appelée **uniquement** par le Worker |
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
    placement-test/     Test de placement : intro, passage, restitution
    dialogue/           Dialogues scénarisés : conversation + feedback correctif
    grammar/            File de révision priorisée par les lacunes
    vocabulary/         Révision par cartes + banque de vocabulaire métier
  lib/
    api/                Client HTTP vers le Worker
    storage/            Schéma, store et hook de progression
shared/                 Lu par le front ET le Worker : scénarios, grammaire,
                        vocabulaire — source unique des données qui alimentent
                        à la fois les écrans et les prompts
worker/
  index.js              Routage /api/* + appel Gemini
  prompts/              Construction et parsing des prompts, par capacité
```

Règle : **aucun composant n'écrit dans `localStorage` directement**, tout passe
par `src/lib/storage/progressStore.js`. Son API est asynchrone exprès — c'est ce
qui rendra la bascule vers Cloudflare KV indolore.

## Déploiement

### 1. Clé Gemini (Secrets Store)

La clé ne doit jamais apparaître dans le repo ni dans le bundle client. Elle est
déjà en place : le bloc `[[secrets_store_secrets]]` de `wrangler.toml` est
renseigné, rien à faire pour un déploiement normal.

Le store est **partagé avec Golf Tracker** — un Secrets Store est un coffre au
niveau du compte, pas du Worker. Seul le nom du secret diffère :

| App | `secret_name` |
| ------------- | ------------------------ |
| Golf Tracker | `GEMINI_API_KEY` |
| Coach Anglais | `GEMINI_API_KEY_ANGLAIS` |

⚠️ Ne jamais créer de secret nommé `GEMINI_API_KEY` dans ce store : ce serait
écraser la clé de Golf Tracker. Les deux apps ont volontairement des clés
Gemini distinctes, issues de projets Google Cloud différents, pour ne pas
partager le quota gratuit ni la révocation.

Le `binding` reste `GEMINI_API_KEY` des deux côtés : c'est le nom de la variable
lue par le Worker (`env.GEMINI_API_KEY`), pas celui du secret.

### Recréer la clé (rotation, ou nouvelle machine)

Deux fois, car wrangler agit en local par défaut. La seconde n'est utile que
pour `npm run dev:worker`, et doit être lancée **depuis ce répertoire** (la
persistance locale est relative au dossier courant) :

```bash
npx wrangler secrets-store secret create 672323dbb30e4e80a1ff5c7226e05f22 --name GEMINI_API_KEY_ANGLAIS --scopes workers --remote
```

```bash
npx wrangler secrets-store secret create 672323dbb30e4e80a1ff5c7226e05f22 --name GEMINI_API_KEY_ANGLAIS --scopes workers
```

### 2. Premier déploiement

```bash
npm run deploy
```

L'app est alors en ligne mais **volontairement inerte** : `ACCESS_AUD` vaut
encore son placeholder dans `wrangler.toml`, donc toutes les routes `/api/*`
répondent 401. C'est l'ordre voulu — il faut une URL déployée pour créer
l'application Access, et l'AUD n'existe qu'une fois celle-ci créée.

### 3. Protéger l'URL avec Cloudflare Access — obligatoire

Sans cette étape, l'URL `*.workers.dev` est publique : n'importe qui la
découvrant peut consommer le quota Gemini du compte. L'app n'a aucune
authentification applicative (mono-utilisatrice), Access est donc la seule
barrière.

Dans le dashboard Cloudflare → **Zero Trust → Access → Applications** :

1. **Add an application** → _Self-hosted_
2. Domaine : celui du Worker déployé (`coach-anglais.<sous-domaine>.workers.dev`)
3. Policy : _Allow_, règle **Emails** → l'adresse email de l'utilisatrice
4. Ajouter une seconde règle _Allow_ avec l'email de l'administrateur, sinon tu
   seras toi-même bloqué hors de ton app

### 4. Reporter l'AUD puis redéployer

L'application créée expose un **Application Audience (AUD) Tag** — une chaîne
hexadécimale, dans _Overview_ de l'application Access. Le reporter dans le bloc
`[vars]` de `wrangler.toml` à la place de `<A_RENSEIGNER>`, puis :

```bash
npm run deploy
```

Le Worker ne se contente pas de faire confiance à Access : `worker/access.js`
vérifie cryptographiquement le jeton `Cf-Access-Jwt-Assertion` sur chaque appel
`/api/*` — signature RS256 contre le JWKS du locataire, plus contrôle de
l'audience, de l'émetteur et de l'expiration. C'est une défense en profondeur :
si Access était un jour désactivé par erreur, le quota Gemini resterait fermé.
L'en-tête `Cf-Access-Authenticated-User-Email` n'est jamais utilisé seul, il est
trivial à forger.

Le développement local n'est pas affecté : sur `localhost`, la vérification est
court-circuitée (`isLocalDev` dans `worker/index.js`).

`public/_headers` pose par ailleurs `X-Robots-Tag: noindex, nofollow` sur toutes
les réponses. Attention si tu touches à ce point : poser cet en-tête depuis le
code du Worker serait **sans effet**, car `run_worker_first` ne cible que
`/api/*` — les assets ne passent jamais par le Worker.

### 5. Alerte de facturation

Le budget cible est de 0 € (tiers gratuits Gemini + Cloudflare). Configurer une
alerte de facturation côté Google Cloud dès la création de la clé Gemini.

## La boucle pédagogique

Le périmètre V1 est couvert, et les quatre modules se nourrissent les uns les
autres — c'est là que réside la valeur de l'ensemble, plus que dans chaque écran
pris isolément :

1. le **test de niveau** détecte les lacunes et ordonne la file de révision ;
2. le **dialogue** confirme lesquelles bloquent vraiment, en situation, et
   compte les erreurs qui reviennent ;
3. la **grammaire** génère des exercices à partir de ses propres phrases
   fautives, et sort un point de la file au-delà de 80 % de réussite ;
4. le **vocabulaire** révisé est réinjecté dans les dialogues, pour être
   rencontré en contexte plutôt que récité.

Les deux boucles de retour comptent autant que le sens direct : une faute sur un
point acquis le remet dans la file, et un terme qu'elle ne retrouve plus
redevient à revoir.

## Hors périmètre V1

Pratique orale (voix), comptes multiples, correction humaine, application native
en store, vocabulaire au-delà des deux sous-domaines prioritaires.
