/* Logica de todo el juego */

/* SISTEMA DE COORDENADAS:
    - Bloque 1x1x1
    - Eje X -> Derecha (avance del jugador)
    - Eje Y -> Arriba (altura del jugador)
    - Eje Z -> Adelante (profundidad del jugador)
*/
import * as THREE from 'three';

const CONFIG = {
    GRAVEDAD: -32,
    VEL_CAMINAR: 6,
    VEL_CORRER: 9,
    ACELERACION: 40,
    FRICCION: 30,
    FUERZA_SALTO: 15,
    CORTE_SALTO: 0.45,
    VEL_MAX_CAIDA: -20,
    VIDAS_INICIALES: 3,
    TIEMPO_NIVEL: 300,
    LIMITE_CAIDA: -5,
    VEL_ENEMIGO: 1.5,
};

/* --- DISEÑO DE LOS NIVELES (TILEMAPS) --- */
const MAPA_NIVEL_1 = [
    "                                                                    ",
    "                                     ooo                            ",
    "   #       G               ooo          ooooo                       ",
    "   #                   BBBBB         ooooooo                    F ",
    "   #                                   BBB                      # ",
    "   # P     G   G                       E                        # ",
    "   ###  #######  #   K   #  ##C##   #####   ##B#B##      SSS        ###",
    "################ ################ ################ ################ ################",
];

// Nivel 2 mucho más complejo, con saltos precisos, vacíos y enemigos estratégicos
const MAPA_NIVEL_2 = [
    "                                                                                  ",
    "                                                        ooo                       ",
    "   #        G         BBB       ooooo         B G B   ooooooo            F      ",
    "   #                  BBB      ooooooo        #####     BBB                    ",
    "   #                                          E                 B        #      ",
    "   # P    E   G     BB       ### E        E               E     BBB      #      ",
    "   ###   ### ###   ###   #########   #####   ##########   ###################",
    "################ #####     ######## #######    #######         ######################",
];

let mapaActual = MAPA_NIVEL_1;
let numeroNivelActual = 1;

const SOLIDOS = new Set(["#", "B", "G", "S", "C", "K", "F"]);
const COLOR_CIELO = 0x6ec6ff;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLOR_CIELO);
scene.fog = new THREE.Fog(COLOR_CIELO, 25, 60);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(5, 5, 14);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const light = new THREE.AmbientLight(0x404040, 50);
scene.add(light);

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

let grupoNivel = null,
    bloques = new Map(),
    gemas = [],
    enemigos = [],
    vidas = CONFIG.VIDAS_INICIALES,
    puntos = 0,
    gemasTotal = 0;

const clave = (x, y) => x + "," + y;

// --- CARGADOR DE TEXTURAS ---
const textureLoader = new THREE.TextureLoader();
const texTierra = textureLoader.load('./src/img/textura/ground.jpg');
const texSuelo = textureLoader.load('./src/img/textura/pasto.jpg');
const texLadrillo = textureLoader.load('./src/img/textura/ladrillo.jpg');
const texEstrella = textureLoader.load('./src/img/textura/estrella.jpg');
const texMeta = textureLoader.load('./src/img/textura/meta.jpg');

const MATERIALES = {
    suelo: new THREE.MeshLambertMaterial({ map: texSuelo }),
    tierra: new THREE.MeshLambertMaterial({ map: texTierra }),
    ladrillo: new THREE.MeshLambertMaterial({ map: texLadrillo }),
    piedra: new THREE.MeshLambertMaterial({ color: 0x808080 }),
    sorpresa: new THREE.MeshLambertMaterial({ map: texEstrella }), 
    columna: new THREE.MeshLambertMaterial({ color: 0x555555 }),
    meta: new THREE.MeshLambertMaterial({ map:texMeta }),
};

const GEO_BLOQUE = new THREE.BoxGeometry(1, 1, 1);
const GEO_GEMA = new THREE.OctahedronGeometry(0.28);

// --- JUGADOR ---
const jugadorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.9, 0.8),
    new THREE.MeshLambertMaterial({ color: 0xff595e })
);
jugadorMesh.castShadow = true;
scene.add(jugadorMesh);

const jugador = {
    x: 2.5,
    y: 2,
    vx: 0,
    vy: 0,
    ancho: 0.8,
    alto: 0.9,
    enSuelo: false
};

// Controles de teclado
const teclas = { izquierda: false, derecha: false, saltar: false, correr: false };

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') teclas.izquierda = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') teclas.derecha = true;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        if (jugador.enSuelo) {
            jugador.vy = CONFIG.FUERZA_SALTO;
            jugador.enSuelo = false;
        }
    }
    if (e.key === 'Shift') teclas.correr = true;
    
    // Cambiar de nivel rápido con teclas 1 y 2
    if (e.key === '1') window.cambiarNivel(1);
    if (e.key === '2') window.cambiarNivel(2);
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') teclas.izquierda = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') teclas.derecha = false;
    if (e.key === 'Shift') teclas.correr = false;
});

function construirNivel() {
    if (grupoNivel) scene.remove(grupoNivel);

    grupoNivel = new THREE.Group();
    scene.add(grupoNivel);

    bloques = new Map();
    gemas = [];
    enemigos = [];

    const alto = mapaActual.length;
    mapaActual.forEach((fila, y) => {
        const yMundo = alto - 1 - y;

        for (let index = 0; index < fila.length; index++) {
            const element = fila[index];

            if (SOLIDOS.has(element)) {
                crearBloque(index, yMundo, element);
            } else if (element === "o") {
                crearGema(index, yMundo);
            } else if (element === "E") {
                crearEnemigo(index, yMundo);
            } else if (element === "P" && numeroNivelActual === 1) {
                jugador.x = index + 0.5;
                jugador.y = yMundo + 1;
            }
        }
    });

    if (numeroNivelActual === 2) {
        jugador.x = 2.5;
        jugador.y = 3;
    }
    jugador.vx = 0;
    jugador.vy = 0;
}

