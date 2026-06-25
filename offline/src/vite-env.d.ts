/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Active AI provider for the offline app: "gemini" (default) | "alibaba" (Qwen). */
  readonly VITE_AI_PROVIDER?: "gemini" | "alibaba";
  /** Generic overrides — win for whichever provider is active. */
  readonly VITE_AI_API_KEY?: string;
  readonly VITE_AI_MODEL?: string;
  readonly VITE_AI_VISION_MODEL?: string;
  readonly VITE_AI_BASE_URL?: string;

  /** Google Gemini API key (OpenAI-compatible endpoint). Ships in the bundle. */
  readonly VITE_GEMINI_API_KEY?: string;
  /** Gemini model id (default: gemini-2.5-flash). */
  readonly VITE_GEMINI_MODEL?: string;
  /** Gemini vision model (defaults to VITE_GEMINI_MODEL — base model is multimodal). */
  readonly VITE_GEMINI_VISION_MODEL?: string;
  /** OpenAI-compatible base URL (default: Gemini's openai endpoint). */
  readonly VITE_GEMINI_BASE_URL?: string;

  /** Alibaba Cloud Model Studio (Qwen) API key. Ships in the bundle. */
  readonly VITE_ALIBABA_API_KEY?: string;
  /** Optional DashScope sub-workspace; sent as the X-DashScope-WorkspaceId header. */
  readonly VITE_ALIBABA_WORKSPACE_ID?: string;
  /** Qwen text model id (default: qwen-plus). */
  readonly VITE_ALIBABA_MODEL?: string;
  /** Qwen vision model id for image features (default: qwen-vl-plus). */
  readonly VITE_ALIBABA_VISION_MODEL?: string;
  /** OpenAI-compatible base URL (default: https://dashscope.aliyuncs.com/compatible-mode/v1). */
  readonly VITE_ALIBABA_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
