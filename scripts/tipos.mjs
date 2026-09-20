/**
 * tipos.mjs — Contrato único de los tipos de diagrama soportados.
 *
 *   - build.mjs    lo inyecta tal cual dentro de index.html (por eso no debe
 *                  usar imports ni `export` más allá del primero, que se elimina).
 *   - validate.mjs lo importa directamente como módulo ESM.
 *
 * Así el visor (navegador) y la validación (Node) usan EXACTAMENTE las mismas
 * reglas para encontrar y nombrar los elementos buscables de cada diagrama.
 *
 * Estructura de cada tipo:
 *   unidad      etiqueta en singular/plural para la UI
 *   selector    selector CSS de los elementos buscables dentro del <svg>
 *   nombre(el)  nombre extraído del elemento renderizado
 *   declaradas  nombres declarados en el código fuente .mmd
 *   relaciones  cuántas relaciones declara el código fuente
 */

export const TIPOS = {
  /* ------------------------------------------------------------------
   * classDiagram — los nodos se identifican como
   *   <svgId>-classId-<NombreClase>-<contador>
   * ------------------------------------------------------------------ */
  class: {
    unidad: 'clases',
    selector: 'g.node',
    nombre(nodo) {
      const id = nodo.getAttribute('id') || '';
      const m = id.match(/classId-(.+?)-\d+$/) || id.match(/classId-(.+)$/);
      if (m && /^[A-Za-z_][A-Za-z0-9_]*$/.test(m[1])) return m[1];
      return primerTexto(nodo);
    },
    declaradas(codigo) {
      const out = [];
      for (const m of codigo.matchAll(/^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/gm)) {
        if (!out.includes(m[1])) out.push(m[1]);
      }
      return out;
    },
    relaciones(codigo) {
      return lineas(codigo).filter((l) => /(<\|--|--\|>|\*--|--\*|o--|--o|\.\.>|<\.\.|-->|<--)/.test(l)).length;
    }
  },

  /* ------------------------------------------------------------------
   * stateDiagram-v2 — los nodos se identifican como
   *   <svgId>-state-<NombreEstado>-<contador>
   * Los estados compuestos llevan la clase `statediagram-cluster`; los
   * pseudostados (inicio/fin) no llevan `statediagram-state` y se ignoran.
   * ------------------------------------------------------------------ */
  state: {
    unidad: 'estados',
    selector: 'g.statediagram-state',
    nombre(nodo) {
      const m = (nodo.getAttribute('id') || '').match(/state-(.+?)-\d+$/);
      return m ? m[1] : '';
    },
    declaradas(codigo) {
      const out = [];
      const add = (n) => { if (n && n !== '[*]' && !out.includes(n)) out.push(n); };
      for (const m of codigo.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*-->\s*([A-Za-z_][A-Za-z0-9_]*)/gm)) {
        add(m[1]); add(m[2]);
      }
      for (const m of codigo.matchAll(/^\s*state\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm)) add(m[1]);
      return out;
    },
    relaciones(codigo) {
      return lineas(codigo).filter((l) => l.includes('-->')).length;
    }
  },

  /* ------------------------------------------------------------------
   * sequenceDiagram — los participantes se dibujan como
   *   <g id="root-N"><text>Alias</text></g>
   * y los actores como <g class="actor-man actor-top"><text.actor>.
   * Se toma solo el actor superior para no duplicar el contador.
   * ------------------------------------------------------------------ */
  sequence: {
    unidad: 'participantes',
    selector: 'g[id^="root-"], g.actor-top',
    nombre(nodo) {
      return primerTexto(nodo);
    },
    declaradas(codigo) {
      const out = [];
      for (const m of codigo.matchAll(/^\s*(?:participant|actor)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+as\s+(.+?))?\s*$/gm)) {
        const nombre = (m[2] || m[1]).trim();
        if (nombre && !out.includes(nombre)) out.push(nombre);
      }
      return out;
    },
    relaciones(codigo) {
      return lineas(codigo).filter((l) => /(-{1,2}>>?|-{1,2}x)/.test(l) && !l.startsWith('participant') && !l.startsWith('actor')).length;
    }
  }
};

/** Devuelve el tipo de diagrama a partir de su primera línea significativa. */
export function detectarTipo(codigo) {
  const primera = (lineas(codigo)[0] || '').toLowerCase();
  if (primera.startsWith('classdiagram')) return 'class';
  if (primera.startsWith('statediagram')) return 'state';
  if (primera.startsWith('sequencediagram')) return 'sequence';
  return 'class';
}

/** Líneas sin comentarios ni vacías. */
function lineas(codigo) {
  return codigo
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('%%'));
}

/** Primer texto visible de un nodo, ignorando anotaciones del tipo <<abstract>>. */
function primerTexto(nodo) {
  for (const t of nodo.querySelectorAll('text')) {
    const s = (t.textContent || '').trim().replace(/\s+/g, ' ');
    if (s && !s.startsWith('<<')) return s;
  }
  return '';
}
