/* =====================================================================
   Ricardito Crush — definición de niveles
   ---------------------------------------------------------------------
   flavors : sabores disponibles en el tablero (menos sabores = más fácil)
   moves   : movimientos disponibles
   goal    : { type:'score', target }                 -> llegar a X puntos
             { type:'collect', targets:{sabor:n} }    -> juntar N Ricarditos
             { type:'oblea' }                         -> limpiar todas las obleas
   stars   : puntajes para 1, 2 y 3 estrellas
   mask    : forma del tablero ('#' celda, '.' hueco). Los huecos solo pueden
             estar arriba o abajo de cada columna (la gravedad es vertical).
   oblea   : capas de oblea por celda ('0' nada, '1' una, '2' dos)
   ===================================================================== */

const FLAVORS = {
  clasico:   { name: 'Clásico',   color: '#fff6e5', img: 'assets/tile_clasico.png' },
  menta:     { name: 'Menta',     color: '#b9f0c4', img: 'assets/tile_menta.png' },
  pasion:    { name: 'Pasión',    color: '#ff6e96', img: 'assets/tile_pasion.png' },
  halloween: { name: 'Halloween', color: '#ff8c28', img: 'assets/tile_halloween.png' },
  celeste:   { name: 'Celeste',   color: '#6ec3ff', img: 'assets/tile_celeste.png' },
  dubai:     { name: 'Dubai',     color: '#96d23c', img: 'assets/tile_dubai.png' },
};

const FIVE = ['clasico', 'menta', 'pasion', 'halloween', 'celeste'];
const SIX  = ['clasico', 'menta', 'pasion', 'halloween', 'celeste', 'dubai'];

const WORLDS = [
  { id: 'clasico', name: 'Mundo Clásico', sub: 'Chocolate por fuera, merengue de corazón', deco: 'assets/caja_3d.png',          bg: 'assets/bg_rays.jpg' },
  { id: 'menta',   name: 'Mundo Menta',   sub: 'Frescura con corazón de merengue',         deco: 'assets/tile_menta.png',       bg: 'assets/bg_spiral.jpg' },
  { id: 'pasion',  name: 'Mundo Pasión',  sub: 'Sabor frutilla, edición limitada',          deco: 'assets/logo_pasion.png',      bg: 'assets/bg_rays.jpg' },
];

// Tablero con forma de Ricardito (cono con base ancha)
const MASK_RICARDITO = [
  '...###...',
  '..#####..',
  '..#####..',
  '.#######.',
  '.#######.',
  '.#######.',
  '#########',
  '#########',
  '#########',
];

const MASK_ROUNDED = [
  '.######.',
  '########',
  '########',
  '########',
  '########',
  '########',
  '########',
  '.######.',
];

const MASK_CAJA = [
  '..#####..',
  '.#######.',
  '#########',
  '#########',
  '#########',
  '#########',
  '#########',
  '.#######.',
  '..#####..',
];

