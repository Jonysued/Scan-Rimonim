# Captura de distancia en iPhone
App nativa Expo con módulo Swift local. No funciona en Expo Go ni desde Safari.

La cámara frontal TrueDepth mide la **superficie central**, no identifica automáticamente la granada. El usuario debe centrar una sola fruta y orientar la pantalla hacia ella. La guía por voz permite acercarse/alejarse sin mirar la pantalla. La toma usa un cuadro de color sincronizado con profundidad absoluta; rechaza lecturas escasas, dispersas o inestables. Objetivo inicial de prueba: 37–43 cm, estabilidad mínima de 1 segundo. Este rango requiere ensayo de campo antes de uso operativo.

1. Configurar `expo.extra.webUrl` en app.json con el dominio HTTPS publicado.
2. `npm ci`, `npx expo prebuild --platform ios`, compilar con Xcode y firma Apple del usuario.
3. Probar en iPhone 17 real: permisos, cancelación, guía por voz, distancias conocidas (20/30/40/50/70 cm), pleno sol/sombra, hojas y fondo, pérdida de señal.
4. Distribuir por TestFlight después de completar las pruebas.

El módulo devuelve distancia y calidad junto a la foto; **no convierte esa lectura en calibre**. La captura conserva intrínsecos de profundidad y dimensiones de referencia cuando el dispositivo los entrega. Faltan validar su correspondencia geométrica con la foto, corregir distorsión y determinar el contorno y plano de medición del fruto. No sustituir lecturas inválidas por distancias asumidas.

## TestFlight

El perfil `production` de `eas.json` genera una aplicación de distribución App Store (la requerida por TestFlight), con número de compilación incremental. Bundle ID: `ar.com.rimonim.scan`. No incluir la clave de OpenAI: el análisis sigue ejecutándose en el servidor.

Desde esta carpeta:

1. `npm ci` y `npm run typecheck`.
2. `npx eas-cli@latest login` con la cuenta Expo del titular.
3. `npx eas-cli@latest init` para vincular este código a su proyecto Expo (guardará el projectId real).
4. `npm run build:ios`. Configurar la firma con la cuenta Apple Developer y confirmar el equipo y el bundle ID de Scan Rimonim.
5. `npm run submit:ios`. Seleccionar la compilación anterior y el registro correcto de Scan Rimonim en App Store Connect.
6. Esperar el procesamiento de Apple y agregar la compilación al grupo TestFlight.

No se comparte la firma ni los identificadores de Empaco o Lucient. La primera compilación debe probar ingreso, cámara manual, carga y análisis de fotos, navegación, cancelación, permiso de cámara rechazado y recuperación de conexión. La captura TrueDepth requiere un iPhone físico compatible; el simulador no valida su comportamiento.

Texto para «Qué probar»: Ingreso y navegación; muestreo con una granada por foto; guardado y análisis de color y defectos con OpenAI; recuperación ante pérdida de conexión. Captura frontal experimental para probar distancia central, sin calibre métrico validado. No se ofrece trabajo offline.