function crearBloque(x, y, tipo) {
    let material = MATERIALES.piedra;
    if (tipo === "#") material = MATERIALES.suelo;
    if (tipo === "B") material = MATERIALES.ladrillo;
    if (tipo === "G") material = MATERIALES.sorpresa;
    if (tipo === "C") material = MATERIALES.columna;
    if (tipo === "F") material = MATERIALES.meta;

    const malla = new THREE.Mesh(GEO_BLOQUE, material);
    malla.position.set(x + 0.5, y + 0.5, 0);
    grupoNivel.add(malla);
    bloques.set(clave(x, y), { x, y, tipo, malla });

    if (tipo === "#") {
        const tierra = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), MATERIALES.tierra);
        tierra.position.set(x + 0.5, y - 2, 0);
        grupoNivel.add(tierra);
    }
}

function crearGema(x, y) {
    const malla = new THREE.Mesh(GEO_GEMA, new THREE.MeshLambertMaterial({ color: 0x00ffff }));
    malla.position.set(x + 0.5, y + 0.5, 0);
    grupoNivel.add(malla);
    gemas.push({ x, y, malla, recogida: false });
}

function crearEnemigo(x, y) {
    const malla = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshLambertMaterial({ color: 0xff0000 }));
    malla.position.set(x + 0.5, y + 0.5, 0);
    grupoNivel.add(malla);
    enemigos.push({ x: x + 0.5, y: y + 0.5, vx: CONFIG.VEL_ENEMIGO, malla, vivo: true });
}

window.cambiarNivel = function(num) {
    numeroNivelActual = num;
    mapaActual = (num === 2) ? MAPA_NIVEL_2 : MAPA_NIVEL_1;
    construirNivel();
};

construirNivel();

let reloj = new THREE.Clock();

function animate() {
    let dt = reloj.getDelta();
    if (dt > 0.1) dt = 0.1;

    // --- MOVIMIENTO HORIZONTAL ---
    let velObjetivo = 0;
    let velocidadActual = teclas.correr ? CONFIG.VEL_CORRER : CONFIG.VEL_CAMINAR;
    if (teclas.izquierda) velObjetivo = -velocidadActual;
    if (teclas.derecha) velObjetivo = velocidadActual;

    if (velObjetivo !== 0) {
        jugador.vx += (velObjetivo - jugador.vx) * CONFIG.ACELERACION * dt;
    } else {
        jugador.vx -= jugador.vx * CONFIG.FRICCION * dt;
    }

    jugador.x += jugador.vx * dt;

    // Colisión horizontal con bloques
    bloques.forEach((b) => {
        if (Math.abs(jugador.x - (b.x + 0.5)) < (jugador.ancho + 1) / 2 &&
            Math.abs(jugador.y - (b.y + 0.5)) < (jugador.alto + 1) / 2) {
            if (b.tipo !== 'K') {
                if (jugador.vx > 0) jugador.x = b.x - jugador.ancho / 2;
                else if (jugador.vx < 0) jugador.x = b.x + 1 + jugador.ancho / 2;
                jugador.vx = 0;
            }
        }
    });

    // --- MOVIMIENTO VERTICAL Y GRAVEDAD ---
    jugador.vy += CONFIG.GRAVEDAD * dt;
    if (jugador.vy < CONFIG.VEL_MAX_CAIDA) jugador.vy = CONFIG.VEL_MAX_CAIDA;
    jugador.y += jugador.vy * dt;
    jugador.enSuelo = false;

    // Colisión vertical con bloques
    bloques.forEach((b) => {
        if (Math.abs(jugador.x - (b.x + 0.5)) < (jugador.ancho + 1) / 2 &&
            Math.abs(jugador.y - (b.y + 0.5)) < (jugador.alto + 1) / 2) {
            if (b.tipo !== 'K') {
                if (jugador.vy < 0) { // Cayendo
                    jugador.y = b.y + 1 + jugador.alto / 2;
                    jugador.vy = 0;
                    jugador.enSuelo = true;
                } else if (jugador.vy > 0) { // Saltando y golpeando por debajo
                    jugador.y = b.y - jugador.alto / 2;
                    jugador.vy = 0;
                    if (b.tipo === 'F') {
                        // Meta alcanzada
                        alert("¡Nivel Superado!");
                        window.cambiarNivel(numeroNivelActual === 1 ? 2 : 1);
                    }
                }
            }
        }
    });

    // Control de caída al vacío
    if (jugador.y < CONFIG.LIMITE_CAIDA) {
        vidas--;
        if (vidas <= 0) {
            alert("¡Game Over!");
            vidas = CONFIG.VIDAS_INICIALES;
        }
        construirNivel();
    }

    // Recolectar Gemas
    gemas.forEach(g => {
        if (!g.recogida && Math.abs(jugador.x - (g.x + 0.5)) < 0.6 && Math.abs(jugador.y - (g.y + 0.5)) < 0.6) {
            g.recogida = true;
            grupoNivel.remove(g.malla);
            puntos += 100;
        }
        g.malla.rotation.y += dt * 3;
    });

    // Actualizar posición visual del jugador
    jugadorMesh.position.set(jugador.x, jugador.y, 0);

    // Seguir al jugador con la cámara suavemente
    camera.position.x += (jugador.x - camera.position.x + 2) * 5 * dt;

    renderer.render(scene, camera);
}