import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Search, User } from 'lucide-react';
import { api, consulta } from '../../servicios/api';
import { useSesion } from '../../modulos/auth/ContextoSesion';
import type { CausaListada, Pagina, PersonaListada } from '../../tipos/api';
import { Cargando, Vacio } from '../ui/Estados';

/**
 * Búsqueda global (Ctrl+K / ⌘K).
 *
 * Consulta los mismos endpoints que los listados, así que respeta los permisos
 * del usuario sin ninguna lógica extra: si la API no le deja ver personas, la
 * búsqueda no devuelve personas. No hay una ruta de búsqueda paralela que
 * pudiera filtrar distinto.
 */

interface Resultado {
  tipo: 'causa' | 'persona';
  id: string;
  titulo: string;
  detalle: string;
  ruta: string;
}

export function BusquedaGlobal({ abierta, alCerrar }: { abierta: boolean; alCerrar: () => void }) {
  const [texto, setTexto] = useState('');
  const [termino, setTermino] = useState('');
  const [resaltado, setResaltado] = useState(0);
  const navegar = useNavigate();
  const { puede } = useSesion();
  const entrada = useRef<HTMLInputElement>(null);

  // Retardo: se busca cuando el usuario deja de tipear, no en cada tecla.
  useEffect(() => {
    const reloj = setTimeout(() => setTermino(texto.trim()), 250);
    return () => clearTimeout(reloj);
  }, [texto]);

  useEffect(() => {
    if (abierta) {
      setTexto('');
      setTermino('');
      setResaltado(0);
      // El foco se pide en el siguiente cuadro, cuando el campo ya está en el DOM.
      requestAnimationFrame(() => entrada.current?.focus());
    }
  }, [abierta]);

  const puedeVerCausas = puede('causa.ver');
  const puedeVerPersonas = puede('persona.ver');

  const { data, isFetching } = useQuery({
    queryKey: ['busqueda-global', termino, puedeVerCausas, puedeVerPersonas],
    enabled: abierta && termino.length >= 2,
    queryFn: async (): Promise<Resultado[]> => {
      const [causas, personas] = await Promise.all([
        puedeVerCausas
          ? api.obtener<Pagina<CausaListada>>(`/api/causas${consulta({ busqueda: termino, tamano: 5 })}`)
          : Promise.resolve(undefined),
        puedeVerPersonas
          ? api.obtener<Pagina<PersonaListada>>(`/api/personas${consulta({ busqueda: termino, tamano: 5 })}`)
          : Promise.resolve(undefined),
      ]);

      return [
        ...(causas?.datos ?? []).map<Resultado>((causa) => ({
          tipo: 'causa',
          id: causa.id,
          titulo: causa.caratula,
          detalle: [causa.numero_expediente ?? 'Sin radicar', causa.fuero, causa.estado].join(' · '),
          ruta: `/expedientes/${causa.id}`,
        })),
        ...(personas?.datos ?? []).map<Resultado>((persona) => ({
          tipo: 'persona',
          id: persona.id,
          titulo: persona.nombre_completo,
          detalle: [persona.documento ?? persona.cuit_cuil ?? 'Sin documento', persona.email]
            .filter(Boolean)
            .join(' · '),
          ruta: `/clientes/${persona.id}`,
        })),
      ];
    },
  });

  const resultados = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    setResaltado(0);
  }, [resultados]);

  if (!abierta) return null;

  function abrir(resultado: Resultado) {
    navegar(resultado.ruta);
    alCerrar();
  }

  function alPresionar(evento: React.KeyboardEvent) {
    if (evento.key === 'Escape') {
      alCerrar();
      return;
    }
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setResaltado((indice) => Math.min(indice + 1, resultados.length - 1));
      return;
    }
    if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setResaltado((indice) => Math.max(indice - 1, 0));
      return;
    }
    if (evento.key === 'Enter') {
      evento.preventDefault();
      const elegido = resultados[resaltado];
      if (elegido) abrir(elegido);
    }
  }

  return createPortal(
    <div
      className="capa-fondo"
      style={{ alignItems: 'flex-start', paddingTop: '12vh' }}
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Búsqueda global"
        style={{ maxWidth: 580 }}
      >
        <div className="buscador" style={{ padding: 'var(--esp-3) var(--esp-4)' }}>
          <Search size={17} className="buscador__icono" style={{ left: 'var(--esp-7)' }} aria-hidden />
          <input
            ref={entrada}
            type="text"
            className="entrada"
            style={{ border: 'none', boxShadow: 'none', fontSize: 'var(--texto-md)' }}
            placeholder="Buscar expedientes y personas…"
            aria-label="Buscar expedientes y personas"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={alPresionar}
            // El combobox le dice al lector de pantalla que esto tiene
            // resultados asociados y cuál está resaltado.
            role="combobox"
            aria-expanded={resultados.length > 0}
            aria-controls="resultados-busqueda"
            aria-activedescendant={resultados[resaltado] ? `resultado-${resaltado}` : undefined}
          />
        </div>

        <div
          id="resultados-busqueda"
          role="listbox"
          aria-label="Resultados"
          style={{ borderTop: '1px solid var(--borde)', maxHeight: '52vh', overflowY: 'auto' }}
        >
          {termino.length < 2 && (
            <p className="estado__texto" style={{ padding: 'var(--esp-6)', textAlign: 'center' }}>
              Escribí al menos dos letras para buscar por carátula, número de expediente, nombre,
              documento o correo.
            </p>
          )}

          {termino.length >= 2 && isFetching && <Cargando texto="Buscando…" />}

          {termino.length >= 2 && !isFetching && resultados.length === 0 && (
            <Vacio titulo="Sin resultados" texto={`No encontramos nada que coincida con «${termino}».`} />
          )}

          {resultados.map((resultado, indice) => (
            <button
              key={`${resultado.tipo}-${resultado.id}`}
              id={`resultado-${indice}`}
              type="button"
              role="option"
              aria-selected={indice === resaltado}
              className="lista__item"
              style={{
                width: '100%',
                textAlign: 'left',
                background: indice === resaltado ? 'var(--superficie-hover)' : undefined,
              }}
              onMouseEnter={() => setResaltado(indice)}
              onClick={() => abrir(resultado)}
            >
              <span className="indicador__icono" style={{ width: 30, height: 30 }} aria-hidden>
                {resultado.tipo === 'causa' ? <FolderOpen size={15} /> : <User size={15} />}
              </span>
              <span className="lista__cuerpo">
                <span className="lista__titulo">{resultado.titulo}</span>
                <span className="lista__meta">{resultado.detalle}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
