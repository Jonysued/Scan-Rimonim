# Captura con cámara trasera en iPhone

App nativa Expo con módulo Swift local. No funciona en Expo Go ni desde Safari.

La captura usa exclusivamente la cámara trasera principal, con enfoque y exposición automáticos, vista previa sin espejo y botón «Tomar foto». No requiere TrueDepth frontal. Devuelve una foto JPEG al mismo flujo web de guardado y análisis. No adjunta distancia, profundidad ni calibre métrico: esas mediciones necesitan una implementación trasera y validación física independiente.

Probar en un iPhone real: permiso de cámara permitido y rechazado, vista previa trasera, orientación vertical, enfoque cercano, cancelación, toma repetida, guardado y análisis, interrupción y recuperación de conexión.

## TestFlight

El perfil `production` de `eas.json` genera una aplicación de distribución App Store (la requerida por TestFlight), con número de compilación incremental. Bundle ID: `ar.com.rimonim.scan`. No incluir la clave de OpenAI: el análisis sigue ejecutándose en el servidor.

Desde esta carpeta:

1. `npm ci` y `npm run typecheck`.
2. `npx eas-cli@latest login` con la cuenta Expo del titular.
3. `npx eas-cli@latest init` para vincular este código a su proyecto Expo (guardará el projectId real).
4. `npm run build:ios`. Configurar la firma con la cuenta Apple Developer y confirmar el equipo y el bundle ID de Scan Rimonim.
5. `npm run submit:ios`. Seleccionar la compilación anterior y el registro correcto de Scan Rimonim en App Store Connect.
6. Esperar el procesamiento de Apple y agregar la compilación al grupo TestFlight.

No se comparte la firma ni los identificadores de Empaco o Lucient. La primera compilación debe probar ingreso, cámara manual, carga y análisis de fotos, navegación, cancelación, permiso de cámara rechazado y recuperación de conexión. El simulador no valida la cámara física.

Texto para «Qué probar»: Ingreso y navegación; muestreo con una granada por foto; guardado y análisis de color y defectos con OpenAI; recuperación ante pérdida de conexión. Captura con cámara trasera principal, enfoque automático y botón Tomar foto. Sin calibre métrico validado. No se ofrece trabajo offline.
