# Definición

Quiero hacer una aplicación web que se conecte a unos foros con mis credenciales y realice una serie de acciones en mi nombre.

## Flujo de la aplicación

### Comportamientos generales
- Si al entrar en la página no estamos autenticados, se mostrará la pantalla de login para que introduzcamos las credenciales de los foros. Si en cualquier momento se pierde la conexión, caduca la sesión o hay algún error en este sentido, se vuelve a la página de login.
- Cuando se hace una llamada a un servicio aparecerá un loader que no permitirá que se haga ninguna acción hasta que el servicio no haya respondido. Si la petición supera un tiempo máximo sin respuesta, se muestra un mensaje de error y se desbloquea la interfaz.
- Toda la interfaz de la aplicación está en español (es-ES).

### Pantallas
- LOGIN: un formulario que nos permite introducir las credenciales para que la app se pueda loguear en nuestro nombre en los foros.
- CALENDARIO: un formulario que permite seleccionar año, mes y días a consultar.
- LISTADO DE RESERVAS: un listado que muestra las reservas para los días seleccionados.
- RESERVAR: un formulario que permite escribir una respuesta para uno de los hilos del foro con un formato predefinido.

#### Detalles de la página LOGIN

Esta página muestra un formulario con los siguientes campos:
- EMAIL: campo de texto de tipo email.
    - Valor por defecto: vacío.
    - Validaciones: solo permite introducir un email válido.
- CONTRASEÑA: campo de texto de tipo contraseña.
    - Valor por defecto: vacío.
- BOTÓN "Identificarse": envía el formulario.

#### Detalles de la página CALENDARIO

En la cabecera de esta página se muestra siempre:
- El texto **"Suplantando a: <nombre de usuario>"**, donde el nombre es el del usuario con el que se hizo login en el foro.
- Un botón **"Cerrar sesión"** que cierra la sesión del usuario tanto en el foro como en la app y redirige a la pantalla de LOGIN.

A continuación, esta página muestra un formulario con los siguientes campos:
- AÑO: lista de selección con el año actual y el siguiente.
    - Valor por defecto: el año actual.
- MES: lista de selección con los meses del año seleccionado en AÑO.
    - Valor por defecto: el mes actual.
    - Validaciones: si el año seleccionado es el año actual, solo se muestran el mes actual y los posteriores; si el año seleccionado es el siguiente, se muestran todos los meses.
- DÍAS: se muestra el calendario del mes seleccionado en el campo MES en el que se pueden seleccionar varios días.
    - Valor por defecto: no hay días seleccionados.
    - Solo se pueden seleccionar días iguales o posteriores a hoy.
- DÍAS SELECCIONADOS: lista visible permanentemente que muestra todos los días seleccionados en formato `DD/MM/AA`, ordenados cronológicamente.
- BOTÓN "Limpiar selección": vacía la lista de días seleccionados. Está siempre visible pero deshabilitado si no hay ningún día seleccionado.
- BOTÓN "Consultar reservas": el botón permanece inhabilitado mientras no haya días seleccionados.

##### Diseño visual y de interacción del componente calendario

- Se trata de una cuadrícula de 7 columnas en la que la primera fila es una cabecera con las etiquetas de los días (L M X J V S D) y en las siguientes filas se muestran celdas numeradas para cada día del mes seleccionado.
- Solo se dibujan las celdas correspondientes a los días del mes seleccionado: las posiciones de la cuadrícula anteriores al primer día del mes y posteriores al último quedan vacías (no se rellenan con días del mes anterior ni del siguiente).
- Se respeta el offset del primer día de la semana: la semana empieza lunes pero el primer día del mes ocupará la columna que le corresponda.
- Estados visuales de cada celda:
    - **Normal** (día seleccionable): fondo gris claro, letra en negro.
    - **Seleccionado**: fondo azul, letra en blanco.
    - **Deshabilitado** (día del mes actual anterior a hoy): fondo gris claro con estilo atenuado; no responde al clic.
