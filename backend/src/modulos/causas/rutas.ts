import { Router } from 'express';
import { requierePermiso } from '../../middlewares/autenticacion';
import { validarConsulta, validarCuerpo } from '../../middlewares/validacion';
import { esquemaCrearCausa, esquemaFiltrosCausa } from './esquemas';
import {
  getCausa,
  getCausas,
  getDocumentos,
  getMovimientos,
  getPlazos,
  getTareas,
  postCausa,
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
rutasCausas.get('/:id/movimientos', requierePermiso('causa.ver'), getMovimientos);
rutasCausas.get('/:id/plazos', requierePermiso('plazo.ver'), getPlazos);
rutasCausas.get('/:id/documentos', requierePermiso('documento.ver'), getDocumentos);
rutasCausas.get('/:id/tareas', requierePermiso('tarea.ver'), getTareas);
