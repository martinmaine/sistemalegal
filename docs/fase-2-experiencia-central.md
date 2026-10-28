# Fase 2 — Experiencia central

Rama: `producto/fase-1-fundaciones` · Continúa [`fase-1-fundaciones.md`](fase-1-fundaciones.md).

La Fase 1 dejó la aplicación leyendo datos reales. Esta fase la deja **escribiendo**:
expedientes, personas, partes y equipo asignado se crean, se editan y se dan de baja desde
la pantalla, con las reglas del dominio verificadas en el servidor.

---

## 1. Qué quedó funcionando

### Expedientes

- **Edición completa** desde el detalle, con el formulario precargado. Es el mismo
  formulario que el alta: si fueran dos, cada campo nuevo habría que agregarlo dos veces y
  tarde o temprano uno quedaría atrás. La diferencia es qué campos se ofrecen —cerrar una
  causa solo tiene sentido sobre una que ya existe— y qué pasa al guardar.
- **Baja lógica.** Marca `eliminado_en` y no borra nada: un expediente arrastra plazos,
  documentos, movimientos y costas, y la auditoría lo referencia por id. Deja de aparecer
  en toda la aplicación porque cada consulta ya filtraba `eliminado_en IS NULL`.

### Personas

- Alta, edición y baja desde la agenda y desde la ficha.
- El formulario cambia con el tipo: una persona física pide nombre y apellido, una
  jurídica pide razón social. Mostrar los tres campos y dejar que el usuario adivine
  cuáles llenar es la forma de conseguir fichas a medio cargar.
- El CUIT se acepta con o sin guiones y se normaliza al formato con guiones.

### Partes y equipo

- **Vincular una persona al expediente** eligiéndola de la agenda, nunca escribiendo el
  nombre otra vez: tipearlo crearía duplicados, la misma contraria cargada tres veces con
  tres grafías. Si no está en la agenda, se la da de alta desde el mismo diálogo y queda
  seleccionada al volver.
- **Desvincularla** borra el vínculo, no a la persona.
- **Asignar y desasignar integrantes del estudio.** Desasignar pone fecha de baja en lugar
  de borrar la fila: quién trabajó el expediente y hasta cuándo es información que hace
  falta para explicar una actuación pasada.

### Endpoints nuevos

| Método y ruta | Permiso | Qué hace |
|---|---|---|
| `PUT /api/causas/:id` | `causa.editar` | Edita el expediente |
| `DELETE /api/causas/:id` | `causa.eliminar` | Baja lógica del expediente |
| `POST /api/causas/:id/partes` | `causa.editar` | Vincula una persona con su carácter |
| `DELETE /api/causas/:id/partes/:vinculoId` | `causa.editar` | Quita la parte del expediente |
| `POST /api/causas/:id/profesionales` | `causa.editar` | Asigna un integrante del estudio |
| `DELETE /api/causas/:id/profesionales/:vinculoId` | `causa.editar` | Le pone fecha de baja |
| `POST /api/personas` | `persona.crear` | Alta en la agenda |
| `PUT /api/personas/:id` | `persona.editar` | Edita la ficha |
| `DELETE /api/personas/:id` | `persona.eliminar` | Baja lógica de la agenda |

Vincular una persona exige `causa.editar` y no `persona.crear`: es editar el expediente,
no tocar la agenda.

Toda escritura queda auditada con el estado anterior y el posterior.

---

## 2. Reglas de negocio que no estaban en la base

La base impide lo que puede expresar con restricciones. Estas dos no se pueden escribir
como `CHECK` y se verifican en el servicio:

- **Un expediente no puede quedar sin nadie a cargo.** Desaparecería de «mis causas», no
  tendría a quién notificarle un vencimiento y no se le podrían delegar tareas. El mensaje
  dice qué hacer: *«Asigná a otra persona antes de quitar a esta.»*
- **Una persona que interviene en un expediente en trámite no se puede dar de baja.**
  Dejaría de figurar en el listado de partes, que es justo donde hace falta saber a quién
  se demanda. Primero se la desvincula de la causa; después se la da de baja.

Las dos cuentan solo lo que está vigente: integrantes `activo`, causas con estado no final.

---

## 3. Decisiones que conviene conocer

