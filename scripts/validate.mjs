#!/usr/bin/env node
/**
 * validate.mjs — Valida diagrams/*.mmd en dos niveles:
 *
 *   1. SINTÁXIS : el diagrama compila con el parser oficial de Mermaid.
 *   2. RENDER   : se renderiza en jsdom y se comprueba que
 *                 a) no se generan <foreignObject> (romperían el export a PNG), y
 *                 b) el visor puede extraer el nombre de cada elemento declarado
 *                    desde el DOM — es lo que usan la búsqueda y el clic.
 *
 * Las reglas de extracción viven en scripts/tipos.mjs, que build.mjs inyecta
 * en index.html. Así el visor y esta validación no pueden desincronizarse.
 *
 * Uso:  node scripts/validate.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { TIPOS, detectarTipo } from './tipos.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIAGRAMS_DIR = join(ROOT, 'diagrams');

/* ---------------- DOM mínimo para ejecutar Mermaid en Node ---------------- */
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/'
});
const { window } = dom;

if (!globalThis.CSSStyleSheet) {
  class CSSStyleSheetShim {
    constructor() { this.cssRules = []; this._text = ''; }
    replaceSync(t) { this._text = t; }
    replace(t) { this._text = t; return Promise.resolve(this); }
    insertRule(r) { this.cssRules.push(r); return this.cssRules.length - 1; }
    get cssText() { return this._text; }
  }
  globalThis.CSSStyleSheet = CSSStyleSheetShim;
  window.CSSStyleSheet = CSSStyleSheetShim;
}

for (const key of [
  'window', 'document', 'DOMParser', 'XMLSerializer', 'HTMLElement', 'SVGElement',
  'Element', 'Node', 'NodeList', 'MutationObserver', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame', 'CSSStyleDeclaration'
]) {
  if (window[key] !== undefined) globalThis[key] = window[key];
}
for (const key of ['navigator', 'location', 'localStorage', 'matchMedia']) {
  if (window[key] !== undefined) {
    try { Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true }); }
    catch { /* global de solo lectura */ }
  }
}
// jsdom no implementa la medición de SVG.
const proto = window.SVGElement.prototype;
proto.getBBox = () => ({ x: 0, y: 0, width: 140, height: 26 });
proto.getComputedTextLength = () => 140;
proto.getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse() { return this; } });
proto.getCTM = proto.getScreenCTM;

/* ------------------------------ Mermaid ---------------------------------- */
const mermaid = (await import('mermaid')).default;
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  htmlLabels: false,          // igual que en el visor
  theme: 'dark',
  class: { useMaxWidth: false }
});

/* --------------------------------- Run ----------------------------------- */
const files = readdirSync(DIAGRAMS_DIR).filter((f) => f.endsWith('.mmd')).sort();
let failed = 0;

for (const file of files) {
  const code = readFileSync(join(DIAGRAMS_DIR, file), 'utf8');
  const slug = file.replace(/\.mmd$/, '');
  const tipo = detectarTipo(code);
  const contrato = TIPOS[tipo];

  try {
    await mermaid.parse(code);
  } catch (err) {
    failed++;
    console.error(`✖ ${file}  — error de sintaxis`);
    console.error('   ' + (err?.message || String(err)).split('\n').slice(0, 4).join('\n   '));
    continue;
  }

  const declarados = contrato.declaradas(code);

  let svg;
  try {
    ({ svg } = await mermaid.render('uml-svg-' + slug, code));
  } catch (err) {
    failed++;
    console.error(`✖ ${file}  — error al renderizar: ${err?.message || err}`);
    continue;
  }

  window.document.body.innerHTML = svg;
  const nodos = [...window.document.querySelectorAll(contrato.selector)];
  const conNombre = nodos.map((n) => contrato.nombre(n)).filter(Boolean);
  const foreign = window.document.querySelectorAll('foreignObject').length;
  const faltantes = declarados.filter((d) => !conNombre.includes(d));

  const problemas = [];
  if (foreign) problemas.push(`${foreign} <foreignObject> (rompe el export a PNG)`);
  if (nodos.length !== declarados.length) {
    problemas.push(`${nodos.length} nodos renderizados vs ${declarados.length} ${contrato.unidad} declarados`);
  }
  if (faltantes.length) problemas.push(`sin nombre extraíble: ${faltantes.join(', ')}`);

  if (problemas.length) {
    failed++;
    console.error(`✖ ${file}  [${tipo}]`);
    problemas.forEach((p) => console.error(`   · ${p}`));
  } else {
    console.log(`✔ ${file}  [${tipo}]  ${nodos.length} ${contrato.unidad}`);
  }
}

console.log(`\n${files.length - failed}/${files.length} diagramas OK`);
process.exit(failed ? 1 : 0);
