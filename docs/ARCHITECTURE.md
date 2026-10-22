# Arquitectura · RITMO PÁDEL

## Decisiones de producto

- **Un solo club ficticio**, cuatro canchas: evita un marketplace incompleto y deja la experiencia enfocada.
- **Reserva de 90 minutos** con inicio cada 30 minutos; lunes a domingo de 08:00 a 23:00, zona horaria `America/Argentina/Buenos_Aires`.
- **Dos modos claramente diferenciados**: demo local de interfaz, y modo real conectado a PostgreSQL.
- **Sin pagos integrados**: se informan precios de reserva, pero no se cobran tarjetas ni se emiten facturas.
- **Cancelación hasta dos horas antes** del comienzo.
- **Ventana de reserva de 15 días** contando el día actual.
- No se simulan correos ni WhatsApp: esos canales requieren integraciones reales.

## Monorepo

```text
apps/api/src/
  lib/       config, pool de PostgreSQL, manejo de errores y logs
  db/        esquema SQL, migrador idempotente, seed y creación segura de administrador
  modules/   auth, courts/availability, bookings, admin, slots
  app.ts     middleware HTTP, CSP, límites, rutas y estáticos
  server.ts  inicio, migraciones, cierre limpio
apps/web/src/
  components/ header, arte vectorial propio, error boundary
  lib/        cliente REST, adaptador demo, tipos, formatos
  pages/      home, reservar, acceso, mis reservas, admin
  styles/     diseño responsive y accesibilidad
```

## Seguridad y consistencia

- Los **conflictos de reservas se impiden en PostgreSQL** usando `EXCLUDE USING gist (court_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)` para las reservas confirmadas. Esto protege frente a dos solicitudes simultáneas aunque ambas vean inicialmente el mismo horario libre.
- Un `SELECT ... FOR UPDATE` en la cancha serializa reservas nuevas y bloqueos administrativos para evitar una carrera entre mantenimiento y reserva.
- Cookies de sesión `HttpOnly`, `SameSite=Lax`, `Secure` en producción, JWT HS256 con `jti` y hash almacenado en `app_sessions` para **revocación real en logout**. En cada petición se consulta sesión, usuario, actividad y rol en DB (nunca se confía en el rol antiguo del JWT).
- Verificación `Origin` en métodos mutantes y mismo origen frontend/backend en producción. Los clientes nativos sin Origin necesitan un contrato independiente; no se contemplan en el MVP.
- Validación Zod, sentencias SQL parametrizadas, límite de cuerpo, Helmet/CSP, rate limits, logs estructurados Pino con redacción de cabeceras sensibles.
- Errores esperados con mensajes útiles, 409 para conflictos, 401/403 para sesión y permisos.
- Los scripts demo tienen una cuenta ficticia sin datos reales y no se ejecutan automáticamente en producción.
- Error Boundary y estados de carga, error, vacío, recuperación y movimiento reducido.

## Camino HTTP (modo real)

```text
React (same origin) → Express /api → Zod + cookies → PostgreSQL
                      └─ /, /reservar, ...: build estático Vite
```

## Limitaciones conscientes del MVP

- Sin confirmación de correo ni recuperación de contraseña: para un club real hay que incorporarlas.
- Sin pasarela de pagos, facturación fiscal o notificaciones externas.
- Las estadísticas son operativas, no contables.
- Sin capacidad de multiclub, alquiler por duraciones variables o tarifas por feriado.
- Sin sincronización en tiempo real por WebSocket: se actualiza la disponibilidad cada 30 segundos y siempre se confirma contra DB.
- Las altas demo en `localStorage` no son transaccionales entre distintos navegadores; **solo PostgreSQL en modo live** garantiza la exclusión de simultáneos.

## Extensiones futuras

- Tarifas flexibles por fecha/feriado, packs recurrentes y vouchers.
- Lista de espera, notificaciones por correo con consentimiento.
- Reglas de devolución y cancelaciones complejas.
- Métricas y filtros por períodos, eventos y ligas.
- Monitorización externa y Sentry (optativo); pipeline CI con base PostgreSQL de pruebas.
