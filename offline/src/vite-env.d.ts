/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Gemini API key (OpenAI-compatible endpoint). Ships in the bundle. */
  readonly VITE_GEMINI_API_KEY?: string;
  /** Gemini model id (default: gemini-2.5-flash). */
  readonly VITE_GEMINI_MODEL?: string;
  /** OpenAI-compatible base URL (default: Gemini's openai endpoint). */
  readonly VITE_GEMINI_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
