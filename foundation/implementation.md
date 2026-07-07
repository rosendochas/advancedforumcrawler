# Tecnologías

La web de foros a la que nos vamos a conectar usa Simple Machines Forum (SMF):
https://www.simplemachines.org/

Para crear nuestro software vamos a usar las siguientes tecnologías:

- **Frontend**: HTML + CSS + JS vanilla (sin librerías ni frameworks). El Worker genera el HTML y sirve los assets estáticos.
- **Backend/runtime**: Cloudflare Workers (Runtime web estándar).
- `fetch` nativo de Workers para las peticiones HTTP al foro.
- Gestor de cookies: `Map` interno en la clase `ForumClient` (no se usa librería externa, se persiste como string en la cookie de sesión).
- Parser HTML: expresiones regulares (Regex) sobre el HTML plano. No se usa `HTMLRewriter`.

Considera además las siguientes cuestiones:

- Todos los datos de configuración tienen que estar en variables de entorno (`.dev.vars` para local, `wrangler.jsonc` para producción) que no se subirán al repo.
- Aunque el software tiene que estar pensado para correr en Cloudflare Workers, necesito poder probarlo también local mediante `wrangler dev`.

# Otros detalles 

## Gestión de la sesión en SMF

- Las **credenciales del foro no se persisten en ningún sitio**: la app las usa una única vez para hacer login contra el foro y las descarta inmediatamente después.
- Lo que sí se persiste es la **sesión resultante del foro**: las cookies que SMF devuelve en el login. Estas cookies se conservan asociadas a la sesión del usuario en nuestra aplicación, cifradas en una cookie AES-GCM llamada `session` con una clave derivada de `SESSION_SECRET` mediante SHA-256.
- En SMF no existe un *refresh token* explícito. La cookie de login emitida por el foro es de larga duración y, mientras siga vigente, el foro reconstruye automáticamente la sesión interna en cada petición. Por tanto, la única estrategia de refresco es **conservar y reenviar la cookie de login en cada llamada**.
- **Caducidad y relogin**: si al intentar una acción detectamos que la sesión del foro ya no es válida (el HTML de respuesta contiene la clase `guest` o el texto "Bienvenido, Invitado"), se descartan las cookies almacenadas y se redirige al usuario a la pantalla de LOGIN para que vuelva a introducir las credenciales. No se intenta ningún relogin silencioso porque las credenciales no están guardadas.
- No se contempla soporte para 2FA ni captcha: si la cuenta del usuario los tiene activados, el login fallará y se mostrará el error tal cual lo devuelva el foro.
- La cabecera de la pantalla CALENDARIO actúa como indicador permanente de sesión activa (ver detalles en esa página): muestra al usuario suplantado y el botón de **logout**, que invalida la sesión del foro y la de la app y vuelve a LOGIN.

## Configuración regional

- **Locale**: es-ES. Todos los formatos de fecha, hora y textos de la interfaz siguen la convención española.
- **Zona horaria**: GMT+1 (horario de Madrid). Se usa como referencia para los valores por defecto de los campos de hora y para la comparación de fechas pasadas. Dado que el Worker se ejecuta en UTC, la referencia horaria es la hora del sistema en el momento de la petición.

## Gestión de errores

La filosofía es mantenerla lo más simple posible:

- Si ocurre un error recuperable (p. ej. un timeout en una petición al foro), se reintenta según la política de reintentos (ver más abajo). Si tras los reintentos sigue fallando, se lanza una excepción que el handler captura y redirige al usuario al listado o al calendario según el contexto, sin mostrar un mensaje de error detallado.
- Si ocurre un error no recuperable (p. ej. sesión caducada, el foro devuelve que somos invitados), se fuerza el logout de la aplicación y se redirige a la pantalla de LOGIN para que el usuario vuelva a identificarse.
- No existe una pantalla de error genérica ni mensajes de error específicos por código.
- Los errores inesperados se registran mediante `console.error` o el logger interno (ver sección de logging más abajo) y se devuelve un 500 genérico.

## Logging

- Se dispone de un módulo `src/lib/logger.js` con funciones `log()`, `warn()`, `error()`.
- Todo el logging está gobernado por la variable de entorno `DEBUG`. Si `DEBUG=true` o `DEBUG=1`, los mensajes de `log()` y `warn()` se muestran en consola. Los errores (`error()`) siempre se muestran, independientemente de `DEBUG`.

## Política de reintentos

Para las peticiones HTTP al foro se sigue una política mínima, sin librerías externas:

- Se realizan hasta **2 reintentos** automáticos ante fallos de red o respuestas 5xx.
- Entre reintento y reintento se espera **3 segundos**.
- Si tras los reintentos la petición sigue fallando, se lanza el error para que el handler lo gestione.
- No se reintentan peticiones que hayan dado 4xx (errores del cliente: 401, 403, 404, etc.), ya que indican un problema de sesión o de lógica que no se resuelve repitiendo.

## Estructura del `ForumClient`

El cliente HTTP para el foro se encuentra en `src/lib/forum-client.js` y encapsula:

- **Base URL**: se construye desde `FORUM_BASE`.
- **Cookie jar**: `Map<string, string>` que se actualiza con cada respuesta (mediante `Set-Cookie`).
- **Métodos**: `get(path)`, `post(path, body)`.
- **Redirecciones**: sigue automáticamente redirects 301, 302, 303 (cambiando a GET) y 307/308 (manteniendo el método). El seguimiento es recursivo.
- **Retry**: reintentos según la política descrita arriba.
- **Headers por defecto**: `User-Agent: Mozilla/5.0 (compatible; MecatolForos/1.0)` y `Content-Type: application/x-www-form-urlencoded` para POST.

