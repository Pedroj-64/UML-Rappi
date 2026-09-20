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
    titulo: 'Vista general de la empresa',
    descripcion: 'Todo Rappi en un lienzo: actores, comercios, pedido, reparto, pagos, crecimiento y postventa.'
  },
  '01-usuarios.mmd': {
    id: 'usuarios',
    seccion: SECCION_CLASES,
    titulo: 'Usuarios, cuentas y acceso',
    descripcion: 'Jerarquía de actores (cliente, rappitendero, comercio, colaborador), identidad, direcciones y dispositivos.'
  },
  '02-catalogo.mmd': {
    id: 'catalogo',
    seccion: SECCION_CLASES,
    titulo: 'Catálogo, comercios e inventario',
    descripcion: 'Tiendas aliadas, dark stores de Rappi Turbo, menús, productos, categorías y control de stock.'
  },
  '03-pedidos.mmd': {
    id: 'pedidos',
    seccion: SECCION_CLASES,
    titulo: 'Carrito y pedido (Order)',
    descripcion: 'Agregado central del negocio: ítems, precios, promociones, ciclo de estados y trazabilidad.'
  },
  '04-logistica.mmd': {
    id: 'logistica',
    seccion: SECCION_CLASES,
    titulo: 'Logística y reparto',
    descripcion: 'Asignación de órdenes, zonas, vehículos, rutas, turnos y seguimiento en tiempo real.'
  },
  '05-pagos.mmd': {
    id: 'pagos',
    seccion: SECCION_CLASES,
    titulo: 'Pagos, RappiPay y liquidaciones',
    descripcion: 'Medios de pago, motor transaccional, billetera, tarjeta, reembolsos, payouts y facturación.'
  },
  '06-promociones.mmd': {
    id: 'promociones',
    seccion: SECCION_CLASES,
    titulo: 'Promociones, Rappi Prime y lealtad',
    descripcion: 'Descuentos, cupones, campañas de marketing, suscripción Prime y programa de puntos.'
  },
  '07-soporte.mmd': {
    id: 'soporte',
    seccion: SECCION_CLASES,
    titulo: 'Soporte, reseñas y notificaciones',
    descripcion: 'Postventa: tickets con SLA, chat, calificaciones, incidentes operativos y motor de notificaciones.'
  },
  '08-estados-pedido.mmd': {
    id: 'estado-pedido',
    seccion: SECCION_ESTADOS,
    titulo: 'Ciclo de vida del pedido',
    descripcion: 'Desde CREADO hasta ENTREGADO, incluyendo cancelación y reembolso. Refleja el enum OrderStatus.'
  },
  '09-estados-entrega.mmd': {
    id: 'estado-entrega',
    seccion: SECCION_ESTADOS,
    titulo: 'Ciclo de vida de la entrega',
    descripcion: 'Búsqueda de repartidor (estado compuesto), recogida, tránsito, fallo con reintentos y cancelación.'
  },
  '10-secuencia-crear-pedido.mmd': {
    id: 'seq-crear-pedido',
    seccion: SECCION_SECUENCIA,
    titulo: 'Crear un pedido',
    descripcion: 'Del carrito confirmado a la tienda que acepta, con validación de stock y cálculo de total.'
  },
  '11-secuencia-asignar-repartidor.mmd': {
    id: 'seq-asignar-repartidor',
    seccion: SECCION_SECUENCIA,
    titulo: 'Asignar un repartidor',
    descripcion: 'Motor de matching, oferta al rappitendero con reintentos y tarifa por zona.'
  },
  '12-secuencia-procesar-pago.mmd': {
    id: 'seq-procesar-pago',
    seccion: SECCION_SECUENCIA,
    titulo: 'Procesar un pago',
    descripcion: 'Autorización según medio de pago, registro contable y reembolso posterior.'
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
