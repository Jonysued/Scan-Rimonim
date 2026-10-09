# Captura con cámara trasera en iPhone

App nativa Expo con módulo Swift local. No funciona en Expo Go ni desde Safari.

En equipos compatibles con `ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)`, la captura usa ARKit con cámara trasera y LiDAR. Exporta una foto JPEG y el mapa de profundidad/confianza del mismo ARFrame. Ambos se rotan a vertical; los intrínsecos se escalan al mapa y se rotan con él. La vista previa puede recortar la imagen, pero el análisis siempre usa el JPEG completo. No exporta GPS ni pose mundial. En equipos sin LiDAR mantiene la cámara trasera fotográfica sin estimación métrica.

El contorno delimita una nube de puntos interior con confianza alta. Un ajuste esférico entrega un diámetro **experimental** solamente si supera controles de cobertura, distancia, resolución, residuo y concordancia con el contorno. Se guarda en `fruits[].lidar_estimate`, separado de `diameter_mm` y de los promedios de calibre validado. No afirma precisión milimétrica ni representa el diámetro real de frutos irregulares. La validación física sigue pendiente.

Probar en iPhone Pro con LiDAR: una granada inmóvil de frente a 30–70 cm; comparar varios frutos con calibre físico, repetir desde distintas distancias, comprobar giro/orientación, sombra, baja luz, reflejos y fruta irregular. Verificar que no acepte profundidad plana/fondo como diámetro y que fotos de galería o teléfonos sin LiDAR sigan sin medición. Confirmar cancelación/interrupciones y reanálisis conservando metadatos. El simulador no valida LiDAR.

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

Texto para «Qué probar»: Ingreso y navegación; muestreo con una granada por foto; guardado y análisis de color y defectos con OpenAI; recuperación ante pérdida de conexión. Captura con cámara trasera principal, enfoque automático y botón Tomar foto. Sin calibre métrico validado. Muestreo offline disponible: descargar lotes con la cuenta habilitada antes de salir; guardar fotos y LiDAR en el teléfono; finalizar la muestra; reabrir con internet para sincronizar y analizar. No se analizan fotos offline. Probar modo avión, cierre completo y reapertura, corte durante sincronización y reintento sin duplicados.


## Modo sin conexión
La pantalla de muestreo y su catálogo se guardan nativamente, independientes de la web. Cada foto se copia a Documents/ScanOffline antes de confirmar; los manifiestos JSON se escriben atómicamente y quedan excluidos de backups. Se conserva la cuenta propietaria, la fecha de captura y los datos LiDAR. Los borradores se pueden continuar al reabrir. Las muestras finalizadas se sincronizan en primer plano con UUIDs estables, primero la sesión, luego una foto por vez, y por último sus totales. Un corte o un error de análisis mantiene la copia local. Sólo después de confirmar fotos analizadas y muestra finalizada se eliminan las copias locales. El servidor vuelve a comprobar Auth y RLS; el perfil cacheado no autoriza ninguna operación remota. Cerrar sesión elimina el catálogo, conserva la cola y exige reingresar con su cuenta propietaria.
