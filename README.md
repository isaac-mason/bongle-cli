# bongle-cli

Deploy [bongle](https://github.com/isaac-mason/bongle) game bundles to the platform from CI or your terminal. Dependency-free, runs straight from a GitHub install. No build step, no npm registry.

## Install

Run it on demand with no install:

```sh
npx github:isaac-mason/bongle-cli deploy
```

Or install it globally:

```sh
npm i -g github:isaac-mason/bongle-cli
bongle-cli deploy
```

Requires Node 18+.

## Usage

```sh
bongle-cli deploy [--bundle dist/bundle.zip] [--api <url>] [--notes <str>] [--json]
```

Builds a `dist/bundle.zip` with `bongle build` first, then:

```sh
BONGLE_DEPLOY_TOKEN=mcd_xxx bongle-cli deploy
```

This uploads the bundle as a new **draft** version. Set it live from the game's Versions panel in the platform UI.

### Options

```
--bundle <path>   bundle to upload (default: dist/bundle.zip)
--api <url>       platform API base (default: $BONGLE_API_URL or https://api.bongle.io)
--notes <str>     notes attached to the version
--json            print the version row as JSON on success
```

### Environment

```
BONGLE_DEPLOY_TOKEN   required. Mint one in the game's "Deploy tokens" panel.
BONGLE_API_URL        optional. Overrides the default API base.
```

## Deploy tokens

A deploy token is scoped to a single game and is shown once when minted. Open your game in the platform, find the **Deploy tokens** panel, mint a token, and store it as a secret (e.g. a GitHub Actions secret named `BONGLE_DEPLOY_TOKEN`). Revoking your team membership revokes the token.

## In GitHub Actions

```yaml
- run: npm install
- run: npm run build
- env:
    BONGLE_DEPLOY_TOKEN: ${{ secrets.BONGLE_DEPLOY_TOKEN }}
  run: npx -y github:isaac-mason/bongle-cli deploy --bundle dist/bundle.zip
```
