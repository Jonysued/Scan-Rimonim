/// <reference types="vite/client" />
interface Window {
  scanOfflineAvailable?: boolean;
  ReactNativeWebView?: {postMessage(message: string): void};
  scanDepthResult?: (result: {error?: string; base64?: string; depthCapture?: Record<string, unknown>}) => void;
}
