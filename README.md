# FGC Real-Time Train Tracker

Real-time train schedules for FGC stations using Open Data API.

## Deployment to GitHub Pages

This project is configured for easy deployment to GitHub Pages.

### Automated Deployment (GitHub Actions)

A GitHub Actions workflow is included in `.github/workflows/deploy.yml`. 
Whenever you push to the `main` branch, it will automatically:
1. Build the project.
2. Deploy the `dist` folder to the `gh-pages` branch.

### Manual Deployment

If you want to deploy manually from your local machine:
1. Run `npm run deploy`.
2. This will build the project and push the `dist` folder to the `gh-pages` branch using the `gh-pages` package.

### Important Note on Vite Base Path

The `vite.config.ts` has been updated with `base: './'`. This ensures that all assets (JS, CSS, images) are loaded correctly regardless of whether the app is deployed to a subfolder (e.g., `https://username.github.io/repo-name/`) or a custom domain.
