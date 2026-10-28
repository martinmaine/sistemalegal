import { Router } from 'express';
import { requierePermiso } from '../../middlewares/autenticacion';
import { validarConsulta, validarCuerpo } from '../../middlewares/validacion';
import {
  esquemaCrearPlazo,
  esquemaCumplirPlazo,
  esquemaEditarPlazo,
  esquemaFiltrosPlazo,
  esquemaReanudarPlazo,
  esquemaSimularPlazo,
  esquemaSuspenderPlazo,
} from './esquemas';
import {
  deletePlazo,
  getPlazo,
  getPlazos,
  postCumplir,
  postPlazo,
  postReabrir,
  postReanudar,
  postSimulacion,
  postSuspender,
  putPlazo,
} from './controlador';

/**
 * Rutas de plazos.
 *
 * Las que cuelgan de un expediente viven en `rutasPlazosDeCausa` y se montan
 * bajo `/api/causas/:id`; las que operan sobre un plazo concreto, en
 * `rutasPlazos`, bajo `/api/plazos`.
 */

export const rutasPlazos = Router();

rutasPlazos.get('/', requierePermiso('plazo.ver'), validarConsulta(esquemaFiltrosPlazo), getPlazos);
rutasPlazos.get('/:id', requierePermiso('plazo.ver'), getPlazo);
rutasPlazos.put('/:id', requierePermiso('plazo.editar'), validarCuerpo(esquemaEditarPlazo), putPlazo);
rutasPlazos.delete('/:id', requierePermiso('plazo.eliminar'), deletePlazo);

// Cambios de estado. Cada uno es su propia acción y no un campo del PUT:
// cumplir, suspender y reanudar registran además cuándo y por qué, y tienen
// reglas propias sobre desde qué estado se puede llegar a ellos.
rutasPlazos.post(
  '/:id/cumplir',
  requierePermiso('plazo.editar'),
  validarCuerpo(esquemaCumplirPlazo),
  postCumplir,
);
rutasPlazos.post('/:id/reabrir', requierePermiso('plazo.editar'), postReabrir);
rutasPlazos.post(
  '/:id/suspender',
  requierePermiso('plazo.editar'),
  validarCuerpo(esquemaSuspenderPlazo),
  postSuspender,
);
rutasPlazos.post(
  '/:id/reanudar',
  requierePermiso('plazo.editar'),
  validarCuerpo(esquemaReanudarPlazo),
  postReanudar,
);

/** Se monta en `/api/causas/:id`, por eso `mergeParams`. */
export const rutasPlazosDeCausa = Router({ mergeParams: true });

rutasPlazosDeCausa.post(
  '/plazos',
  requierePermiso('plazo.crear'),
  validarCuerpo(esquemaCrearPlazo),
  postPlazo,
);

// La previsualización no escribe nada, pero muestra el calendario judicial de
// la causa: exige el mismo permiso que crear el plazo.
rutasPlazosDeCausa.post(
  '/plazos/simular',
  requierePermiso('plazo.crear'),
  validarCuerpo(esquemaSimularPlazo),
  postSimulacion,
);
