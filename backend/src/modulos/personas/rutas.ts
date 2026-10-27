import { Router } from 'express';
import { requierePermiso } from '../../middlewares/autenticacion';
import { validarConsulta, validarCuerpo } from '../../middlewares/validacion';
import { esquemaFiltrosPersona, esquemaPersona } from './esquemas';
import { deletePersona, getPersona, getPersonas, postPersona, putPersona } from './controlador';

export const rutasPersonas = Router();

rutasPersonas.get('/', requierePermiso('persona.ver'), validarConsulta(esquemaFiltrosPersona), getPersonas);
rutasPersonas.post('/', requierePermiso('persona.crear'), validarCuerpo(esquemaPersona), postPersona);

rutasPersonas.get('/:id', requierePermiso('persona.ver'), getPersona);
rutasPersonas.put('/:id', requierePermiso('persona.editar'), validarCuerpo(esquemaPersona), putPersona);
rutasPersonas.delete('/:id', requierePermiso('persona.eliminar'), deletePersona);
