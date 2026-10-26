import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config';
import { requiereSesion } from '../../middlewares/autenticacion';
import { validarCuerpo } from '../../middlewares/validacion';
import { esquemaLogin } from './esquemas';
import { getPerfil, postLogin, postLogout, postRefrescar } from './controlador';

export const rutasAuth = Router();

/**
 * Límite de intentos de login por IP.
 *
 * Sin esto, el formulario de login es un oráculo para probar contraseñas a
 * velocidad de red. El límite cuenta solo los intentos fallidos, así que quien
 * entra bien no consume cupo.
 */
const limiteLogin = rateLimit({
  windowMs: config.minutosVentanaLogin * 60_000,
  limit: config.intentosLogin,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos de inicio de sesión. Esperá unos minutos y volvé a probar.',
    codigo: 'DEMASIADOS_INTENTOS',
  },
});

rutasAuth.post('/login', limiteLogin, validarCuerpo(esquemaLogin), postLogin);
rutasAuth.post('/refrescar', postRefrescar);
rutasAuth.post('/logout', postLogout);
rutasAuth.get('/perfil', requiereSesion, getPerfil);
