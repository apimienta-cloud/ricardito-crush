# Ricardito Crush

Juego match-3 (estilo Candy Crush) de **Ricardito**, la golosina uruguaya de Chocolates Haas.
*Chocolate por fuera, merengue de corazón.*

Es un sitio estático: HTML, CSS y JavaScript puro, sin dependencias ni build. Funciona en celular y escritorio.

## Cómo probarlo

Abrí `index.html` directamente en el navegador, o levantá un servidor local:

```bash
python -m http.server 8765
```

y entrá a <http://localhost:8765>.

Atajos para desarrollo (por URL):

- `?level=7` abre directo el nivel 7.
- `?unlock=1` desbloquea todos los niveles.

## Cómo se juega

- Deslizá (o tocá dos fichas vecinas) para intercambiar Ricarditos y juntar 3 o más iguales.
- Cada nivel tiene un objetivo y un límite de movimientos: llegar a un puntaje, juntar N Ricarditos de un sabor o comer todas las obleas.
- Especiales:
  - **4 en línea** → Ricardito **Rayado** (↔ / ↕): limpia una fila o columna.
  - **L o T** → Ricardito **Misterio** (???): explota 3x3.
  - **5 en línea** → **Caja Ricardito**: se intercambia con cualquier ficha y elimina todo ese sabor.
  - Combinar dos especiales entre sí genera efectos mayores (cruz, 3 filas + 3 columnas, 5x5, tablero entero).
- El progreso y las estrellas se guardan en el navegador (`localStorage`).

## Estructura

```
index.html        pantallas (inicio, mapa, juego, modales)
css/style.css     estilos y animaciones
js/levels.js      sabores, mundos y los 15 niveles (fácil de editar)
js/game.js        motor match-3: tablero, gravedad, especiales, objetivos
assets/           logo vectorial, fondos, fichas por sabor y decoraciones
imagenes/         material original de la marca (no lo usa el juego)
```

## Sabores en juego

Clásico, Menta, Pasión (frutilla), Halloween, Celeste y Dubai (pistacho).
Las fichas se generaron a partir del recorte fotográfico del Ricardito Menta, recoloreando el merengue por sabor.

## Agregar o editar niveles

Editá `js/levels.js`. Cada nivel define tamaño, sabores, movimientos, objetivo, puntajes para las estrellas y, opcionalmente, una forma de tablero (`mask`) y obleas (`oblea`). Los huecos del `mask` solo pueden ir arriba o abajo de cada columna.

## Publicar

Es estático: se puede subir tal cual a GitHub Pages, Netlify o cualquier hosting.
