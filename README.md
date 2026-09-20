# Rappi · Diagramas UML

Modelo de dominio de la empresa **Rappi** en **Mermaid**, presentado en un visor web de
un solo archivo. Cubre tres vistas complementarias: **clases**, **estados** y **secuencia**.

## Estructura

```
.
├── diagrams/                       # Fuente de verdad: un archivo Mermaid por vista
│   │
│   │  ── Diagramas de clases ──
│   ├── 00-general.mmd              # Vista general de toda la empresa
│   ├── 01-usuarios.mmd             # Usuarios, cuentas y acceso
│   ├── 02-catalogo.mmd             # Comercios, menús, productos, inventario
│   ├── 03-pedidos.mmd              # Carrito y pedido (Order)
│   ├── 04-logistica.mmd            # Reparto, zonas, vehículos, rutas, turnos
│   ├── 05-pagos.mmd                # Pagos, RappiPay, reembolsos, liquidaciones
│   ├── 06-promociones.mmd          # Promociones, Rappi Prime, lealtad
│   ├── 07-soporte.mmd              # Soporte, reseñas, incidentes, notificaciones
│   │
│   │  ── Diagramas de estados ──
│   ├── 08-estados-pedido.mmd       # Ciclo de vida del pedido (OrderStatus)
│   ├── 09-estados-entrega.mmd      # Ciclo de vida de la entrega (DeliveryStatus)
│   │
│   │  ── Diagramas de secuencia ──
│   ├── 10-secuencia-crear-pedido.mmd
│   ├── 11-secuencia-asignar-repartidor.mmd
│   └── 12-secuencia-procesar-pago.mmd
│
├── templates/viewer.template.html  # Plantilla del visor (layout, estilos y lógica)
├── scripts/
│   ├── tipos.mjs                   # Contrato de tipos de diagrama (compartido)
│   └── validate.mjs                # Valida sintaxis + render de los 13 diagramas
├── build.mjs                       # Inyecta diagramas y tipos en la plantilla → index.html
└── index.html                      # Página final, autocontenida (generada)
```

## Uso

```bash
npm install         # dependencias solo para validar (jsdom + mermaid)

npm run build       # regenera index.html desde diagrams/*.mmd
npm run validate    # comprueba que los 13 diagramas compilan y renderizan
npm run verify      # ambas cosas
```

Estado actual: **13/13 diagramas OK** — 71 clases, 20 estados, 17 participantes y 227 relaciones.

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
  de participante que usan los enums y clases de los diagramas de clases (`OrderStatus`,
  `DeliveryStatus`, `AssignmentState`), para que el modelo sea coherente entre vistas.

## Editar el modelo

1. Modifica el `.mmd` correspondiente, o añade uno nuevo a `diagrams/`.
2. Si añades un archivo, regístralo en el mapa `META` de `build.mjs` para darle sección,
   título y descripción.
3. Ejecuta `npm run verify` y recarga `index.html`.
