# Fix Warnings and Errors in `server.ts` and `api/diagnostic-path.ts`

The current project has several minor warnings and potential runtime errors related to unused imports, incorrect model names for Gemini AI, and fragile JSON parsing of AI responses.

## Proposed Changes

### [Server]

#### [MODIFY] [server.ts](file:///C:/Users/cheyo/OneDrive/Documents/GitHub/displaycellproshub002/server.ts)
- Remove unused `ThinkingLevel` import from `@google/genai`.
- Update `gemini-2.5-flash` model name to `gemini-1.5-flash` for better compatibility and stability.
- Add a helper function or logic to strip markdown code blocks from AI responses before calling `JSON.parse()`.
- Fix redundant destructuring defaults that already exist in the Zod schema.

#### [MODIFY] [api/diagnostic-path.ts](file:///C:/Users/cheyo/OneDrive/Documents/GitHub/displaycellproshub002/api/diagnostic-path.ts)
- Update `gemini-2.5-flash` model name to `gemini-1.5-flash`.
- Add markdown code block stripping for robust JSON parsing.

## Verification Plan

### Automated Tests
- Run `npm run lint` (if possible, otherwise manual inspection) to verify no unused imports remain.
- Verify the Gemini API calls with the updated model name (requires valid `GEMINI_API_KEY`).

### Manual Verification
- Inspect the modified files for cleanliness and adherence to TypeScript best practices.
