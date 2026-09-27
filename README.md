# UrbanEats · Diagramas UML

Modelo de dominio de **UrbanEats**, una empresa de domicilios de comida con la misma idea
que Rappi pero operada **sin tecnología**: catálogo de menús en papel, pedidos por teléfono
fijo o en un punto de contacto físico, despacho con mapa impreso y cobro en efectivo.
Está escrito en **Mermaid** y se presenta en un visor web de un solo archivo. Cubre tres
vistas complementarias: **clases**, **estados** y **secuencia**.

## Procesos que modela

| # | Proceso | Diagrama de clases | Estados / secuencia |
| --- | --- | --- | --- |
| 1 | Gestión de catálogos físicos y pizarra de menús | `02-catalogo` | — |
| 2 | Toma y registro manual de pedidos | `03-pedidos` | `07`, `09` |
| 3 | Coordinación de preparación y despacho | `04-despacho` | `08`, `10` |
| 4 | Cuadre de caja y encuestas de satisfacción | `05-caja`, `06-calidad` | `11` |

`00-general` junta los cuatro procesos y `01-personal` define a todos los actores.

### Decisiones de modelado

- **Identificadores físicos, no de sistema.** No hay `UUID`: la comanda se identifica por
  su `numeroOrden` (tomado de un `TalonarioComandas`), los asientos por su `folio` en el
  `LibroCaja`, los empleados por su `codigoEmpleado`.
- **Solo efectivo.** `PagoContraEntrega` guarda con cuánto paga el cliente y si necesita
  cambio; el dinero se reparte en tres `Sobre` (`PAGO_RESTAURANTE`, `COMISION_URBANEATS`,
  `PAGO_REPARTIDOR`).
- **Todo documento de papel es una clase**: `FuenteMenu` (folleto, lista a mano, foto,
  confirmación verbal), `Comanda` y sus `CopiaComanda`, `MapaRuta`, `ReciboEntrega`,
  `AsientoContable`, `EncuestaSatisfaccion`.
- **Una comanda = un restaurante.** Si el cliente quiere de dos restaurantes, se escriben
  dos comandas.
- Los estados de `EstadoComanda` y `EstadoEnvio` son exactamente los de los diagramas de
  estados `07` y `08`, y los participantes de las secuencias usan los mismos nombres.

## Estructura

```
.
├── diagrams/                       # Fuente de verdad: un archivo Mermaid por vista
│   │
│   │  ── Diagramas de clases ──
│   ├── 00-general.mmd              # Vista general de UrbanEats
│   ├── 01-personal.mmd             # Personas, roles, centro de operaciones
│   ├── 02-catalogo.mmd             # Proceso 1: catálogo maestro y pizarra
│   ├── 03-pedidos.mmd              # Proceso 2: comanda de papel
│   ├── 04-despacho.mmd             # Proceso 3: aviso a cocina, envío, mapa, recibo
│   ├── 05-caja.mmd                 # Proceso 4: liquidación, libro de caja, sobres
│   ├── 06-calidad.mmd              # Proceso 4: encuestas e informes
│   │
│   │  ── Diagramas de estados ──
│   ├── 07-estados-comanda.mmd      # Ciclo de vida de la comanda (EstadoComanda)
│   ├── 08-estados-envio.mmd        # Ciclo de vida del envío (EstadoEnvio)
│   │
│   │  ── Diagramas de secuencia ──
│   ├── 09-secuencia-tomar-pedido.mmd
│   ├── 10-secuencia-despacho.mmd
│   └── 11-secuencia-cuadre-caja.mmd
│
├── templates/viewer.template.html  # Plantilla del visor (layout, estilos y lógica)
├── scripts/
│   ├── tipos.mjs                   # Contrato de tipos de diagrama (compartido)
│   └── validate.mjs                # Valida sintaxis + render de los 12 diagramas
├── build.mjs                       # Inyecta diagramas y tipos en la plantilla → index.html
└── index.html                      # Página final, autocontenida (generada)
```

## Uso

```bash
npm install         # dependencias solo para validar (jsdom + mermaid)

npm run build       # regenera index.html desde diagrams/*.mmd
npm run validate    # comprueba que los 12 diagramas compilan y renderizan
npm run verify      # ambas cosas
```

Estado actual: **12/12 diagramas OK** — 71 clases, 20 estados, 17 participantes y 237 relaciones.

Luego abre `index.html` en el navegador (doble clic basta, no necesita servidor).

> Mermaid se carga desde CDN (jsdelivr, con respaldo en unpkg y esm.sh), así que la
> página necesita conexión a internet.

## Funciones del visor

| Función | Cómo |
| --- | --- |
| Navegar | Menú lateral agrupado por tipo de diagrama |
| Zoom | Rueda del ratón, botones `+` / `−`, teclas `+` / `-` |
| Mover | Arrastrar; doble clic o `F` para ajustar; `0` para restablecer |
| Buscar | Campo de búsqueda o tecla `/`; cuenta coincidencias por diagrama |
| Aislar | Casilla «Aislar» para ocultar lo que no coincide |
| Foco rápido | Clic sobre cualquier clase, estado o participante |
| Exportar | Botones `PNG` (2×) y `SVG` del diagrama actual |
| Tema | Botón `◐` (claro / oscuro, se recuerda en `localStorage`) |
| Saltar al siguiente diagrama con resultados | `Enter` en el buscador |

## Cómo funciona el visor con tres tipos de diagrama

Cada tipo tiene su propia forma de encontrar y nombrar los elementos buscables, porque
Mermaid los renderiza distinto:

| Tipo | Selector | Nombre desde |
| --- | --- | --- |
| `classDiagram` | `g.node` | id `…-classId-<Clase>-<n>` |
| `stateDiagram-v2` | `g.statediagram-state` | id `…-state-<Estado>-<n>` |
| `sequenceDiagram` | `g[id^="root-"], g.actor-top` | texto visible (alias del participante) |

Ese contrato vive **solo** en `scripts/tipos.mjs`. `build.mjs` lo inyecta dentro de
`index.html` y `scripts/validate.mjs` lo importa, así que el visor y la validación no
pueden desincronizarse.

## Notas técnicas

- **`htmlLabels: false` es obligatorio.** Sin eso Mermaid dibuja las etiquetas dentro de
  `<foreignObject>` y los navegadores se niegan a rasterizarlas al exportar SVG a PNG
  (saldría el diagrama sin texto). `npm run validate` falla si algún diagrama vuelve a
  introducir `<foreignObject>`.
- Los pseudostados de inicio/fin de los diagramas de estados no llevan la clase
  `statediagram-state`, así que quedan fuera de la búsqueda automáticamente.
- Los diagramas de estados y secuencia se documentan con los mismos nombres de estado y
  de participante que usan los enums y clases de los diagramas de clases (`EstadoComanda`,
  `EstadoEnvio`), para que el modelo sea coherente entre vistas.

## Editar el modelo

1. Modifica el `.mmd` correspondiente, o añade uno nuevo a `diagrams/`.
2. Si añades un archivo, regístralo en el mapa `META` de `build.mjs` para darle sección,
   título y descripción.
3. Ejecuta `npm run verify` y recarga `index.html`.