const LEVELS = [
  // ---------- Mundo Clásico ----------
  { world: 'clasico', cols: 7, rows: 7, flavors: FIVE, moves: 20,
    goal: { type: 'score', target: 1200 }, stars: [1200, 2400, 3600],
    tip: 'Deslizá un Ricardito para juntar 3 iguales en fila o columna.' },

  { world: 'clasico', cols: 8, rows: 8, flavors: FIVE, moves: 20,
    goal: { type: 'collect', targets: { menta: 15 } }, stars: [1500, 3000, 4500],
    tip: 'Juntá 15 Ricarditos de Menta.' },

  { world: 'clasico', cols: 8, rows: 8, flavors: FIVE, moves: 22,
    goal: { type: 'oblea' }, stars: [2000, 3500, 5000],
    oblea: [
      '00000000',
      '00000000',
      '00111100',
      '00111100',
      '00111100',
      '00111100',
      '00000000',
      '00000000',
    ],
    tip: 'Hacé combinaciones sobre las obleas para comerlas.' },

  { world: 'clasico', cols: 8, rows: 8, flavors: FIVE, moves: 20, mask: MASK_ROUNDED,
    goal: { type: 'score', target: 4000 }, stars: [4000, 6000, 8000],
    tip: 'Juntá 4 en línea y creás un Ricardito Rayado que limpia toda una fila o columna.' },

  { world: 'clasico', cols: 8, rows: 8, flavors: FIVE, moves: 25,
    goal: { type: 'collect', targets: { pasion: 20, celeste: 20 } }, stars: [3000, 5000, 7000],
    tip: 'Dos sabores para juntar: Pasión y Celeste.' },

  // ---------- Mundo Menta ----------
  { world: 'menta', cols: 9, rows: 9, flavors: FIVE, moves: 24, mask: MASK_RICARDITO,
    goal: { type: 'oblea' }, stars: [3000, 5000, 7500],
    oblea: [
      '000000000',
      '000000000',
      '000000000',
      '000000000',
      '000000000',
      '000000000',
      '111111111',
      '111111111',
      '111111111',
    ],
    tip: '¡Un tablero con forma de Ricardito! Limpiá la base de oblea.' },

  { world: 'menta', cols: 8, rows: 8, flavors: SIX, moves: 22,
    goal: { type: 'score', target: 5000 }, stars: [5000, 7500, 10000],
    tip: 'Llega el Ricardito Dubai (pistacho). Seis sabores en juego.' },

  { world: 'menta', cols: 8, rows: 8, flavors: SIX, moves: 25,
    goal: { type: 'collect', targets: { dubai: 25 } }, stars: [3500, 6000, 8500],
    tip: 'Una forma de L o T crea un Ricardito Misterio: explota todo alrededor.' },

  { world: 'menta', cols: 8, rows: 8, flavors: SIX, moves: 26,
    goal: { type: 'oblea' }, stars: [4000, 7000, 10000],
    oblea: [
      '22222222',
      '21111112',
      '21000012',
      '21000012',
      '21000012',
      '21000012',
      '21111112',
      '22222222',
    ],
    tip: 'Las obleas dobles necesitan dos combinaciones.' },

  { world: 'menta', cols: 9, rows: 9, flavors: SIX, moves: 26,
    goal: { type: 'collect', targets: { menta: 20, clasico: 20, halloween: 20 } }, stars: [5000, 8000, 11000],
    tip: 'Juntá 5 en línea y creás una Caja Ricardito: cambiala con cualquier sabor y lo limpia entero.' },

  // ---------- Mundo Pasión ----------
  { world: 'pasion', cols: 8, rows: 8, flavors: SIX, moves: 20,
    goal: { type: 'score', target: 8000 }, stars: [8000, 11000, 14000],
    tip: 'Combiná dos especiales entre sí para efectos gigantes.' },

  { world: 'pasion', cols: 9, rows: 9, flavors: SIX, moves: 28, mask: MASK_CAJA,
    goal: { type: 'oblea' }, stars: [5000, 8500, 12000],
    oblea: [
      '002222200',
      '021111120',
      '211111112',
      '211222112',
      '211222112',
      '211222112',
      '211111112',
      '021111120',
      '002222200',
    ],
    tip: 'Una caja llena de oblea. Usá especiales para llegar al centro.' },

  { world: 'pasion', cols: 8, rows: 8, flavors: SIX, moves: 28,
    goal: { type: 'collect', targets: { pasion: 45 } }, stars: [5000, 8000, 11000],
    tip: 'Pasión pura: 45 Ricarditos de frutilla.' },

  { world: 'pasion', cols: 9, rows: 9, flavors: SIX, moves: 32,
    goal: { type: 'oblea' }, stars: [7000, 10000, 14000],
    oblea: [
      '111111111',
      '111111111',
      '111111111',
      '111111111',
      '111111111',
      '111111111',
      '111111111',
      '111111111',
      '111111111',
    ],
    tip: 'Todo el tablero es oblea. Las cascadas son tus amigas.' },

  { world: 'pasion', cols: 9, rows: 9, flavors: SIX, moves: 30, mask: MASK_RICARDITO,
    goal: { type: 'score', target: 15000 }, stars: [15000, 20000, 26000],
    tip: 'El gran final. ¡Uruguay nomá!' },
];
