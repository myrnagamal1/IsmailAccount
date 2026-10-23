# Territory Desk

A local-first sales territory CRM for SAP account work. React, Vite, TypeScript, Express, and PGlite run entirely on your laptop.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. PGlite stores data under `data/pglite`.

## Production build

```bash
npm run build
npm start
```

The production server runs at `http://localhost:4100`.

## Import behavior

Drop one or more `.xlsx` files on the Import page. Territory Desk recognizes merged lists, tracker files, DIT profiling workbooks, Blitz lists, and common account/contact exports. Accounts are matched by CRM ID first and normalized account name second. Notes are appended without repeating identical text, contacts are deduplicated, and category upgrades never reduce an account's priority.
