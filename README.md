# Scan-Rimonim

Aplicación independiente para registrar muestreos de granadas. React/Vite, Supabase Auth/Postgres/Storage y funciones HTTP en Vercel. No usa SDK, backend ni autenticación de Base44.

## Preparación

1. Crear un proyecto Supabase dedicado. Ejecutar `database/schema.sql` una sola vez en una base nueva.
2. Copiar `.env.example` a `.env.local`. Completar las dos variables públicas `VITE_SUPABASE_*`; las claves de servicio y OpenAI son exclusivas del servidor.
3. En Supabase Auth configurar la URL HTTPS publicada y permitir `/login` y `/reset-password` como redirecciones. Configurar SMTP para enviar confirmaciones, invitaciones y recuperación.
4. Registrarse y confirmar el correo. Promover únicamente la cuenta del propietario desde SQL: `update public.profiles set role = 'admin' where id = '<UUID_VERIFICADO>';`. Las siguientes cuentas empiezan pendientes y se habilitan desde Configuración.
5. `npm ci`, `npm run dev` para la interfaz. Las rutas `/api` requieren Vercel (`vercel dev` con las variables de servidor) para el análisis y administración de usuarios.
6. Publicar en Vercel con el directorio raíz del repositorio y las variables de `.env.example`. Nunca poner claves privadas en variables `VITE_*`.

## Flujo

Configuración contiene variedades, fincas y lotes. Nuevo muestreo exige elegir un lote antes de capturar. Una sesión conserva ese contexto. Las fotos usan un bucket privado y enlaces temporales; una foto fallida puede reintentarse o descartarse antes de finalizar. El análisis visual estima color y defectos, y devuelve como máximo una fruta central; requiere revisión humana.

La web mantiene el botón Tomar foto, sin círculo ni bloqueo por detección. Pide una fruta completa y enfocada. No calcula distancia física. OpenAI analiza la foto después de guardarla; la clave OPENAI_API_KEY se configura sólo en el servidor. Si el análisis falla, la foto se conserva y puede reintentarse desde el muestreo.

`mobile/` está conectado a https://scan-rimonim.vercel.app. Detecta soporte LiDAR trasero y captura foto, profundidad e intrínsecos del mismo ARFrame. En equipos sin LiDAR conserva la foto trasera sin escala. La estimación del diámetro es experimental, supone un cuerpo esférico y necesita comparación con calibre físico en un iPhone Pro real. No funciona en Expo Go. Ver `mobile/README.md`.

No se informa calibre en milímetros sin una escala y geometría validadas. Los valores ausentes se excluyen de promedios, gráficos y alertas de calibre.

## Verificación y pendientes de publicación

`npm run build`, `npm run lint`, `npm run test`. El verificador JS heredado (`npm run typecheck`) tiene errores de tipos en componentes UI y debe completarse antes de considerarlo una comprobación válida.

La migración de código no copia usuarios ni datos del servicio anterior. Antes de cambiar producción, desconectar la sincronización de GitHub desde el servicio anterior, configurar el nuevo backend, probar registro/recuperación, permisos, catálogos, cámara y muestreo completo. Este árbol por sí solo no revoca conexiones externas ni publica una app en TestFlight.
