/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" untuk build demo statis tanpa backend (hosting gratis). */
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
