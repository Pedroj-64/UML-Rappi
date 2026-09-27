#!/usr/bin/env node
/**
 * build.mjs — Genera `index.html` a partir de:
 *   - diagrams/*.mmd                 (fuente de verdad de los diagramas)
 *   - templates/viewer.template.html (layout + lógica del visor)
 *   - scripts/tipos.mjs              (contrato de tipos de diagrama)
 *
 * Uso:  node build.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIPOS, detectarTipo } from './scripts/tipos.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIAGRAMS_DIR = join(ROOT, 'diagrams');
const TEMPLATE = join(ROOT, 'templates', 'viewer.template.html');
const TIPOS_MODULE = join(ROOT, 'scripts', 'tipos.mjs');
const OUTPUT = join(ROOT, 'index.html');

const SECCION_CLASES = 'Diagramas de clases';
const SECCION_ESTADOS = 'Diagramas de estados';
const SECCION_SECUENCIA = 'Diagramas de secuencia';

/** Metadatos de presentación de cada diagrama (el orden lo marca el nombre del archivo). */
const META = {
  '00-general.mmd': {
    id: 'general',
    seccion: SECCION_CLASES,
    titulo: 'Vista general de UrbanEats',
    descripcion: 'Los 4 procesos manuales en un lienzo: catálogo en papel, comanda, despacho, caja y encuestas.'
  },
  '01-personal.mmd': {
    id: 'personal',
    seccion: SECCION_CLASES,
    titulo: 'Personas, roles y sedes',
    descripcion: 'Cliente, contacto del restaurante y todo el personal del centro de operaciones y puntos de contacto.'
  },
  '02-catalogo.mmd': {
    id: 'catalogo',
    seccion: SECCION_CLASES,
    titulo: 'Catálogo físico y pizarra de menús',
    descripcion: 'Proceso 1: folletos, listas a mano y confirmaciones verbales que alimentan el catálogo maestro.'
  },
  '03-pedidos.mmd': {
    id: 'pedidos',
    seccion: SECCION_CLASES,
    titulo: 'Toma y registro manual de pedidos',
    descripcion: 'Proceso 2: llamada o visita, comanda de papel numerada y sellada, pago contra entrega y copias.'
  },
  '04-despacho.mmd': {
    id: 'despacho',
    seccion: SECCION_CLASES,
    titulo: 'Preparación y despacho logístico',
    descripcion: 'Proceso 3: aviso a cocina, mapa trazado a bolígrafo, asignación en persona y recibo firmado.'
  },
  '05-caja.mmd': {
    id: 'caja',
    seccion: SECCION_CLASES,
    titulo: 'Cuadre de caja',
    descripcion: 'Proceso 4: rendición del repartidor, comisiones, libro de caja, sobres y arqueo diario.'
  },
  '06-calidad.mmd': {
    id: 'calidad',
    seccion: SECCION_CLASES,
    titulo: 'Encuestas de satisfacción y viabilidad',
    descripcion: 'Proceso 4: muestra diaria, llamadas de seguimiento, encuestas archivadas e informes de análisis.'
  },
  '07-estados-comanda.mmd': {
    id: 'estado-comanda',
    seccion: SECCION_ESTADOS,
    titulo: 'Ciclo de vida de la comanda',
    descripcion: 'De RECIBIDA a LIQUIDADA, con no entrega, reintento y anulación. Refleja el enum EstadoComanda.'
  },
  '08-estados-envio.mmd': {
    id: 'estado-envio',
    seccion: SECCION_ESTADOS,
    titulo: 'Ciclo de vida del envío',
    descripcion: 'Asignación en persona, ruta con mapa de papel (estado compuesto), entrega y rendición en la base.'
  },
  '09-secuencia-tomar-pedido.mmd': {
    id: 'seq-tomar-pedido',
    seccion: SECCION_SECUENCIA,
    titulo: 'Tomar un pedido por teléfono',
    descripcion: 'Lectura del menú, dictado, total en efectivo, número de talonario, sello de hora y entrega a logística.'
  },
  '10-secuencia-despacho.mmd': {
    id: 'seq-despacho',
    seccion: SECCION_SECUENCIA,
    titulo: 'Despachar y entregar',
    descripcion: 'Aviso a cocina por teléfono o mensajero, ruta trazada, repartidor en fila, cobro y firma.'
  },
  '11-secuencia-cuadre-caja.mmd': {
    id: 'seq-cuadre-caja',
    seccion: SECCION_SECUENCIA,
    titulo: 'Cuadre de caja y encuesta',
    descripcion: 'Rendición, cálculo de comisiones, libro de caja, sobres, cierre del día y llamadas de satisfacción.'
  }
};

function readDiagram(file) {
  const raw = readFileSync(join(DIAGRAMS_DIR, file), 'utf8');
  const tipo = detectarTipo(raw);
  const contrato = TIPOS[tipo];
  const meta = META[file] || {};
  const base = file.replace(/\.mmd$/, '').replace(/^\d+-/, '');

  return {
    id: meta.id || base,
    seccion: meta.seccion || 'Otros diagramas',
    titulo: meta.titulo || base,
    descripcion: meta.descripcion || '',
    archivo: file,
    tipo,
    code: raw.trim(),
    unidades: contrato.declaradas(raw),
    relaciones: contrato.relaciones(raw)
  };
}

function main() {
  const files = readdirSync(DIAGRAMS_DIR).filter((f) => f.endsWith('.mmd')).sort();
  if (!files.length) {
    console.error('✖ No se encontraron archivos .mmd en diagrams/');
    process.exit(1);
  }

  const diagrams = files.map(readDiagram);

  // Elementos únicos por tipo de diagrama (una clase puede repetirse entre dominios).
  const unicos = (tipo) => {
    const set = new Set();
    diagrams.filter((d) => d.tipo === tipo).forEach((d) => d.unidades.forEach((u) => set.add(u)));
    return set.size;
  };

  const data = {
    generadoEn: new Date().toISOString(),
    totalClasses: unicos('class'),
    totalEstados: unicos('state'),
    totalParticipantes: unicos('sequence'),
    totalRels: diagrams.reduce((a, d) => a + d.relaciones, 0),
    diagrams
  };

  // El contrato de tipos se inyecta sin el `export` para que quede dentro del
  // <script type="module"> del visor.
  const tipos = readFileSync(TIPOS_MODULE, 'utf8').replace(/^export\s+(?=const|function)/gm, '');

  const template = readFileSync(TEMPLATE, 'utf8');
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  const html = template.replace('__DATA__', json).replace('__TIPOS__', tipos);

  writeFileSync(OUTPUT, html, 'utf8');

  console.log(`✔ index.html generado  (${(html.length / 1024).toFixed(1)} KB)`);
  console.log(
    `  ${diagrams.length} diagramas · ${data.totalClasses} clases · ` +
    `${data.totalEstados} estados · ${data.totalParticipantes} participantes · ${data.totalRels} relaciones`
  );

  let seccion = null;
  for (const d of diagrams) {
    if (d.seccion !== seccion) { seccion = d.seccion; console.log(`  ${seccion}`); }
    const u = TIPOS[d.tipo].unidad;
    console.log(`   • ${d.titulo.padEnd(36)} ${String(d.unidades.length).padStart(3)} ${u.padEnd(13)} ${String(d.relaciones).padStart(3)} rel.`);
  }
}

main();