## Estructura de los foros a los que nos vamos a conectar

- En el foro se pueden reservar una serie de salas y las páginas en las que se pueden consultar las reservas para cada una de ellas hay que introducirlas mediante variables de entorno. Como valor por defecto usaremos lo siguiente:
ROOMS=Moria,https://www.mecatolrex.com/foro/index.php?board=26.0;Nostromo,https://www.mecatolrex.com/foro/index.php?board=8.0;Arkham,https://www.mecatolrex.com/foro/index.php?board=7.0

- El tablón de "¿Cuándo estaremos?" en el que hay que anunciar la gente que va a estar en la sala es siempre el mismo pero también quiero tenerlo en una variable de entorno:
WHO=https://www.mecatolrex.com/foro/index.php?board=2.0

### Mecanismo de formularios y CSRF en SMF 2.1.4

SMF 2.1.4 utiliza nombres de campo CSRF dinámicos. Para interactuar con sus formularios:

1. **Login**: se obtiene la página de login, se extraen todos los campos ocultos del formulario `action=login2` (incluyendo el token CSRF con nombre dinámico) y se envían junto con `user`, `passwrd` y `cookielength=3153600` a `/index.php?action=login2`.

2. **Posts (respuesta en hilos)**: se obtiene la página del hilo, se localiza el formulario con `action=post2` y se extraen todos sus campos ocultos (incluyendo `topic`, `sc`/token dinámico, `seqnum`). Se añade el campo `message` con el cuerpo y se envía.

3. **Extracción de campos ocultos**: función `extractHiddenInputs(html)` en `src/lib/scraper.js`. Busca todas las `<input type="hidden">` y devuelve un objeto `{ name: value }`.

### Scrapping de un hilo de reserva de sala

Para consultar si hay reservas en una sala entraremos en el hilo correspondiente y el primer post tendrá una tabla que se actualiza automáticamente con la siguiente estructura html (solo cambiarán algunos datos dinámicos pero no la estructura):

```
<div class="windowbg" id="msg19470">
    <div class="post_wrapper">
        <div class="poster">
            <h4>
                <a href="https://www.mecatolrex.com/foro/index.php?action=profile;u=642" title="Ver el perfil de MecaBot">MecaBot</a>
            </h4>
        </div>
        <div class="postarea">
            <div class="post">
                <div class="inner" data-msgid="19470" id="msg_19470">
                    <table class="bbc_table">
                        <tbody>
                            <tr>
                                <td><b>Fecha</b></td>
                                <td>&nbsp; &nbsp; &nbsp;</td>
                                <td><b>Hora</b></td>
                                <td>&nbsp; &nbsp; &nbsp;</td>
                                <td><b>Usuario</b></td>
                                <td>&nbsp; &nbsp; &nbsp;</td>
                                <td><b>Actividad</b></td>
                            </tr>
                            <tr>
                                <td>Miércoles 1</td>
                                <td></td>
                                <td>18:30-21:30</td>
                                <td></td>
                                <td>E-checa</td>
                                <td></td>
                                <td>2º Sesión de Aventura usando EZD6</td>
                            </tr>
                            <!-- más filas -->
                        </tbody>
                    </table>
                    <br><br>
                    <b>DISCLAIMER:</b> Este resumen ha sido elaborado de forma automática. Si ves algún error o discrepancia por favor comunícalo a @backbeat
                </div>
            </div>
        </div>
    </div>
</div>
```

El parseo de la tabla se realiza mediante `parseBookingTable(html)` en `src/lib/scraper.js`, que busca una `<table>` con clase `bbc_table` (o la primera tabla que contenga las cabeceras Fecha/Hora/Usuario/Actividad) y extrae las filas con Fecha, Hora, Usuario y Actividad.

### Enrutamiento

El enrutador está en `src/lib/router.js`. Es un sistema simple que registra rutas `GET` y `POST` con patrones de ruta y las evalúa secuencialmente. Soporta:
- Rutas fijas: `/calendar`
- Parámetros de path: `/:id`
- Comodín final: `/static/*`

### Sesión de la aplicación

La sesión de la aplicación se gestiona en `src/lib/session.js`:

- **Cookie**: `session`, HttpOnly, Secure, SameSite=Lax.
- **Cifrado**: AES-GCM con una clave derivada de `SESSION_SECRET` mediante SHA-256.
- **Contenido**: `{ forumCookies: string, username: string }`.
- **Duración**: la que marque el navegador (sesión de navegador). Al hacer logout se elimina la cookie y se llama a `action=logout` en el foro.
- **Obtención**: `getSession(request, env)` descifra la cookie y devuelve los datos, o un objeto vacío si no existe o no se puede descifrar.
- **Establecimiento**: `setSessionCookie(data, secret)` cifra los datos y devuelve el string `Set-Cookie` correspondiente.

### Extracción del nombre de usuario

Tras un login exitoso, se hace una petición a `/index.php?action=profile` y se extrae el nombre de usuario del `<title>` de la página, que en SMF 2.1 tiene el formato `"Perfil de <username>"`. La función `extractUsernameFromProfile(html)` en `src/lib/scraper.js` se encarga de esto.