### La edición es un reemplazo completo, no un parche

El formulario envía todos los campos y lo que no viene se borra. Con un parche parcial,
«vaciar el tribunal» y «no tocar el tribunal» llegan idénticos al servidor.

### El detalle expone los ids de los catálogos

Antes devolvía solo los nombres (`fuero`, `tribunal`), que alcanzan para mostrar pero no
para precargar un desplegable: habría que adivinar el id por el nombre. Ahora viajan los
dos.

### Validar lo que la base ya valida

Las reglas de identificación de persona y la coherencia de fechas están en la migración
004 como restricciones `CHECK`. Se replican en Zod no por desconfianza sino porque una
violación de restricción llega como error genérico y no dice en qué campo del formulario
está el problema. El servidor sigue siendo la última palabra; la base, la red de seguridad.

### El carácter procesal es del vínculo, no de la persona

La misma persona puede ser demandada en una causa y testigo en otra, y hasta tener dos
caracteres en la misma. Lo único que no se repite es el mismo carácter dos veces, que es
exactamente lo que dice `uq_parte_causa`.

### Un integrante asignado tiene que existir y estar activo

La clave foránea garantizaba que existiera, pero no que estuviera activo, y un id
inexistente volvía como violación de restricción —un 500— en lugar de un error en el
campo. Se valida contra la base y no solo contra el desplegable: el desplegable ofrece
únicamente integrantes activos, pero la API es alcanzable sin pasar por la pantalla.

### Confirmación antes de lo que no se deshace solo

Las bajas pasan por un diálogo que nombra el registro afectado y cuyo botón nombra la
acción, no dice «Aceptar»: lo último que se lee antes del clic tiene que ser la
consecuencia. Si el servidor rechaza la operación por una regla de negocio, el mensaje se
muestra dentro del mismo diálogo, donde el usuario está mirando.

---

## 4. Verificación

- `npm run typecheck`, `npm test` y `npm run build` pasan en backend y frontend.
- **94 pruebas en verde**, 38 nuevas. Entre ellas:
  - La edición se verifica **releyendo el expediente de la base**, no mirando la respuesta.
  - Guardar sin cambiar el número de expediente no se toma como duplicado; tomar el número
    de otro sí, con el error en el campo.
  - Una fecha de cierre anterior al inicio se rechaza señalando `fecha_cierre`.
  - La baja saca el expediente del listado y del detalle.
  - Un empleado puede editar pero no dar de baja (403), y el expediente sigue ahí.
  - La misma persona no se repite con el mismo carácter, pero sí con otro.
  - Asignar a alguien inexistente o dado de baja devuelve 400, no un 500.
  - No se puede desasignar al único integrante a cargo; sí cuando hay otro.
  - Una persona que interviene en una causa en trámite no se da de baja.
- Recorrido completo verificado en el navegador sobre los datos de demostración: editar un
  expediente y releerlo, vincular y desvincular una parte, el bloqueo al desasignar al
  único responsable, alta de persona con sus errores por campo, baja de persona y el
  bloqueo por intervenir en una causa en trámite. Los datos de demostración quedaron como
  estaban.

---

## 5. Qué falta

- **Motor de cómputo de plazos.** Sigue siendo el núcleo de valor pendiente y requiere
  validación jurídica además de pruebas. Las pantallas muestran los plazos tal como están
  cargados y lo dicen explícitamente.
- Registrar movimientos procesales desde la pantalla.
- Carga de documentos y el microservicio de extracción de PDF.
- Agenda, tareas, costas, plantillas, notificaciones, usuarios y configuración. Aparecen
  en la barra lateral apagados y rotulados «En desarrollo».

### Limitaciones conocidas

Siguen vigentes las de la Fase 1: la cookie entre dominios en producción, que `npm test`
cierra la sesión abierta en el navegador local, y que el cálculo de días restantes se hace
en el navegador. Ver la sección correspondiente del
[informe de la Fase 1](fase-1-fundaciones.md#limitaciones-conocidas).

Una más de esta fase: **la edición no detecta ediciones simultáneas**. Si dos personas
abren el mismo expediente y guardan, gana la última. Para un estudio chico es poco
probable; cuando haga falta, la columna `actualizado_en` ya existe y alcanza para un
control de concurrencia optimista.
