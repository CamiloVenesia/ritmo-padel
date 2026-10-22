# RITMO PÁDEL

**El juego se vive en serio.** Un sistema de reservas para un club ficticio de pádel premium en Rosario, Argentina. Marca original, frontend responsive, motor real de disponibilidad, usuarios y panel de administración.

> Este repositorio es un **proyecto de portfolio**. El club, las canchas, los precios y los usuarios demo son ficticios. No se cobran pagos ni se envían notificaciones reales.

## Lo que incluye

| Módulo | Funcionalidad |
|---|---|
| Marketing | Landing editorial con cancha isométrica original, CTA y tarjetas de las 4 canchas |
| Reservas | Elegir día, cancha y horario con precios pico/valle, resumen y confirmación |
| Jugadores | Registro/login, cookies seguras, listado de reservas y cancelación |
| Administración | KPIs, historial reciente, bloqueos por mantenimiento y bloqueo de dobles reservas |
| Seguridad | Validación Zod, SQL parametrizado, GiST exclusion, roles desde DB, rate limits, CSP y manejo de errores |
| Portfolio/SEO | Open Graph, imagen social 1200 × 630, favicon, responsive, accesibilidad |
| DX | npm workspaces, TypeScript, migraciones, Docker Compose para Postgres, tests de funciones |

## Stack

- **Web:** React 19, TypeScript, Vite, React Router, TanStack Query, Lucide y CSS personalizado.
- **API:** Node 20+, Express 4, TypeScript, Zod, JOSE (JWT), bcryptjs, Pino.
- **Datos:** PostgreSQL 17 + `EXCLUDE USING gist` para evitar solapamientos reales.
- **Monorepo:** npm workspaces (`apps/web`, `apps/api`).

## 1. Mirar el diseño rápidamente — sin DB

Requisitos: **Node.js 22 o superior recomendado**, npm y conexión a internet durante la instalación.

```bash
npm install
npm run dev:demo
```

Abrir **http://localhost:5173**. Por defecto, `VITE_DATA_MODE=demo` y la interfaz funciona **sin backend**. En `/acceso` elegí **Entrar como jugador** o **Ver panel admin**. Las reservas demo se guardan en el navegador y no bloquean simultaneidad entre usuarios reales. No hay cobros.

> El primer `npm install` creará `package-lock.json`. Revisalo y subilo a GitHub para tener instalaciones reproducibles.

## 2. Ejecutar el backend real con PostgreSQL

Desde la carpeta raíz:

```bash
# Copiar .env.example a .env; en Windows: Copy-Item .env.example .env
# Generar un SESSION_SECRET aleatorio, al menos 32 caracteres.
docker compose up -d
npm run db:migrate
npm run db:seed
```

Editá `.env`: `VITE_DATA_MODE=live`, `DATABASE_URL=postgres://ritmo:ritmo_local_dev@localhost:5432/ritmo_padel`, `PUBLIC_ORIGIN=http://localhost:5173`, `SESSION_SECRET` seguro (32+ caracteres).

```bash
npm run dev
```

Frontend en `http://localhost:5173` y API en `http://localhost:4000/api/health`. Vite hace proxy de `/api` al backend en desarrollo, por lo que las cookies funcionan en el mismo origen.

**Cuentas locales precargadas por `db:seed` (no disponibles en producción):**

- Jugador: `jugador@ritmopadel.test` / `DemoClub2026!`
- Administrador: `admin@ritmopadel.test` / `DemoClub2026!`

El seed no crea estas cuentas si `NODE_ENV=production`.

## 3. Tests y calidad

```bash
npm run typecheck
npm test
npm run build
npm audit
```

La validación de tipos, tests y compilación requieren instalar dependencias. No debe publicarse un cambio si alguno falla.

**Pruebas de integración real**: creá una base aislada `ritmo_test` en PostgreSQL (`docker exec -it <nombre_contenedor> createdb -U ritmo ritmo_test`). Luego ejecutá `npm run test:integration`. Incluye dos altas simultáneas del mismo horario (solo debe aceptar una), permisos y revocación de sesiones. **Nunca apuntes los tests a una BD de producción**.

