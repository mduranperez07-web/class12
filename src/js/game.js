/* Logica de todo el juego */

/* SISTEMA DE COORDENADAS:
    - Bloque 1x1x1
    - Eje X -> Derecha (avance del jugador)
    - Eje Y -> Arriba (altura del jugador)
    - Eje Z -> Adelante (profundidad del jugador)
*/
/* --- SISTEMA DE COORDENADAS ---
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
    TIEMPO_COYOTE: 0.1,
    BUFFER_SALTO: 0.12,
    VIDAS_INICIALES: 3,
    TIEMPO_NIVEL: 300,
    LIMITE_CAIDA: -5,
    VEL_ENEMIGO: 1.5,
    INVULNERABLE: 2.0,
};

/* --- DISEÑO DE LOS NIVELES (TILEMAPS) --- */
const MAPA_NIVEL_1 = [
    "                                                                    ",
    "                                                    ooo             ",
    "   #       G                                      ooo       ooooo   ",
    "   #                   BBBB                     ooooooop        F ",
    "   #                                            BBB             # ",
    "   # P     G   G                     E                          # ",
    "   ###  #######  #   K   #  ##C##   #####   ##B#B##     SSS         ###",
    "################ ################ ################ ################ ################",
];

const MAPA_NIVEL_2 = [
    "                                                                                ",
    "                                                             ooo                ",
    "   #       G          BBB       ooooo        B G B   ooooooo            F     ",
    "   #                  BBB      ooooooo     #####     BBB                      ",
    "   #                                         E                B         #     ",
    "   # P     E   G    BB       ### E         E              E    BBB       #     ",
    "   ###   ### ###   ###   #########   #####   ##########   ###################",
    "################ #####     ######## #######    #######        ######################",
];

let mapaActual = MAPA_NIVEL_1;
let numeroNivelActual = 1;

// Variables globales de estado inicializadas correctamente
let vidas = CONFIG.VIDAS_INICIALES;
let puntos = 0;
let gemasRecogidas = 0;
let tiempoRestante = CONFIG.TIEMPO_NIVEL;

const SOLIDOS = new Set(["#", "B", "G", "S", "C", "U", "K", "F"]);
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
    particulas = [],
    puntoControl = null,
    banderaMeta = null;

const clave = (x, y) => x + "," + y;

// --- CARGADOR DE TEXTURAS (Rutas corregidas a ./src/img/textura/) ---
const textureLoader = new THREE.TextureLoader();
const texTierra = textureLoader.load('./src/img/textura/ground.jpg');
const texSuelo = textureLoader.load('./src/img/textura/pasto.jpg');
const texLadrillo = textureLoader.load('./src/img/textura/ladrillo.jpg');
const texTierraRelleno = textureLoader.load('./src/img/textura/ground.jpg');
texTierraRelleno.wrapS = THREE.RepeatWrapping;
texTierraRelleno.wrapT = THREE.RepeatWrapping;
texTierraRelleno.repeat.set(1, 4);

const texSueloLado = textureLoader.load('./src/img/textura/pasto.jpg'); 
const texSorpresa  = textureLoader.load('./src/img/textura/estrella.jpg');
const texUsado     = textureLoader.load('./src/img/textura/ladrillo.jpg');
const texPiedra    = textureLoader.load('./src/img/textura/ground.jpg');
const texColumna   = textureLoader.load('./src/img/textura/ladrillo.jpg');

[texTierra, texSuelo, texLadrillo, texTierraRelleno, texSueloLado,
 texSorpresa, texUsado, texPiedra, texColumna].forEach(tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
});

const matSueloLado = new THREE.MeshLambertMaterial({ map: texSueloLado });
const MATERIALES = {
    suelo: [
        matSueloLado,
        matSueloLado,
        new THREE.MeshLambertMaterial({ map: texSuelo }), 
        new THREE.MeshLambertMaterial({ map: texTierra }), 
        matSueloLado,
        matSueloLado,
    ],
    tierra: new THREE.MeshLambertMaterial({ map: texTierraRelleno }),
    ladrillo: new THREE.MeshLambertMaterial({ map: texLadrillo }),
    sorpresa: new THREE.MeshLambertMaterial({ map: texSorpresa, emissive: 0x332200 }),
    usado: new THREE.MeshLambertMaterial({ map: texUsado }),
    piedra: new THREE.MeshLambertMaterial({ map: texPiedra }),
    columna: new THREE.MeshLambertMaterial({ map: texColumna }),
    gema: new THREE.MeshPhongMaterial({ color: 0x26c6da, emissive: 0x0b5560, shininess: 100 }),
};