- Al hacer clic en una celda normal pasa a seleccionada y el día se añade a la lista de DÍAS SELECCIONADOS. Al hacer clic en una celda seleccionada vuelve a normal y el día se elimina de la lista.
- Navegación entre meses y años:
    - El campo AÑO no permite valores inferiores al año actual ni superiores al año siguiente.
    - El campo MES no permite seleccionar un mes anterior al actual cuando el año seleccionado es el año actual (en la práctica, esos meses no aparecen en el desplegable).
    - Cambiar el MES mantiene la lista de DÍAS SELECCIONADOS tal cual.
    - En ambos casos se redibuja la cuadrícula del nuevo mes. Los días ya seleccionados que pertenezcan a meses distintos del que se está mostrando no se ven resaltados en la cuadrícula, pero siguen apareciendo en la lista de DÍAS SELECCIONADOS.

##### Indicadores visuales de actividad del usuario

Debajo del número de cada día del calendario puede aparecer un punto de color que indica si el usuario tiene alguna reserva o anuncio publicado para ese día:

- **Punto verde**: el usuario tiene tanto una reserva de sala como un anuncio en "¿Cuándo estaremos?" para ese día.
- **Punto naranja**: el usuario tiene una reserva de sala pero no tiene anuncio asociado para ese día.

Estos puntos se cargan de forma asíncrona: la página del calendario se renderiza primero sin puntos, y una petición en segundo plano a `/user-posts?year=...&month=...` los recupera y los aplica sobre la cuadrícula. Si la petición falla o tarda, la página sigue siendo funcional sin los puntos.

Los datos se obtienen analizando la lista de mensajes del usuario en el foro (`/index.php?action=profile;area=showposts;sa=messages`). Se recorren las páginas necesarias hasta encontrar todos los mensajes del mes visualizado. Los mensajes en tablones de reserva de salas (cuyo cuerpo contiene la fecha de la reserva) se consideran reservas, y los mensajes en el tablón "¿Cuándo estaremos?" (cuya fecha está en el asunto) se consideran anuncios.

#### Detalles de la página LISTADO DE RESERVAS

En la cabecera de la página hay un botón **"Volver al calendario"** que regresa a la página CALENDARIO manteniendo intacta la selección de días (año, mes y días marcados), para que el usuario pueda añadir o quitar días y volver a consultar.

A continuación, la página muestra una sección por cada sala disponible. Cada sección se puede colapsar y contiene lo siguiente:

- El **nombre de la sala** y un **enlace al tablón original del foro** (se abre en una pestaña nueva).
- Una tabla con las reservas de los días seleccionados para esa sala, ordenadas por día y después por hora de inicio:

| Fecha     | Hora         | Usuario | Actividad                        |
|-----------|--------------|---------|----------------------------------|
| Sábado 27 | 10:00-14:00  | Pilar   | Campaña de Arkham Horror LCG     |
| Sábado 27 | 17:30-21:30  | Trizy   | Witchcraft                       |

- Si ninguno de los días seleccionados tiene reservas en esa sala, se muestra el mensaje **"Sin reservas"** en lugar de la tabla.
- A la derecha de cada sección hay un botón **"Reservar"** que navega a la página RESERVAR llevando el contexto necesario (sala, hilo mes/año correspondiente y días seleccionados).

##### Extraer las reservas existentes para las salas disponibles

Los datos de las reservas de las salas disponibles se publican en un sistema de foros. Para consultar qué salas están ya reservadas y cuándo, hay que seguir los siguientes pasos para cada una de ellas:

1) Por cada sala disponible habrá un tablón en el que tendría que haber un hilo por cada mes y año cuyo título será precisamente "MES AÑO" (ej. Enero 2026, Febrero 2026, etc.). Podría no haberse creado aún el hilo que estamos buscando, en cuyo caso en la sección de esa sala en el listado, en vez de la tabla correspondiente, se muestra el mensaje: **"Aún no hay hilo para el mes seleccionado"**.

2) Si hemos encontrado el hilo mes/año para la sala correspondiente, en el primer post del hilo habrá una tabla que se va actualizando de forma automática mediante un bot (el autor es siempre MecaBot). 

