# Scan Rimonim LiDAR (app nativa iOS)

App nativa (SwiftUI + ARKit) sobre el Supabase `Scan-Rimonim`.

- Captura con LiDAR a ~20 cm (protocolo `lidar-front-20cm-v2`), disparo automático cuando la distancia está estable.
- Segmentación de la granada con Vision (`VNGenerateForegroundInstanceMaskRequest`) + filtro por profundidad.
- Color medido en CIELAB sobre la cáscara (`Capture/ColorAnalyzer.swift`, umbrales ajustables).
- El calibre lo calcula Supabase (trigger `fotos_medir_calibre`, método `lidar-silueta-v1`).
- Requiere iPhone/iPad con LiDAR, iOS 17+.

## Compilar
GitHub Actions (`.github/workflows/ios.yml`) compila en cada push a `claude/ios-app`.
Para subir a TestFlight: commit con `[testflight]` en el mensaje (o "Run workflow"), con estos secrets cargados:
`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (contenido del .p8), `APPLE_TEAM_ID`.

Local: `brew install xcodegen && cd ios && xcodegen generate && open ScanRimonim.xcodeproj`.

