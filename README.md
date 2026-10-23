# Territory Desk

A browser-local sales territory CRM for SAP account work. React, Vite, TypeScript, ExcelJS, and PGlite run as a static website with no backend server.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. PGlite stores data in that browser's IndexedDB database.

## Production build

```bash
npm run build
npm start
```

The static production preview runs at `http://localhost:4100`.

## GitHub Pages

Push to `main`. The `Deploy GitHub Pages` workflow builds `dist/` and publishes it automatically. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions** if it is not already selected.

## Privacy and sharing

No CRM records or imported workbooks are included in the deployed files. Excel files are parsed inside the browser, and records remain in that browser's IndexedDB storage. Different visitors do not share data or edits. Clearing site data removes that browser's CRM database.

## Import behavior

Drop one or more `.xlsx` files on the Import page. Territory Desk recognizes merged lists, tracker files, DIT profiling workbooks, Blitz lists, and common account/contact exports. Accounts are matched by CRM ID first and normalized account name second. Notes are appended without repeating identical text, contacts are deduplicated, and category upgrades never reduce an account's priority.
