# D&CP Spokane Lab - Agent Documentation

Welcome, coding agent! This project is a high-performance mobile hardware repair laboratory platform for **D&CP LLC**.

## Project Context
- **Business**: D&CP (Display & Cell Pros) provides Tier 1-3 repairs (Screens, Batteries, and Micro-soldering/Board Rework).
- **Location**: 115 S Adams St, Spokane, WA.
- **Compliance**: WA RCW 19.415 (Data Privacy).

## Tech Stack
- **Frontend**: React 19 + Vite + Tailwind CSS (Vite plugin).
- **Backend**: Express.js (Node.js) + TypeScript (`tsx` for dev).
- **Serverless**: Vercel Functions (located in `api/`).
- **Database**: AWS Aurora PostgreSQL with Vercel Connect.
- **AI**: Google Gemini 1.5 Flash via `@google/genai` and Vercel AI SDK.

## Key Directories
- `/src/components`: UI components (M3 design system inspiration).
- `/src/lib`: Core logic, database utilities, and AI services.
- `/src/lib/aiService.ts`: Centralized AI logic using Vercel AI Gateway.
- `/src/lib/schemas.ts`: Zod schemas for all API payloads and AI responses.
- `/api`: Vercel serverless functions.
- `/server.ts`: Monolithic Express server for local development and non-serverless routes.

## AI Implementation Guidelines
- **Centralization**: All AI calls must go through `src/lib/aiService.ts`.
- **Validation**: Use Zod schemas from `src/lib/schemas.ts` for parsing AI responses.
- **Gateway**: All calls should be configured to route through Vercel AI Gateway for observability.
- **Fallback**: Always provide a rule-based fallback if the AI service fails or times out.

## Database Guidelines
- **Read/Write Splitting**: Use `queryReadOnly` for SELECT operations and `query` for mutations.
- **Connection Management**: Utilize the connection pooling configured in `src/lib/db.ts`.

## Deployment
- Deployed on **Vercel**.
- Monitoring via **Vercel Analytics** and **Speed Insights**.
