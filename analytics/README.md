# API de analítica anónima

La web se publica como sitio estático en GitHub Pages, así que GitHub no puede ejecutar una API ni guardar registros. Esta API usa **Cloudflare Workers + D1** y solo guarda una visita si la persona acepta la medición.

## Datos y privacidad

Cada registro incluye únicamente un ID aleatorio del evento, fecha/hora UTC, ruta sin parámetros, categoría general del dispositivo y —si existe— solo el origen del sitio referente. **No se guardan nombres, correos, direcciones IP, identificadores persistentes ni la URL completa del referente.**

La dirección IP que Cloudflare recibe en la solicitud se usa temporalmente para limitar abusos; el Worker no la escribe en D1. Cloudflare puede procesar metadatos de red de acuerdo con sus políticas. Los registros se eliminan automáticamente después de 90 días. La persona puede rechazar o revocar el consentimiento desde el pie de página.

Esto permite consultar visitas anónimas, no identificar personas. Para asociar una visita con una persona se necesitarían cuentas o datos enviados voluntariamente, una finalidad definida y un aviso de privacidad separado.

## Desplegar la API

Requisitos: Node.js 20 o superior y una cuenta de Cloudflare con Workers y D1.

1. Entra a esta carpeta, instala Wrangler e inicia sesión:

   ```sh
   cd analytics
   npm install
   npx wrangler login
   ```

2. Crea la base D1:

   ```sh
   npm run db:create
   ```

   Copia el `database_id` de la salida y reemplaza `REPLACE_WITH_YOUR_D1_DATABASE_ID` en `wrangler.toml`. Si el namespace `1001` del limitador ya existe en tu cuenta, cambia también `namespace_id` por otro entero único.

3. Crea la tabla remota:

   ```sh
   npm run db:apply:remote
   ```

4. Genera un token administrativo aleatorio de al menos 32 caracteres y guárdalo como secreto de Cloudflare. No lo escribas en el HTML, JavaScript ni Git:

   ```sh
   npx wrangler secret put ADMIN_API_TOKEN
   ```

5. Revisa `ALLOWED_ORIGINS` en `wrangler.toml`. Debe contener el origen exacto donde se publica el sitio y el dashboard. El valor inicial incluye `https://magosystech.github.io` y los orígenes locales en el puerto `8000`; agrega cualquier dominio propio y quita los que no utilices.

6. Despliega:

   ```sh
   npm run deploy
   ```

   Wrangler mostrará la URL HTTPS del Worker, por ejemplo `https://magosys-analytics-api.<tu-subdominio>.workers.dev`.

7. Copia esa URL, sin una ruta final, en `content` de `<meta name="analytics-api-url">` tanto en `index.html` como en `admin/analytics.html` y publica los cambios en GitHub Pages. **Mientras el valor de `index.html` esté vacío, no se muestra el aviso ni se envía ninguna visita.** La página administrativa no permite introducir otro endpoint: así evita enviar el token a una URL equivocada.

8. Abre `https://magosystech.github.io/admin/analytics.html`, pega la URL del Worker y el token administrativo, selecciona el período y consulta los datos. El panel no guarda el token en el navegador.

## Rutas

| Método | Ruta | Acceso |
| --- | --- | --- |
| `GET` | `/health` | Estado de la API y D1 |
| `POST` | `/v1/visits` | Origen autorizado y consentimiento del visitante |
| `GET` | `/v1/admin/summary?days=30` | Token administrativo; entre 1 y 90 días |
| `GET` | `/v1/admin/visits?limit=100` | Token administrativo; entre 1 y 200 eventos |

El endpoint público acepta solamente `path`, `referrerOrigin` y `device`; rechaza campos adicionales y no recibe identificadores de persona. El límite inicial es de 60 solicitudes por minuto y dirección de red en el servicio de rate limiting de Cloudflare; la dirección no se almacena en la tabla de visitas.

## Comprobaciones

```sh
npm test
```

La prueba local del Worker con Wrangler requiere completar primero el ID de D1 y aplicar el esquema local:

```sh
npm run db:apply:local
npm run dev
```
