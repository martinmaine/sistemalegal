# Fase 3 — Cómputo de plazos y operación jurídica

Rama: `producto/fase-1-fundaciones` · Continúa [`fase-2-experiencia-central.md`](fase-2-experiencia-central.md).

Esta fase incorpora el núcleo de valor del producto: **el cálculo de vencimientos
procesales**, con la explicación de cómo se llegó a cada fecha.

---

## 1. Qué está en el código y qué no

Es la distinción que define toda la fase.

**En el código está el algoritmo.** Cómo se cuentan los días, qué se saltea y
cuándo se corre un vencimiento al día hábil siguiente. Vive en
[`backend/src/modulos/plazos/computo.ts`](../backend/src/modulos/plazos/computo.ts)
y es una función pura: recibe la notificación, la regla y el calendario, y
devuelve la fecha junto con el detalle del cálculo. No toca la base ni el reloj
del sistema, que es la condición para probarlo con casos documentados.

**En el código NO están las reglas jurídicas.** Cuántos días tiene cada plazo,
si se cuentan hábiles o corridos y qué días son inhábiles son *datos*: salen de
`tipo_plazo` y `dia_inhabil`. Agregar una provincia es insertar filas, no tocar
este archivo. Es lo que pedía la propuesta y lo que la migración 006 ya había
previsto al separar la regla, el calendario y la instancia.

**El resultado nunca se presenta como garantía legal.** La pantalla lo dice
donde se lee la fecha, no enterrado en un manual: *«Es una ayuda para no perder
un vencimiento, no un dictamen: el control del plazo sigue siendo del
profesional a cargo.»*

---

## 2. Cómo calcula

1. **El día de la notificación no se cuenta.** El cómputo arranca el primer día
   hábil siguiente. Como la regla varía según el acto procesal, se puede fijar
   otro día a mano, y queda registrado cuál se usó.
2. **Se cuentan los días.** En cómputo hábil se saltean sábados, domingos y los
   `dia_inhabil` de la jurisdicción; en corrido se cuentan todos.
3. **Los días suspendidos no cuentan**, en cualquiera de los dos cómputos.
4. **Si el último día cae inhábil, el plazo vence el hábil siguiente.**

Cada paso vuelve en la respuesta: las frases que explican el razonamiento y el
detalle día por día con el motivo de cada salteo («Sábado», «Jueves Santo»,
«Suspensión: incidente de nulidad»).

### Lo que hace que sea usable

- **El vencimiento se ve antes de guardar.** Al completar la fecha y los días, el
  formulario pide el cálculo y lo muestra con su explicación. Cargar un plazo y
  descubrir después a qué día cayó sería pedirle al abogado que confíe sin mirar.
- **El cálculo se rehace al abrir el detalle**, contra el calendario de hoy. Si
  no coincide con lo guardado, se avisa en lugar de pisar el dato: que se haya
  cargado un feriado después es algo que el abogado tiene que ver.
- **Suspender y reanudar recalculan**, y la fila muestra el vencimiento
  original al lado del nuevo.

---

## 3. Qué más quedó funcionando

| Método y ruta | Permiso | Qué hace |
|---|---|---|
| `GET /api/plazos` | `plazo.ver` | Agenda: filtra por rango, responsable, estado y causa |
| `GET /api/plazos/:id` | `plazo.ver` | Detalle con la explicación del cómputo |
| `POST /api/causas/:id/plazos` | `plazo.crear` | Alta, calculando el vencimiento |
| `POST /api/causas/:id/plazos/simular` | `plazo.crear` | Previsualización sin guardar |
| `PUT /api/plazos/:id` | `plazo.editar` | Edición, recalculando |
| `POST /api/plazos/:id/cumplir` | `plazo.editar` | Lo da por cumplido con su fecha |
| `POST /api/plazos/:id/reabrir` | `plazo.editar` | Reabre uno cerrado por error |
| `POST /api/plazos/:id/suspender` | `plazo.editar` | Suspende y recalcula |
| `POST /api/plazos/:id/reanudar` | `plazo.editar` | Cierra la suspensión y recalcula |
| `DELETE /api/plazos/:id` | `plazo.eliminar` | Borra uno cargado por error |
| `POST /api/causas/:id/movimientos` | `causa.editar` | Registra un movimiento procesal |
| `DELETE /api/causas/:id/movimientos/:id` | `causa.editar` | Borra uno cargado a mano |

