# Captura de distancia en iPhone
App nativa Expo con módulo Swift local. No funciona en Expo Go ni desde Safari.

La cámara frontal TrueDepth mide la **superficie central**, no identifica automáticamente la granada. El usuario debe centrar una sola fruta y orientar la pantalla hacia ella. La guía por voz permite acercarse/alejarse sin mirar la pantalla. La toma usa un cuadro de color sincronizado con profundidad absoluta; rechaza lecturas escasas, dispersas o inestables. Objetivo inicial de prueba: 37–43 cm, estabilidad mínima de 1 segundo. Este rango requiere ensayo de campo antes de uso operativo.

1. Configurar `expo.extra.webUrl` en app.json con el dominio HTTPS publicado.
2. `npm ci`, `npx expo prebuild --platform ios`, compilar con Xcode y firma Apple del usuario.
3. Probar en iPhone 17 real: permisos, cancelación, guía por voz, distancias conocidas (20/30/40/50/70 cm), pleno sol/sombra, hojas y fondo, pérdida de señal.
4. Distribuir por TestFlight después de completar las pruebas.

El módulo devuelve distancia y calidad junto a la foto; **no convierte esa lectura en calibre**. Faltan calibración geométrica, intrínsecos asociados a la foto y validación del contorno del fruto. No sustituir lecturas inválidas por distancias asumidas.
