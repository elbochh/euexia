# Euexia

Euexia is a mobile-first post-consultation support app that turns medical follow-up instructions into a gamified daily journey. Users upload consultation material, receive structured care tasks, progress through a map, and can ask follow-up questions through a contextual assistant.

## Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, PixiJS
- Backend: Node.js, Express, TypeScript, MongoDB Atlas
- AI: Google Vertex AI with Gemma 4
- Auth/data: JWT, MongoDB models, local vector-style context retrieval

## AI Architecture

All text, image, PDF, checklist, map-spec, and RAG chat generation now routes through Gemma 4 on Google Vertex AI.

The shared backend model layer lives in:

```text
backend/src/services/googleGemma.ts
```

Required environment variables:

```env
GOOGLE_CLOUD_PROJECT=project-f4cb911b-5b50-4b6e-9d6
GOOGLE_VERTEX_LOCATION=global
GOOGLE_VERTEX_MODEL=gemma-4-26b-a4b-it-maas
USE_MOCK_AGENTS=false
```

For local auth, run:

```bash
gcloud auth application-default login
gcloud config set project project-f4cb911b-5b50-4b6e-9d6
```

Voice upload transcription is currently disabled when mock mode is off. To re-enable voice uploads, add a Google Speech-to-Text path before summarizing the transcript with Gemma 4.

## Local Development

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Build

```bash
cd backend
npm run build

cd ../frontend
npm run build
```

## Notes

- Real secrets belong only in local `.env` files or Google Cloud runtime configuration.
- `.env`, `.env.local`, and `.secrets/` are ignored by git.
- Rotate any secrets that were pasted into chat or committed previously.
