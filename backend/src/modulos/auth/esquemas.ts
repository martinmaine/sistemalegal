import { z } from 'zod';

/**
 * Esquemas de entrada del módulo de autenticación.
 *
 * Los mensajes están redactados para mostrarse tal cual en el formulario: el
 * usuario no tiene por qué leer jerga de validación.
 */

export const esquemaLogin = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escribí tu correo electrónico.')
    .pipe(z.email('Ese correo no parece válido.'))
    .transform((valor) => valor.toLowerCase()),
  password: z.string().min(1, 'Escribí tu contraseña.'),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;
