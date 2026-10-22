# Calidad y seguridad · Checklist previo a producción

Inspirado en las **seis prácticas del reel compartido por el usuario**.

- [x] **Error boundaries:** error global de React con botón de recuperación.
- [x] **API keys expuestas:** credenciales solo mediante variables de entorno; sin secretos en frontend; `.env` ignorado por Git.
- [x] **Cargas infinitas:** consultas React Query con error, vacío, recuperación y botones deshabilitados durante envíos.
- [x] **Observabilidad:** Pino HTTP, logs estructurados, errores del servidor sin trazas sensibles para clientes, `/api/health`.
- [x] **Formularios frágiles:** validación Zod del lado del servidor, restricción de tipos en frontend, prevención de doble envío, error 409 explícito.
- [x] **Acceso a datos:** sesión/rol/propiedad validada en backend y Postgres, bloqueos administrativos solo `admin`.

Otras verificaciones:

- [x] Exclusión de reservas solapadas a nivel de base de datos.
- [x] Rate limiting de autenticación y global, `helmet`, CSP.
- [x] Contraseñas bcrypt, cookies seguras `HttpOnly`, protección por origen.
- [x] UI responsive y `prefers-reduced-motion`, navegación por teclado y foco visible.
- [x] Social preview 1200 × 630 + etiquetas Open Graph y `og:url` absoluto en modo real.
- [ ] Ejecutar `npm install`, `npm run check`, `npm audit` en un entorno con acceso al registro npm.
- [x] Prueba de concurrencia escrita con PostgreSQL real (ejecutar `npm run test:integration`).
- [ ] Ejecutar dicha prueba en la base temporal `ritmo_test` y revisar el resultado.
- [ ] Añadir validación de correo y recuperación de contraseña antes de uso comercial.
- [ ] Configurar almacenamiento/retención y protección de datos según la operación real.
- [ ] Configurar monitorización externa, alertas, copias de seguridad y política de incidentes.
- [ ] Validar en móviles físicos y contrastes finales con lector de pantalla.
- [ ] Verificar favicon, títulos y vista previa en WhatsApp, LinkedIn, X con URL final.
- [ ] Confirmar configuración TLS, CORS/origen, secretos fuertes y cuenta admin inicial sin contraseñas de demo.

**No confundir MVP de portfolio con sistema auditado de seguridad o apto para procesar pagos reales.**
