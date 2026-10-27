import { Router } from 'express';
import { requierePermiso } from '../../middlewares/autenticacion';
import { validarConsulta, validarCuerpo } from '../../middlewares/validacion';
import {
  esquemaAgregarParte,
  esquemaAgregarProfesional,
  esquemaCrearCausa,
  esquemaEditarCausa,
  esquemaFiltrosCausa,
} from './esquemas';
import {
  deleteCausa,
  deleteParte,
  deleteProfesional,
  getCausa,
  getCausas,
  getDocumentos,
  getMovimientos,
  getPlazos,
  getTareas,
  postCausa,
  postParte,
  postProfesional,
  putCausa,
} from './controlador';

/**
 * Capa de rutas: el mapa de URL a controlador, con el permiso que exige cada una.
 *
 * El permiso se declara acá, junto a la ruta, para que al leer el archivo se
 * vea de un vistazo qué protege cada endpoint.
 */

export const rutasCausas = Router();

rutasCausas.get('/', requierePermiso('causa.ver'), validarConsulta(esquemaFiltrosCausa), getCausas);
rutasCausas.post('/', requierePermiso('causa.crear'), validarCuerpo(esquemaCrearCausa), postCausa);

rutasCausas.get('/:id', requierePermiso('causa.ver'), getCausa);
rutasCausas.put('/:id', requierePermiso('causa.editar'), validarCuerpo(esquemaEditarCausa), putCausa);
rutasCausas.delete('/:id', requierePermiso('causa.eliminar'), deleteCausa);

rutasCausas.get('/:id/movimientos', requierePermiso('causa.ver'), getMovimientos);
rutasCausas.get('/:id/plazos', requierePermiso('plazo.ver'), getPlazos);
rutasCausas.get('/:id/documentos', requierePermiso('documento.ver'), getDocumentos);
rutasCausas.get('/:id/tareas', requierePermiso('tarea.ver'), getTareas);

// Vincular una persona o un integrante del estudio es editar el expediente, no
// crear ni borrar una persona: por eso exige causa.editar y no persona.crear.
rutasCausas.post(
  '/:id/partes',
  requierePermiso('causa.editar'),
  validarCuerpo(esquemaAgregarParte),
  postParte,
);
rutasCausas.delete('/:id/partes/:vinculoId', requierePermiso('causa.editar'), deleteParte);

rutasCausas.post(
  '/:id/profesionales',
  requierePermiso('causa.editar'),
  validarCuerpo(esquemaAgregarProfesional),
  postProfesional,
);
rutasCausas.delete('/:id/profesionales/:vinculoId', requierePermiso('causa.editar'), deleteProfesional);