const GEO_BLOQUE = new THREE.BoxGeometry(1, 1, 1);
const GEO_TIERRA = new THREE.BoxGeometry(1, 4, 1);
const GEO_GEMA = new THREE.OctahedronGeometry(0.28);

// --- INTERFAZ / HUD ---
const ui = {
    vidas: document.getElementById("hud-vidas"),
    gemas: document.getElementById("hud-gemas"), 
    puntos: document.getElementById("hud-puntos"),
    tiempo: document.getElementById("hud-tiempo"),
    inicio: document.getElementById("pantalla-inicio"),
    pausa: document.getElementById("pantalla-pausa"),
    fin: document.getElementById("pantalla-fin"),
    finTitulo: document.getElementById("fin-titulo"),
    finDetalle: document.getElementById("fin-detalle")
};

document.getElementById("btn-jugar")?.addEventListener('click', iniciarJuego);
document.getElementById("btn-reiniciar")?.addEventListener('click', iniciarJuego);

// --- MODELO 3D DEL JUGADOR ---
function pieza(geometria, material, x, y, z) {
    const malla = new THREE.Mesh(geometria, material);
    malla.position.set(x, y, z);
    malla.castShadow = true;
    return malla;
}

function crearModeloJugador() {
    const grupo = new THREE.Group();
    const matCuerpo = new THREE.MeshLambertMaterial({ color: 0x2ec4b6 });
    const matOscuro = new THREE.MeshLambertMaterial({ color: 0x1b2a41 });
    const matLuz = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x664400 });
    const matOjo = new THREE.MeshBasicMaterial({ color: 0x7df9ff });

    const piernaIzq = pieza(new THREE.BoxGeometry(0.16, 0.2, 0.22), matOscuro, -0.14, 0.1, 0);
    const piernaDer = pieza(new THREE.BoxGeometry(0.16, 0.2, 0.22), matOscuro, 0.14, 0.1, 0);
    const cuerpo = pieza(new THREE.BoxGeometry(0.6, 0.4, 0.48), matCuerpo, 0, 0.4, 0);
    const cabeza = pieza(new THREE.BoxGeometry(0.56, 0.34, 0.5), matCuerpo, 0, 0.77, 0);
    const visor = pieza(new THREE.BoxGeometry(0.46, 0.2, 0.04), matOscuro, 0, 0.78, 0.26);
    const ojoIzq = pieza(new THREE.BoxGeometry(0.08, 0.1, 0.02), matOjo, -0.1, 0.79, 0.285);
    const ojoDerecho = pieza(new THREE.BoxGeometry(0.08, 0.1, 0.02), matOjo, 0.1, 0.79, 0.285);
    const antena = pieza(new THREE.CylinderGeometry(0.025, 0.025, 0.2), matOscuro, 0, 1.03, 0);
    const foco = pieza(new THREE.SphereGeometry(0.07, 12, 12), matLuz, 0, 1.15, 0);
    const mochila = pieza(new THREE.BoxGeometry(0.4, 0.32, 0.14), matLuz, 0, 0.42, -0.3);

    grupo.add(piernaIzq, piernaDer, cuerpo, cabeza, visor, ojoIzq, ojoDerecho, antena, foco, mochila);
    return grupo;
}

const jugador = {
    x: 2.5,
    y: 2,
    vx: 0,
    vy: 0,
    ancho: 0.7,
    alto: 0.9,
    enSuelo: false,
    mirando: 1,
    tiempoCoyote: 0,
    bufferSalto: 0,
    malla: crearModeloJugador()
};

scene.add(jugador.malla);

// --- MODELO DE ENEMIGO ---
function crearModeloEnemigo() {
    const grupo = new THREE.Group();
    const matCuerpo = new THREE.MeshLambertMaterial({ color: 0x9b5de5 });
    const matBlanco = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const matNegro = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const cuerpo = pieza(new THREE.SphereGeometry(0.42, 20, 16), matCuerpo, 0, 0.32, 0);
    cuerpo.scale.set(1, 0.78, 0.9);
    const ojoIzq = pieza(new THREE.SphereGeometry(0.1, 10, 10), matBlanco, -0.14, 0.42, 0.3);
    const ojoDer = pieza(new THREE.SphereGeometry(0.1, 10, 10), matBlanco, 0.14, 0.42, 0.3);
    const pupIzq = pieza(new THREE.SphereGeometry(0.05, 8, 8), matNegro, -0.14, 0.42, 0.39);
    const pupDer = pieza(new THREE.SphereGeometry(0.05, 8, 8), matNegro, 0.14, 0.42, 0.39);

    grupo.add(cuerpo, ojoIzq, ojoDer, pupIzq, pupDer);
    return grupo;
}

