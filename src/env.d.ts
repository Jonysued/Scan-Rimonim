/// <reference types="vite/client" />
interface Window {
  ReactNativeWebView?: {postMessage(message: string): void};
  scanDepthResult?: (result: {error?: string; base64?: string; depthCapture?: Record<string, unknown>}) => void;
}
