import { useCallback, useState } from 'react';
import { ErrorApi } from '../servicios/api';

/**
 * Errores de un formulario.
 *
 * El backend devuelve los errores con el mismo nombre que tienen los campos
 * del formulario, así que la traducción es directa. Lo que no es directo es
 * todo lo demás —distinguir el error de un campo del error general, borrar el
 * error de un campo cuando el usuario lo corrige, no tragarse un fallo de
 * red— y eso es igual en todos los formularios del producto.
 *
 * Tenerlo acá evita que cada pantalla lo reimplemente, que es como terminan
 * apareciendo formularios que fallan en silencio.
 */
export function useErroresFormulario() {
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string>();

  const limpiar = useCallback(() => {
    setErrores({});
    setErrorGeneral(undefined);
  }, []);

  /**
   * Borra el error de un campo.
   *
   * Se llama al editarlo: dejarlo en rojo mientras el usuario lo está
   * corrigiendo es ruido, y hace parecer que la corrección no sirvió.
   */
  const limpiarCampo = useCallback((campo: string) => {
    setErrores((previos) => {
      if (!previos[campo]) return previos;
      const siguiente = { ...previos };
      delete siguiente[campo];
      return siguiente;
    });
  }, []);

  /**
   * Traduce lo que falló a algo que el formulario pueda mostrar.
   *
   * Un ErrorApi con detalles va campo por campo. Un ErrorApi sin detalles
   * —un 409, un 403— trae un mensaje escrito para el usuario y se muestra
   * arriba. Cualquier otra cosa es una falla que no anticipamos: se muestra el
   * mensaje de reserva, porque el texto de una excepción no le dice nada a un
   * abogado.
   */
  const registrar = useCallback((fallo: unknown, mensajeDeReserva: string) => {
    if (fallo instanceof ErrorApi) {
      setErrores(fallo.detalles ?? {});
      if (!fallo.detalles) setErrorGeneral(fallo.message);
      return;
    }

    console.error('[formulario] fallo inesperado', fallo);
    setErrorGeneral(mensajeDeReserva);
  }, []);

  return { errores, errorGeneral, limpiar, limpiarCampo, registrar };
}
