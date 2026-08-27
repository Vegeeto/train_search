# FGC Real-Time Train Tracker

A modern, responsive web application providing real-time train schedules for the **Ferrocarrils de la Generalitat de Catalunya (FGC)** network. Built with React and powered by the FGC Open Data API.

## 🚀 Features

- **Multi-Network Support**: Seamlessly switch between Llobregat-Anoia, Barcelona-Vallès, and Lleida-La Pobla networks.
- **Dynamic Station Filtering**: Station lists automatically update based on the selected route network.
- **Real-Time Schedules**: Live arrival and departure information fetched directly from FGC's Open Data API.
- **Terminal Awareness**: Automatically handles terminal stations (Plaça Espanya, Pl. Catalunya, Lleida Pirineus) with smart direction filtering.
- **Advanced Filtering**: Filter by specific hours or train types (L8, S3, R5, etc.).
- **Favorites**: Save your most-used stations for quick access (stored locally).
- **Responsive Design**: Optimized for both desktop and mobile viewing with a clean, modern UI.
- **Reliable Fetching**: Built-in timeout and retry mechanisms for API calls to ensure a smooth experience.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Animations**: Motion (framer-motion)
- **Icons**: Lucide React
- **Data Source**: [FGC Open Data API](https://dadesobertes.fgc.cat/)

## 📦 Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

## 🚢 Deployment

This project is configured for automated deployment to GitHub Pages via GitHub Actions.

- **Automated**: Push to `main` branch to trigger the `.github/workflows/deploy.yml` workflow.
- **Manual**: Run `npm run deploy` to build and push to the `gh-pages` branch.

---

*Data provided by FGC Open Data API. This is an unofficial application.*
