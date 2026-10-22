# Diseño · RITMO PÁDEL

## Dirección creativa

Inspiración del video: canchas nocturnas iluminadas, lenguaje energético y una experiencia de reserva sencilla. Identidad original RITMO, sin reutilizar marcas ni imágenes de otras empresas.

- Estética: deportivo-premium, vibrante, limpio, editorial.
- Tipos: `Space Grotesk` para titulares/estadísticas, `DM Sans` para UI/cuerpo; fallbacks de sistema.
- Paleta: bosque `#07130F`, bosque 2 `#0C2016`, lima `#CBFB57`, marfil `#F3F5EE`, tinta `#10211A`.
- Hero: ilustración SVG original con cancha isométrica, iluminación, líneas de cancha y sombra. Sin peso de WebGL.
- Dos contextos: **marketing oscuro** y **producto claro**, unidos por la misma tipografía, acento lima y detalles editorializados.
- Componentes: botones primarios, chips de fecha y de horario, tarjetas seleccionables, panel de resumen, estados y panel de operación.
- Accesibilidad: foco visible, botones nativos, ARIA cuando necesario, contraste alto, `prefers-reduced-motion`.

## Social preview

Portada original en `apps/web/public/og-cover.png` — 1200 × 630. La API servidora inyecta la URL absoluta en `og:image` y `og:url` con `PUBLIC_ORIGIN`. Cada nuevo despliegue debe verificarse compartiendo su URL.

## Investigación y herramientas

Referencias de trabajo de videos anteriores: evaluar MCP para bibliotecas de UI (21st), Chrome DevTools para inspección y depuración, y Reddit para entender problemas reales. Ninguna herramienta se requiere para ejecutar el proyecto.
