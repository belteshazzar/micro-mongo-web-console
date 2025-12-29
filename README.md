# micro-mongo-web-console

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/belteshazzar/micro-mongo-web-console)

## Deploy to GitHub Pages

This app uses Vite. For a project site at https://belteshazzar.github.io/micro-mongo-web-console/, the Vite base is configured to `/micro-mongo-web-console/` in [vite.config.js](vite.config.js).

### One-time setup
- Enable GitHub Pages (Settings → Pages → Deploy from a branch → `gh-pages`).

### Automatic deploy via GitHub Actions (official Pages workflow)
Already added: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). On every push to `main`, it will:
- Install dependencies (`npm ci`)
- Build (`npm run build`)
- Upload `dist/` as a Pages artifact
- Deploy using `actions/deploy-pages`

Repository settings:
- Settings → Pages → set Source to "GitHub Actions"

After the workflow runs, your site will be live at:
- https://belteshazzar.github.io/micro-mongo-web-console/

### Manual build & publish (optional)
You can also deploy locally using the `gh-pages` CLI:

```bash
npm install --save-dev gh-pages
npm run build
npx gh-pages -d dist -b gh-pages
```

### Important: local file dependencies
This project references local packages in `package.json` using `file:` URLs:
- `micro-mongo`, `node-inspect-extracted`, `sval`

For CI builds to succeed, these packages must be available in the repository (e.g., subfolders) or replaced with published registry versions. If they are in a monorepo, ensure the directories are present when GitHub Actions checks out the code.