**Agenda y plazos** deja de ser un módulo «en desarrollo». Agrupa por urgencia
—vencidos, hoy, esta semana, más adelante, detenidos— en lugar de ordenar por
fecha: una lista ordenada obliga a leer fechas y restar; los grupos contestan de
un vistazo. Los filtros viven en la URL, así que «mis plazos de esta semana» se
puede guardar como marcador.

---

## 4. Decisiones que conviene conocer

### Un plazo vencido sigue siendo pendiente

Se llegó a implementar un barrido que marcaba como `VENCIDO` todo lo pendiente
con fecha pasada. Se quitó: sacaba esos plazos del filtro de plazos abiertos,
que es exactamente la pantalla donde no pueden faltar. Que esté vencido se
deduce de la fecha —`dias_restantes` viene negativo— y la agenda los muestra
primeros. El estado `VENCIDO` queda para cuando alguien decide cerrarlo como
incumplido, que es una decisión del estudio y no un efecto del paso del tiempo.

### Las fechas viajan como texto

`YYYY-MM-DD` de punta a punta, y toda la aritmética del motor usa UTC. Construir
un `Date` desde una fecha local corre el día según la zona horaria, y en un
vencimiento procesal un día de diferencia es el perjuicio que el sistema existe
para evitar. El motor explica en ese mismo formato —no depende de una
configuración regional— y la interfaz lo traduce al mostrarlo.

### Un tope de cinco años

Un calendario mal cargado —una suspensión sin fecha de reanudación— haría que el
motor no termine nunca de contar. Antes que colgar el servidor, falla con un
mensaje que dice qué revisar.

### El cómputo lo hace el servidor, no el navegador

El calendario vive en la base. Duplicar la lógica en el frontend para mostrar la
previsualización garantizaría que las dos versiones se separen.

---

## 5. Verificación

- `npm run typecheck`, `npm test` y `npm run build` pasan en backend y frontend.
- **145 pruebas en verde**, 51 nuevas.
- **25 casos del motor** con un calendario fijo, verificables a mano: días
  hábiles y corridos, feriados intercalados, una feria judicial completa, cruce
  de fin de año, suspensiones cerradas y abiertas, arranque fijado a mano,
  fechas inexistentes, 29 de febrero bisiesto y los errores de dato.
- **26 pruebas de integración** contra la base real, entre ellas que el feriado
  del 24 de marzo del calendario sembrado corre un vencimiento del 24 al 25
  —que es lo que prueba que el calendario real llega al motor— y que una
  suspensión de tres días hábiles mueve el vencimiento del 17 al 20 conservando
  el original.
- Recorrido verificado en el navegador: agenda agrupada, alta de plazo con la
  previsualización y el detalle día por día, suspensión con el vencimiento
  corrido de 10/11 a 17/11, y borrado. Los datos de demostración quedaron como
  estaban.

---

## 6. Qué falta

### Lo que necesita tu decisión, no más programación

- **Validación jurídica de las reglas.** Los diez `tipo_plazo` del seed tienen
  días y cómputo, pero `articulo_referencia` está vacío en todos. Sin la norma
  que funda cada plazo, el sistema calcula pero no puede justificar. Hace falta,
  para Córdoba: el artículo de cada plazo, el criterio de cómputo desde cada
  tipo de notificación, y el alcance exacto de la feria.
- **Calendario de días inhábiles.** El seed trae 2026 (12 feriados nacionales y
  44 días de feria). Para usarlo de verdad hay que cargar el año en curso y
  mantenerlo, y hoy eso se hace por SQL: la pantalla de configuración del
  calendario es parte de la fase siguiente.

### Lo que queda por construir

- **Tareas**: la API y la pantalla de gestión. Hoy se ven las del expediente,
  pero no se crean ni se editan.
- **Alertas y notificaciones** multinivel sobre los vencimientos.
- **Documentos** y el microservicio de extracción de PDF.
- **Plantillas de escritos**, costas, informes, usuarios y configuración.

### Limitaciones conocidas

Siguen vigentes las de las fases anteriores (ver el
[informe de la Fase 1](fase-1-fundaciones.md#limitaciones-conocidas) y el de la
[Fase 2](fase-2-experiencia-central.md#limitaciones-conocidas)).

De esta fase: **el cálculo no contempla prórrogas**. `tipo_plazo.prorrogable`
existe en el catálogo y `Ofrecer prueba` está marcado como tal, pero el motor no
hace nada con eso todavía; una prórroga se refleja hoy editando los días del
plazo, lo que deja registro en la auditoría pero no distingue la prórroga de una
corrección.
