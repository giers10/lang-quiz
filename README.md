# IG Japanese Quizzer

A full-stack web app for drilling Japanese grammar, vocabulary, and phrases from locally stored Instagram posts. The server indexes every `*.mp4` + matching `*.json` pair under `data/` and exposes them to a React/Vite frontend with a quiz wizard.

## Quick start

1. Install dependencies (root workspace):
   ```bash
   npm install
   ```
2. Run both servers (frontend on 5173, backend on 5174):
   ```bash
   npm run dev
   ```
   - Vite proxies `/api` and `/data` to the Express server, so the client can use relative URLs.
3. Open the app at http://localhost:5173.

### Scripts
- `npm run dev` – concurrently runs `server` (Express + ts-node-dev) and `client` (Vite dev server).
- `npm run build` – builds the server TypeScript and Vite client.
- `npm run dev --workspace server` / `npm run dev --workspace client` – run either side individually.

## Data layout

Files live under `data/` (scanned recursively):
```
data/<POST_ID>/<FILENAME>.mp4
\_ <FILENAME>.json   # quiz payload for that video
```
- Base filenames must match. Extra sidecars (`.raw.txt`, `.mp4.json`, images) are ignored.
- The JSON structure is tolerant but expects keys: `meta`, `items`, `quiz`, `ui_hints` (additional fields are ignored).
- `entry_id` is the path from `data/` to the mp4 **without** the `.mp4` extension (e.g., `C1abc/12345`). It is URL-encoded in routes/query params.
- Videos are served statically at `/data/...` by the backend by default; JSON is only accessible through the API.
- To host media elsewhere (e.g., a CDN), set `MEDIA_BASE_URL` to the base URL of your `data` directory (e.g., `https://www.victorgiers.com/japanischvideos/data`). Video links will point there; JSON files still need to be present locally for scanning.

## API
- `GET /api/entries` → list of entries `{ id, title, mode, type, counts, video_url }`, sorted by title.
- `GET /api/entry?id=<entry_id>` → full entry JSON plus derived fields `{ id, title, video_url, counts }`.

## Frontend features
- Overview grid of all entries with counts and metadata.
- Entry detail page with embedded video and learning panels.
- Quiz Wizard with three modes:
  - All entries (random 10 questions)
  - Selected entries (checkbox picker)
  - Single entry (linked from detail page)
- Quiz types: cloze input, multiple-choice variants, match pairs, and best reply. Wrong answers reveal explanations and the source video.

## Notes
- The server prevents path traversal by validating resolved paths against the data root and only serving scanned entries.
- Update or add new posts by dropping files into `data/` and restarting the server to rescan.
