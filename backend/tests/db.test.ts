import { describe, it, expect } from 'vitest';
import { sinSslmode } from '../src/db';

/**
 * `sinSslmode` existe por un comportamiento de `pg` que ya nos costó una tarde:
 * el `sslmode` de la URL pisa el objeto `ssl` del Pool y descarta la CA. Si
 * alguien lo "simplifica" en el futuro, estas pruebas lo frenan.
 */

describe('sinSslmode', () => {
  it('quita el sslmode cuando es el único parámetro', () => {
    expect(sinSslmode('postgresql://u:c@host:5432/db?sslmode=require')).toBe(
      'postgresql://u:c@host:5432/db',
    );
  });

  it('conserva los demás parámetros', () => {
    expect(sinSslmode('postgresql://u:c@host:5432/db?sslmode=require&application_name=api')).toBe(
      'postgresql://u:c@host:5432/db?application_name=api',
    );
    expect(sinSslmode('postgresql://u:c@host:5432/db?application_name=api&sslmode=verify-full')).toBe(
      'postgresql://u:c@host:5432/db?application_name=api',
    );
  });

  it('deja intacta una cadena sin sslmode', () => {
    const url = 'postgresql://u:c@host:5432/db';
    expect(sinSslmode(url)).toBe(url);
  });

  it('no toca el usuario ni la contraseña', () => {
    // Una contraseña con caracteres que una reescritura de la URL re-codificaría.
    const url = 'postgresql://postgres.abc:Cl4ve-con_simbolos.y%40rroba@host:5432/db?sslmode=require';
    expect(sinSslmode(url)).toBe(
      'postgresql://postgres.abc:Cl4ve-con_simbolos.y%40rroba@host:5432/db',
    );
  });

  it('no se confunde con un parámetro que apenas se parece', () => {
    const url = 'postgresql://u:c@host:5432/db?sslmode_extra=1';
    expect(sinSslmode(url)).toBe(url);
  });
});