## 4. Despliegue de un solo servicio (Render + Postgres administrado)

El frontend compilado se sirve desde Express con la misma URL del backend. No se necesitan cookies cross-site ni una configuración de CORS compleja.

1. Subí el monorepo a **tu propio repositorio** de GitHub.
2. Contratá o conectá un **PostgreSQL persistente** (Render, Neon u otro proveedor con backups). Creá una conexión `DATABASE_URL` privada, con SSL según instrucciones del proveedor. No guardes el string real en GitHub.
3. Render → **New → Blueprint** → seleccioná el repositorio; `render.yaml` configura el web service. Antes de desplegar, completá `DATABASE_URL`, `SESSION_SECRET` aleatorio de 32+ caracteres y `PUBLIC_ORIGIN` igual a la URL HTTPS pública final, sin barra final.
4. `NODE_ENV=production` y `VITE_DATA_MODE=live` vienen del Blueprint. El servidor ejecuta migraciones idempotentes al iniciar. El healthcheck es `/api/health`.
5. Después de desplegar, insertá las canchas: ejecutá `npm run db:seed` en un entorno con acceso a la base y **las mismas variables de producción**. El seed usa `ON CONFLICT DO NOTHING` y no genera usuarios demo en producción.
6. Generá el primer admin usando el script protegido por variables de entorno (`ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` de 14+ caracteres) y `npm run db:create-admin`. **Nunca pegues estas claves en el chat, commits, capturas o logs.** Eliminá `ADMIN_PASSWORD` del entorno al terminar.
7. Probá cuenta real, disponibilidad, un booking, una cancelación y acceso administrativo; verificá Open Graph en redes con la URL definitiva.

### Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Obligatoria para API. Conexión segura al PostgreSQL persistente |
| `SESSION_SECRET` | Obligatoria. Secreto aleatorio de 32+ caracteres |
| `PUBLIC_ORIGIN` | URL exacta del frontend público. Se usa para Origin, OG y canonical |
| `NODE_ENV` | `development` o `production` |
| `VITE_DATA_MODE` | `demo` (solo interfaz) o `live` (API real); se fija en build |
| `CLUB_TIMEZONE` | Por defecto `America/Argentina/Buenos_Aires` |
| `PORT` | Render lo establece automáticamente |

**No desplegar `VITE_DATA_MODE=demo` si se anuncian reservas reales.** En demo las confirmaciones son simuladas y lo indica la interfaz.

### Endpoints principales

| Método | URL | Rol |
|---|---|---|
| GET | `/api/health` | Público |
| GET | `/api/public/courts` | Público |
| GET | `/api/public/availability?date=YYYY-MM-DD` | Público |
| POST | `/api/auth/register`, `/api/auth/login` | Público con rate limit |
| GET | `/api/auth/me` | Sesión actual |
| POST | `/api/auth/logout` | Público |
| POST | `/api/bookings` | Jugador/admin autenticado |
| GET | `/api/bookings/me` | Dueño de cuenta |
| PATCH | `/api/bookings/:id/cancel` | Dueño de reserva |
| GET | `/api/admin/overview` | Admin |
| PATCH | `/api/admin/courts/:id` | Admin |
| POST/DELETE | `/api/admin/blocks[/:id]` | Admin |

## Seguridad y alcance real

Lee [`docs/SECURITY-CHECKLIST.md`](docs/SECURITY-CHECKLIST.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md).

El proyecto incorpora las prácticas de los reels compartidos: herramientas de desarrollo asistido cuando aportan valor, imagen social/Open Graph, error boundaries, protección de claves, estados de red, observabilidad, formularios sólidos y accesos por rol. **Antes de ofrecer un servicio comercial real** faltan validación de email, recuperación de contraseña, monitoreo externo, política de protección de datos, backups verificados y pruebas de concurrencia end-to-end.

## Licencia

Código original creado como base editable para tu portfolio; antes de hacerlo público definí y añadí la licencia de distribución que prefieras. La identidad RITMO y los datos del club son ilustrativos.
