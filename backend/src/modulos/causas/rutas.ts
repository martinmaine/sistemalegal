import { Router } from 'express';
import { getCausas } from './controlador';

/** Capa de rutas: solo el mapa de URL a controlador. */

export const rutasCausas = Router();

rutasCausas.get('/', getCausas);