// Controles de teclado
const teclas = { izquierda: false, derecha: false, saltar: false, correr: false };

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') teclas.izquierda = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') teclas.derecha = true;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        if (jugador.enSuelo || jugador.tiempoCoyote > 0) {
            jugador.vy = CONFIG.FUERZA_SALTO;
            jugador.enSuelo = false;
            jugador.tiempoCoyote = 0;
        } else {
            jugador.bufferSalto = CONFIG.BUFFER_SALTO;
        }
    }
    if (e.key === 'Shift') teclas.correr = true;
    if (e.key === '1') window.cambiarNivel(1);
    if (e.key === '2') window.cambiarNivel(2);
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') teclas.izquierda = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') teclas.derecha = false;
    if (e.key === 'Shift') teclas.correr = false;
    if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') && jugador.vy > 0) {
        jugador.vy *= CONFIG.CORTE_SALTO;
    }
});

function construirNivel() {
    if (grupoNivel) scene.remove(grupoNivel);

    grupoNivel = new THREE.Group();
    scene.add(grupoNivel);

    bloques = new Map();
    gemas = [];
    enemigos = [];
    particulas = [];

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
            } else if (element === "P") {
                jugador.x = index + 0.5;
                jugador.y = yMundo + 1;
            }
        }
    });

    jugador.vx = 0;
    jugador.vy = 0;
}

function crearBloque(x, y, tipo) {
    const material = {
        "#": MATERIALES.suelo,
        "B": MATERIALES.ladrillo,
        "G": MATERIALES.sorpresa,
        "S": MATERIALES.piedra,
        "C": MATERIALES.columna,
        "U": MATERIALES.usado,
        "F": MATERIALES.sorpresa
    }[tipo] || MATERIALES.piedra;

    const malla = new THREE.Mesh(GEO_BLOQUE, material);
    malla.position.set(x + 0.5, y + 0.5, 0);
    malla.castShadow = true;
    malla.receiveShadow = true;
    grupoNivel.add(malla);
    bloques.set(clave(x, y), { x, y, tipo, malla, rebote: 0 });

    if (tipo === "#") {
        const tierra = new THREE.Mesh(GEO_TIERRA, MATERIALES.tierra);
        tierra.position.set(x + 0.5, y - 2, 0);
        tierra.receiveShadow = true;
        grupoNivel.add(tierra);
    }
}

function crearGema(x, y) {
    const malla = new THREE.Mesh(GEO_GEMA, MATERIALES.gema);
    malla.position.set(x + 0.5, y + 0.5, 0);
    grupoNivel.add(malla);
    gemas.push({ x, y, malla, recogida: false });
}

function crearEnemigo(x, y) {
    const malla = crearModeloEnemigo();
    malla.position.set(x + 0.5, y + 0.1, 0);
    grupoNivel.add(malla);
    enemigos.push({ x: x + 0.5, y: y + 0.5, vx: CONFIG.VEL_ENEMIGO, malla, vivo: true });
}

window.cambiarNivel = function(num) {
    numeroNivelActual = num;
    mapaActual = (num === 2) ? MAPA_NIVEL_2 : MAPA_NIVEL_1;
    construirNivel();
};

function iniciarJuego() {
    vidas = CONFIG.VIDAS_INICIALES;
    puntos = 0;
    gemasRecogidas = 0;
    tiempoRestante = CONFIG.TIEMPO_NIVEL;
    construirNivel();

    ui.inicio?.classList.add('oculto');
    ui.fin?.classList.add('oculto');
    ui.pausa?.classList.add('oculto');
}

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
        jugador.mirando = velObjetivo > 0 ? 1 : -1;
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

    if (jugador.enSuelo) {
        jugador.tiempoCoyote = CONFIG.TIEMPO_COYOTE;
    } else {
        jugador.tiempoCoyote -= dt;
    }

    if (jugador.bufferSalto > 0) {
        jugador.bufferSalto -= dt;
        if (jugador.enSuelo || jugador.tiempoCoyote > 0) {
            jugador.vy = CONFIG.FUERZA_SALTO;
            jugador.enSuelo = false;
            jugador.bufferSalto = 0;
            jugador.tiempoCoyote = 0;
        }
    }

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
                    if (b.tipo === 'G') {
                        b.tipo = 'U';
                        b.malla.material = MATERIALES.usado;
                        puntos += 200;
                    }
                    if (b.tipo === 'F') {
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

    // Actualizar posición y rotación del modelo del jugador
    jugador.malla.position.set(jugador.x, jugador.y - jugador.alto / 2, 0);
    jugador.malla.rotation.y = jugador.mirando === 1 ? Math.PI / 2 : -Math.PI / 2;

    // Seguir al jugador con la cámara suavemente
    camera.position.x += (jugador.x - camera.position.x + 2) * 5 * dt;

    renderer.render(scene, camera);
}