3) Deberemos capturar Fecha, Hora, Usuario y Actividad solo de los días que se han seleccionado.

#### Detalles de la página RESERVAR

Esta página muestra un formulario con los siguientes campos:
- FECHA: lista de selección que contiene solo los días que se habían seleccionado en el calendario (ej. Viernes 19, Sábado 20 y Domingo 21).
    - Valor por defecto: ninguno.
- HORA DE INICIO (HORAS): lista de selección con los números del 00 al 23.
    - Valor por defecto: el número más cercano a la hora actual.
- HORA DE INICIO (MINUTOS): lista de selección con los números 00, 15, 30, y 45.
    - Valor por defecto: el número más cercano a la hora actual.
- HORA DE FIN (HORAS): lista de selección con los números del 00 al 23.
    - Valor por defecto: HORA DE INICIO (HORAS) + 4, sin superar las 23.
- HORA DE FIN (MINUTOS): lista de selección con los números 00, 15, 30, y 45.
    - Valor por defecto: el mismo valor que HORA DE INICIO (MINUTOS).
- ACTIVIDAD: campo de texto.
    - Valor por defecto: vacío.
    - Solo se permite texto plano (sin BBCode, HTML ni otro formato).
- ANUNCIAR: checkbox.
    - Valor por defecto: desmarcado.
- QUIENES: campo de texto.
    - Valor por defecto: vacío y deshabilitado.
    - Solo se habilita al marcar ANUNCIAR.
    - Si se desmarca ANUNCIAR, este campo se vacía y se deshabilita.
- BOTÓN "Reservar": el botón permanece inhabilitado mientras no estén todos los campos rellenados (menos el ANUNCIAR que es opcional). Al pulsarlo se envía la reserva al servidor, que verifica antes de publicar que la franja solicitada no solapa con ninguna reserva existente en la misma sala y día. Si hay solapamiento, se muestra un mensaje de error y no se crea la reserva.

##### Crear una nueva reserva

Para reservar una sala tenemos que contestar en el foro dentro del hilo apropiado.

1) Para encontrar el hilo apropiado hay que seguir el paso 1 de la funcionalidad "Extraer las reservas existentes para las salas disponibles". En caso de no existir el hilo aún, se muestra un mensaje de error en la misma página de reserva y no se puede continuar.

2) Una vez tengamos la sala, el día y la franja horaria en la que queremos reservar, contestaremos en el hilo apropiado con un texto que tendrá el siguiente formato:
Solicito reserva para el [FECHA] en la franja de [HORA DE INICIO (HORAS)]:[HORA DE INICIO (MINUTOS)]-[HORA DE FIN (HORAS)]:[HORA DE FIN (MINUTOS)] para [ACTIVIDAD].

3) Si se ha marcado el campo ANUNCIAR, además de responder en el hilo correspondiente mes/año, tendremos que responder en otro hilo en el que se tiene que anunciar qué personas van a hacer una actividad un día determinado. Para encontrar este otro hilo habrá que ir al tablón "¿Cuándo estaremos?" y allí el hilo que buscamos tendrá como título "DÍA # de MES" (ej. Viernes 26 de Junio).

4) Si el hilo de anuncio no existe todavía, la reserva se crea igual pero se redirige al listado de reservas mostrando un modal de aviso indicando que no se ha podido encontrar el hilo de anuncio y que la reserva se ha creado correctamente. El usuario debe cerrar el modal manualmente.

5) El mensaje para el hilo de anuncio será:
De [HORA DE INICIO (HORAS)]:[HORA DE INICIO (MINUTOS)]-[HORA DE FIN (HORAS)]:[HORA DE FIN (MINUTOS)] estaremos con [ACTIVIDAD] las siguientes personas: [QUIENES].

6) Si la publicación se ha realizado correctamente (tanto la reserva como el anuncio), se redirige al listado de reservas con los días correspondientes para que el usuario pueda ver el resultado. Si la reserva no se ha podido crear, se muestra un mensaje de error en la misma página de reserva.
