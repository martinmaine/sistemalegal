import { Router } from 'express';
import { requierePermiso } from '../../middlewares/autenticacion';
import { validarConsulta } from '../../middlewares/validacion';
import { esquemaFiltrosPersona } from './esquemas';
import { getPersona, getPersonas } from './controlador';

export const rutasPersonas = Router();

rutasPersonas.get('/', requierePermiso('persona.ver'), validarConsulta(esquemaFiltrosPersona), getPersonas);
rutasPersonas.get('/:id', requierePermiso('persona.ver'), getPersona);
