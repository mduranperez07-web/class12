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
import { Sound } from './sounds.js';

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
    INVULNERABLE: 2
};


const MAPA_NIVEL_1 = [
    "                                                                   ooo                               SS",
    "          G                                                        BBB                              SSS",
    "                              oooo                     S   S                                      SSSS",
    "                              BBBB                    SS   SS                                     SSSSS",
    "        GBGBG                                        SSS   SSS    BGBGB          oo   GGG        SSSSSS",
    "                    C                     C         SSSS   SSSS                                  SSSSSSS",
    "  P            E    C        ######   E E   C    E SSSSS   SSSS K       E E               E    SSSSSSSS   F",
    "#########################  #############################   ######################  ###########################"
];

const MAPA_NIVEL_2 = [
    "                                               G                                 ",
    "                                                             ooo                ",
    "   #       G          BBB       ooooo        B  B   ooooooo            F         ",
    "   #          G       BBB      ooooooo     #####     BBB                         ",
    "   #                                         E                 B         #       ",
    "   # P     E       BB        E  ###       E              E    BBB       #        ",
    "   ###   ### ###   ###       ######    #####      ##########       ###################",
    "################ #####     ########      #######    #######        ######################"
];

let mapaActual = MAPA_NIVEL_1;
let numeroNivelActual = 1;



let vidas = CONFIG.VIDAS_INICIALES;
let puntos = 0;
let gemasRecogidas = 0;
let tiempoRestante = CONFIG.TIEMPO_NIVEL;

let estado = 'inicio';
let tiempoMuerte = 0;

let posicionInicial = { x: 0, y: 0 };

let grupoNivel = null;
let bloques = new Map();
let gemas = [];
let enemigos = [];
let particulas = [];
let grupoDecoracion = null;

let puntoControl = null;
let banderaMeta = null;

const SOLIDOS = new Set(['#', 'B', 'G', 'S', 'C', 'U']);

const clave = (x, y) => `${x},${y}`;


const scene = new THREE.Scene();

const COLOR_CIELO = 0x6ec6ff;

scene.background = new THREE.Color(COLOR_CIELO);
scene.fog = new THREE.Fog(COLOR_CIELO, 25, 60);

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    200
);

camera.position.set(8, 4.5, 14);
camera.lookAt(8, 3, 0);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);


const luzAmbiente = new THREE.HemisphereLight(
    0xffffff,
    0x7caa5c,
    2.2
);

scene.add(luzAmbiente);

const luzSol = new THREE.DirectionalLight(0xffffff, 2.6);

luzSol.castShadow = true;

luzSol.shadow.mapSize.set(2048, 2048);
luzSol.shadow.camera.left = -22;
luzSol.shadow.camera.right = 22;
luzSol.shadow.camera.top = 15;
luzSol.shadow.camera.bottom = -10;
luzSol.shadow.camera.near = 1;
luzSol.shadow.camera.far = 60;

scene.add(luzSol);
scene.add(luzSol.target);

function moverSol() {
    luzSol.position.set(
        camera.position.x - 6,
        18,
        12
    );

    luzSol.target.position.set(
        camera.position.x,
        0,
        0
    );
}

//TEXTURAS


const RUTA_TEXTURAS = './src/img/textura/';

const manager = new THREE.LoadingManager();

manager.onProgress = (url, cargadas, total) => {
    const boton = document.getElementById('btn-jugar');

    if (boton) {
        boton.textContent = `CARGANDO ${cargadas}/${total}`;
    }
};

manager.onLoad = () => {
    const boton = document.getElementById('btn-jugar');

    if (boton) {
        boton.textContent = 'JUGAR';
        boton.disabled = false;
    }
};

manager.onError = (url) => {
    console.error('No se pudo cargar la textura:', url);
};

const textureLoader = new THREE.TextureLoader(manager);

function cargarTextura(archivo) {
    const textura = textureLoader.load(
        RUTA_TEXTURAS + archivo
    );

    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy =
        renderer.capabilities.getMaxAnisotropy();

    return textura;
}

const texTierra = cargarTextura('ground.jpg');
const texSuelo = cargarTextura('pasto.jpg');
const texLadrillo = cargarTextura('ladrillo.jpg');
const texSorpresa = cargarTextura('estrella.jpg');

const texTierraRelleno = cargarTextura('ground.jpg');

texTierraRelleno.wrapS = THREE.RepeatWrapping;
texTierraRelleno.wrapT = THREE.RepeatWrapping;
texTierraRelleno.repeat.set(1, 4);


const matSueloLado = new THREE.MeshLambertMaterial({
    map: texSuelo
});

const MATERIALES = {
    suelo: [
        matSueloLado,
        matSueloLado,
        new THREE.MeshLambertMaterial({ map: texSuelo }),
        new THREE.MeshLambertMaterial({ map: texTierra }),
        matSueloLado,
        matSueloLado
    ],

    tierra: new THREE.MeshLambertMaterial({
        map: texTierraRelleno
    }),

    ladrillo: new THREE.MeshLambertMaterial({
        map: texLadrillo
    }),

    sorpresa: new THREE.MeshLambertMaterial({
        map: texSorpresa,
        emissive: 0x332200
    }),

    usado: new THREE.MeshLambertMaterial({
        map: texLadrillo
    }),

    piedra: new THREE.MeshLambertMaterial({
        map: texTierra
    }),

    columna: new THREE.MeshLambertMaterial({
        map: texLadrillo
    }),

    gema: new THREE.MeshPhongMaterial({
        color: 0x26c6da,
        emissive: 0x0b5560,
        shininess: 100
    })
};

const GEO_BLOQUE = new THREE.BoxGeometry(1, 1, 1);
const GEO_TIERRA = new THREE.BoxGeometry(1, 4, 1);
const GEO_GEMA = new THREE.OctahedronGeometry(0.28);


function pieza(geometria, material, x, y, z) {
    const malla = new THREE.Mesh(geometria, material);

    malla.position.set(x, y, z);
    malla.castShadow = true;

    return malla;
}

function crearModeloJugador() {
    const grupo = new THREE.Group();

    const matCuerpo = new THREE.MeshLambertMaterial({
        color: 0x2ec4b6
    });

    const matOscuro = new THREE.MeshLambertMaterial({
        color: 0x1b2a41
    });

    const matLuz = new THREE.MeshLambertMaterial({
        color: 0xffd23f,
        emissive: 0x664400
    });

    const matOjo = new THREE.MeshBasicMaterial({
        color: 0x7df9ff
    });

    const piernaIzq = pieza(
        new THREE.BoxGeometry(0.16, 0.2, 0.22),
        matOscuro,
        -0.14, 0.1, 0
    );

    const piernaDer = pieza(
        new THREE.BoxGeometry(0.16, 0.2, 0.22),
        matOscuro,
        0.14, 0.1, 0
    );

    const cuerpo = pieza(
        new THREE.BoxGeometry(0.6, 0.4, 0.48),
        matCuerpo,
        0, 0.4, 0
    );

    const cabeza = pieza(
        new THREE.BoxGeometry(0.56, 0.34, 0.5),
        matCuerpo,
        0, 0.77, 0
    );

    const visor = pieza(
        new THREE.BoxGeometry(0.46, 0.2, 0.04),
        matOscuro,
        0, 0.78, 0.26
    );

    const ojoIzq = pieza(
        new THREE.BoxGeometry(0.08, 0.1, 0.02),
        matOjo,
        -0.1, 0.79, 0.285
    );

    const ojoDer = pieza(
        new THREE.BoxGeometry(0.08, 0.1, 0.02),
        matOjo,
        0.1, 0.79, 0.285
    );

    const antena = pieza(
        new THREE.CylinderGeometry(0.025, 0.025, 0.2),
        matOscuro,
        0, 1.03, 0
    );

    const foco = pieza(
        new THREE.SphereGeometry(0.07, 12, 12),
        matLuz,
        0, 1.15, 0
    );

    const mochila = pieza(
        new THREE.BoxGeometry(0.4, 0.32, 0.14),
        matLuz,
        0, 0.42, -0.3
    );

    grupo.add(
        piernaIzq,
        piernaDer,
        cuerpo,
        cabeza,
        visor,
        ojoIzq,
        ojoDer,
        antena,
        foco,
        mochila
    );

    grupo.userData = {
        piernaIzq,
        piernaDer
    };

    return grupo;
}

const jugador = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,

    ancho: 0.7,
    alto: 0.9,

    enSuelo: false,
    mirando: 1,

    tiempoCoyote: 0,
    bufferSalto: 0,
    saltando: false,

    invulnerable: 0,
    tiempoAnimacion: 0,

    malla: crearModeloJugador()
};

scene.add(jugador.malla);


function crearModeloEnemigo() {
    const grupo = new THREE.Group();

    const matCuerpo = new THREE.MeshLambertMaterial({
        color: 0x9b5de5
    });

    const matBlanco = new THREE.MeshBasicMaterial({
        color: 0xffffff
    });

    const matNegro = new THREE.MeshBasicMaterial({
        color: 0x111111
    });

    const cuerpo = pieza(
        new THREE.SphereGeometry(0.42, 20, 16),
        matCuerpo,
        0, 0.32, 0
    );

    cuerpo.scale.set(1, 0.78, 0.9);

    const ojoIzq = pieza(
        new THREE.SphereGeometry(0.1, 10, 10),
        matBlanco,
        -0.14, 0.42, 0.3
    );

    const ojoDer = pieza(
        new THREE.SphereGeometry(0.1, 10, 10),
        matBlanco,
        0.14, 0.42, 0.3
    );

    const pupIzq = pieza(
        new THREE.SphereGeometry(0.05, 8, 8),
        matNegro,
        -0.14, 0.42, 0.39
    );

    const pupDer = pieza(
        new THREE.SphereGeometry(0.05, 8, 8),
        matNegro,
        0.14, 0.42, 0.39
    );

    grupo.add(cuerpo, ojoIzq, ojoDer, pupIzq, pupDer);

    return grupo;
}

function crearBandera(alto, colorTela) {
    const grupo = new THREE.Group();

    const matPoste = new THREE.MeshLambertMaterial({
        color: 0xeeeeee
    });

    const matTela = new THREE.MeshLambertMaterial({
        color: colorTela,
        side: THREE.DoubleSide
    });

    grupo.add(
        pieza(
            new THREE.CylinderGeometry(0.06, 0.06, alto),
            matPoste,
            0, alto / 2, 0
        )
    );

    grupo.add(
        pieza(
            new THREE.SphereGeometry(0.14, 12, 12),
            MATERIALES.sorpresa,
            0, alto + 0.1, 0
        )
    );

    const tela = pieza(
        new THREE.BoxGeometry(0.9, 0.6, 0.04),
        matTela,
        -0.48, alto - 0.4, 0
    );

    grupo.add(tela);
    grupo.userData.tela = tela;

    return grupo;
}

// =========================================================
// DECORACIÓN DEL MUNDO
// =========================================================

function crearNube(x, y, z, escala = 1) {
    const nube = new THREE.Group();

    const material = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9
    });

    const partes = [
        [-0.5, 0, 0, 0.9],
        [0, 0.2, 0, 1.2],
        [0.5, 0, 0, 0.9],
        [0.9, -0.1, 0, 0.7]
    ];

    partes.forEach(([px, py, pz, escalaParte]) => {
        const esfera = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 12, 12),
            material
        );

        esfera.position.set(px, py, pz);
        esfera.scale.set(
            escalaParte,
            escalaParte,
            escalaParte
        );

        nube.add(esfera);
    });

    nube.position.set(x, y, z);
    nube.scale.setScalar(escala);

    grupoDecoracion.add(nube);
}

function crearMontana(x, y, z, escala = 1) {
    const material = new THREE.MeshLambertMaterial({
        color: 0x91b8c5
    });

    const montana = new THREE.Mesh(
        new THREE.ConeGeometry(5, 8, 5),
        material
    );

    montana.position.set(x, y, z);
    montana.scale.setScalar(escala);

    grupoDecoracion.add(montana);
}

function crearArbol(x, y, z, escala = 1) {
    const arbol = new THREE.Group();

    const tronco = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.3, 2, 8),
        new THREE.MeshLambertMaterial({
            color: 0x795548
        })
    );

    tronco.position.y = 1;

    const copa = new THREE.Mesh(
        new THREE.ConeGeometry(1.2, 2.5, 8),
        new THREE.MeshLambertMaterial({
            color: 0x388e3c
        })
    );

    copa.position.y = 2.8;

    arbol.add(tronco, copa);

    arbol.position.set(x, y, z);
    arbol.scale.setScalar(escala);

    grupoDecoracion.add(arbol);
}

function construirDecoracion() {
    if (grupoDecoracion) {
        scene.remove(grupoDecoracion);
    }

    grupoDecoracion = new THREE.Group();

    const largoNivel = Math.max(...mapaActual.map(fila => fila.length));

    // Decoración repetida a lo largo de todo el nivel
    for (let x = -10; x < largoNivel + 20; x += 12) {
  
        crearArbol(x, 0, -5, 1);
        crearArbol(x + 6, 0, -7, 0.8);

        if (x % 24 === 2 || x % 24 === 14) {
            crearMontana(x, 3, -20, 1.4);
        }

        crearNube(x + 3, 9, -12, 1.3);
        crearNube(x + 9, 11, -15, 1);
    }

    scene.add(grupoDecoracion);
}

const ui = {
    vidas: document.getElementById('hud-vidas'),
    gemas: document.getElementById('hud-gemas'),
    puntos: document.getElementById('hud-puntos'),
    tiempo: document.getElementById('hud-tiempo'),

    aviso: document.getElementById('aviso'),

    inicio: document.getElementById('pantalla-inicio'),
    pausa: document.getElementById('pantalla-pausa'),
    fin: document.getElementById('pantalla-fin'),

    finTitulo: document.getElementById('fin-titulo'),
    finDetalle: document.getElementById('fin-detalle')
};

function actualizarHUD() {
    if (ui.vidas) ui.vidas.textContent = vidas;
    if (ui.gemas) ui.gemas.textContent = gemasRecogidas;

    if (ui.puntos) {
        ui.puntos.textContent = String(puntos).padStart(6, '0');
    }

    if (ui.tiempo) {
        ui.tiempo.textContent = Math.ceil(tiempoRestante);
    }
}

let temporizadorAviso = null;

function mostrarAviso(texto) {
    if (!ui.aviso) return;

    ui.aviso.textContent = texto;
    ui.aviso.classList.remove('oculto');

    clearTimeout(temporizadorAviso);

    temporizadorAviso = setTimeout(() => {
        ui.aviso.classList.add('oculto');
    }, 1500);
}

const teclas = {};

window.addEventListener('keydown', (e) => {
    teclas[e.code] = true;

    if (
        ['Space', 'ArrowUp', 'ArrowDown',
         'ArrowLeft', 'ArrowRight'].includes(e.code)
    ) {
        e.preventDefault();
    }

    if (
        !e.repeat &&
        esTeclaSalto(e.code) &&
        estado === 'jugando'
    ) {
        jugador.bufferSalto = CONFIG.BUFFER_SALTO;
    }

    if (e.code === 'KeyP') {
        alternarPausa();
    }

    if (e.code === 'KeyR' && estado !== 'inicio') {
        iniciarJuego();
    }
});

window.addEventListener('keyup', (e) => {
    teclas[e.code] = false;
});



const sonidoNivel = new Sound(
    ['./src/sounds/backgroundSound.mp3'],
    100,
    scene,
    { volume: 0.5 }
);
const sonidoGameOver = new Sound(
    ['./src/sounds/gameOver.mp3'],
    100,
    scene,
    { volume: 0.7 }
);
    const sonidoEnemigo = new Sound(
    ['./src/sounds/enemigo.mp3'],
    100,
    scene,
    { volume: 0.7 }
);
const sonidoMoneda = new Sound(
    ['./src/sounds/moneda.mp3'],
    100,
    scene,
    { volume: 0.7 }
);
const sonidoSalto = new Sound(
    ['./src/sounds/salto.mp3'],
    100,
    scene,
    { volume: 0.7 }
);

sonidoNivel.audio.loop = true;

// Efectos de sonido
sonidoGameOver.audio.loop = false;
sonidoEnemigo.audio.loop = false;
sonidoMoneda.audio.loop = false;
sonidoSalto.audio.loop = false;

function reproducirEfecto(sonido) {
    sonido.audio.currentTime = 0;
    sonido.play();
}


const esTeclaSalto = (code) =>
    code === 'Space' ||
    code === 'ArrowUp' ||
    code === 'KeyW';

const teclaIzquierda = () =>
    teclas['ArrowLeft'] || teclas['KeyA'];

const teclaDerecha = () =>
    teclas['ArrowRight'] || teclas['KeyD'];

const teclaSaltoPresionada = () =>
    teclas['Space'] ||
    teclas['ArrowUp'] ||
    teclas['KeyW'];

const teclaCorrer = () =>
    teclas['ShiftLeft'] || teclas['ShiftRight'];



function obtenerBloque(tx, ty) {
    return bloques.get(clave(tx, ty)) || null;
}

function bloquesQueToca(ent) {
    const resultado = [];

    const izquierda = Math.floor(ent.x - ent.ancho / 2);
    const derecha = Math.floor(ent.x + ent.ancho / 2 - 0.001);

    const abajo = Math.floor(ent.y);
    const arriba = Math.floor(ent.y + ent.alto - 0.001);

    for (let tx = izquierda; tx <= derecha; tx++) {
        for (let ty = abajo; ty <= arriba; ty++) {
            const bloque = obtenerBloque(tx, ty);

            if (bloque) resultado.push(bloque);
        }
    }

    return resultado;
}

function moverEntidad(ent, dt, alGolpearTecho = null) {
    ent.chocoPared = false;

    // Movimiento horizontal
    ent.x += ent.vx * dt;

    let choques = bloquesQueToca(ent);

    if (choques.length > 0) {
        if (ent.vx > 0) {
            ent.x = Math.min(...choques.map(b => b.x))
                - ent.ancho / 2 - 0.001;
        } else if (ent.vx < 0) {
            ent.x = Math.max(...choques.map(b => b.x))
                + 1 + ent.ancho / 2 + 0.001;
        }

        ent.vx = 0;
        ent.chocoPared = true;
    }

    // Movimiento vertical
    ent.y += ent.vy * dt;

    ent.enSuelo = false;

    choques = bloquesQueToca(ent);

    if (choques.length > 0) {
        if (ent.vy < 0) {
            ent.y = Math.max(...choques.map(b => b.y)) + 1;
            ent.enSuelo = true;
        } else if (ent.vy > 0) {
            ent.y = Math.min(...choques.map(b => b.y))
                - ent.alto - 0.001;

            if (alGolpearTecho) {
                alGolpearTecho(choques);
            }
        }

        ent.vy = 0;
    }
}

function seSuperponen(a, b) {
    return (
        Math.abs(a.x - b.x) < (a.ancho + b.ancho) / 2 &&
        a.y < b.y + b.alto &&
        a.y + a.alto > b.y
    );
}

function destruirBloque(bloque) {
    grupoNivel.remove(bloque.malla);

    bloques.delete(clave(bloque.x, bloque.y));

    crearParticulas(
        bloque.x + 0.5,
        bloque.y + 0.5,
        MATERIALES.ladrillo,
        8
    );

    puntos += 50;
}

function golpearBloque(listaBloques) {
    const bloque = listaBloques.reduce((mejor, b) =>
        Math.abs(b.x + 0.5 - jugador.x) <
        Math.abs(mejor.x + 0.5 - jugador.x)
            ? b
            : mejor
    );

    if (bloque.tipo === 'B') {
        destruirBloque(bloque);
    } else if (bloque.tipo === 'G') {
        bloque.tipo = 'U';
        bloque.malla.material = MATERIALES.usado;
        bloque.rebote = 0.2;

        gemaQueSalta(bloque.x, bloque.y + 1);
        sumarGema(100);
    } else {
        bloque.rebote = 0.1;
    }

    enemigos.forEach(en => {
        if (
            en.vivo &&
            Math.floor(en.x) === bloque.x &&
            Math.abs(en.y - (bloque.y + 1)) < 0.1
        ) {
            derrotarEnemigo(en, 100);
        }
    });
}


function crearGema(x, y) {
    const malla = new THREE.Mesh(
        GEO_GEMA,
        MATERIALES.gema
    );

    malla.position.set(x + 0.5, y + 0.5, 0);
    malla.castShadow = true;

    grupoNivel.add(malla);

    gemas.push({
        x,
        y,
        malla,
        recogida: false
    });
}

function gemaQueSalta(x, y) {
    const malla = new THREE.Mesh(
        GEO_GEMA,
        MATERIALES.gema
    );

    malla.position.set(x + 0.5, y + 0.3, 0);

    grupoNivel.add(malla);

    particulas.push({
        malla,
        vx: 0,
        vy: 8,
        vz: 0,
        vida: 0.5,
        gira: 15,
        gravedad: -20
    });
}

function sumarGema(puntosExtra) {
    gemasRecogidas++;
    puntos += puntosExtra;

    if (gemasRecogidas % 20 === 0) {
        vidas++;
        mostrarAviso('¡VIDA EXTRA!');
    }
}


function reaparecerJugador() {
    const inicio =
        puntoControl && puntoControl.activo
            ? puntoControl
            : posicionInicial;

    jugador.x = inicio.x;
    jugador.y = inicio.y;

    jugador.vx = 0;
    jugador.vy = 0;

    jugador.mirando = 1;
    jugador.invulnerable = CONFIG.INVULNERABLE;

    jugador.malla.rotation.set(0, 0, 0);
    jugador.malla.visible = true;
}

function actualizarJugador(dt) {
    const j = jugador;


    let direccion = 0;

    if (teclaIzquierda()) direccion--;
    if (teclaDerecha()) direccion++;

    const velocidadMaxima = teclaCorrer()
        ? CONFIG.VEL_CORRER
        : CONFIG.VEL_CAMINAR;

    if (direccion !== 0) {
        j.vx += direccion * CONFIG.ACELERACION * dt;

        j.vx = Math.max(
            -velocidadMaxima,
            Math.min(velocidadMaxima, j.vx)
        );

        j.mirando = direccion;
    } else {
        const freno = CONFIG.FRICCION * dt;

        j.vx = Math.abs(j.vx) <= freno
            ? 0
            : j.vx - Math.sign(j.vx) * freno;
    }

    // Salto
    j.tiempoCoyote = j.enSuelo
        ? CONFIG.TIEMPO_COYOTE
        : j.tiempoCoyote - dt;

    j.bufferSalto -= dt;

    if (j.bufferSalto > 0 && j.tiempoCoyote > 0) {
    j.vy = CONFIG.FUERZA_SALTO;

    j.bufferSalto = 0;
    j.tiempoCoyote = 0;
    j.saltando = true;

    reproducirEfecto(sonidoSalto);
}

    // Salto variable
    if (
        j.saltando &&
        !teclaSaltoPresionada() &&
        j.vy > 0
    ) {
        j.vy *= CONFIG.CORTE_SALTO;
        j.saltando = false;
    }

    if (j.vy <= 0) {
        j.saltando = false;
    }

    // Gravedad
    j.vy += CONFIG.GRAVEDAD * dt;
    j.vy = Math.max(j.vy, CONFIG.VEL_MAX_CAIDA);

    moverEntidad(j, dt, golpearBloque);

    // Límite izquierdo
    if (j.x < j.ancho / 2) {
        j.x = j.ancho / 2;
        j.vx = 0;
    }

    // Caída al vacío
    if (j.y < CONFIG.LIMITE_CAIDA) {
        perderVida(false);
        return;
    }

    // Recoger gemas
    gemas.forEach(g => {
        if (
            !g.recogida &&
            seSuperponen(j, {
                x: g.x + 0.5,
                y: g.y + 0.15,
                ancho: 0.6,
                alto: 0.7
            })
        ) {
            g.recogida = true;
            grupoNivel.remove(g.malla);
            sumarGema(100);
            reproducirEfecto(sonidoMoneda);
        }
    });

    // Punto de control
    if (
        puntoControl &&
        !puntoControl.activo &&
        j.x >= puntoControl.x
    ) {
        puntoControl.activo = true;

        puntoControl.bandera.userData.tela.material.color.set(
            0x4caf50
        );

        mostrarAviso('¡PUNTO DE CONTROL!');
    }

    // Meta
    if (banderaMeta && j.x >= banderaMeta.x - 0.2) {
        ganarNivel();
    }

    if (j.invulnerable > 0) {
        j.invulnerable -= dt;
    }

    actualizarModeloJugador(dt);
}

function actualizarModeloJugador(dt) {
    const j = jugador;
    const m = j.malla;

    m.position.set(j.x, j.y, 0);

    const anguloObjetivo = j.mirando * 0.9;

    m.rotation.y +=
        (anguloObjetivo - m.rotation.y) *
        Math.min(1, 12 * dt);

    const { piernaIzq, piernaDer } = m.userData;

    if (j.enSuelo && Math.abs(j.vx) > 0.5) {
        j.tiempoAnimacion += dt * Math.abs(j.vx) * 2.2;

        piernaIzq.position.y =
            0.1 + Math.max(0, Math.sin(j.tiempoAnimacion)) * 0.08;

        piernaDer.position.y =
            0.1 + Math.max(0, -Math.sin(j.tiempoAnimacion)) * 0.08;
    } else {
        piernaIzq.position.y = 0.1;
        piernaDer.position.y = 0.1;
    }

    const estirar = j.enSuelo
        ? 1
        : 1 + Math.max(-0.15, Math.min(0.15, j.vy * 0.015));

    m.scale.set(
        2 - estirar,
        estirar,
        2 - estirar
    );

    m.visible = j.invulnerable > 0
        ? Math.floor(j.invulnerable * 12) % 2 === 0
        : true;
}


function perderVida(conAnimacion) {
    if (estado !== 'jugando') return;

    vidas--;

    estado = 'muriendo';
    tiempoMuerte = 1.4;

    jugador.malla.visible = true;

    jugador.vy = conAnimacion ? 12 : 0;
    jugador.vx = 0;
}

function actualizarMuerte(dt) {
    tiempoMuerte -= dt;

    jugador.vy += CONFIG.GRAVEDAD * dt;
    jugador.y += jugador.vy * dt;

    jugador.malla.position.set(
        jugador.x,
        jugador.y,
        0
    );

    jugador.malla.rotation.z += dt * 8;

    if (tiempoMuerte <= 0) {
        if (vidas <= 0) {
            terminarJuego(false);
        } else {
            reaparecerJugador();

            tiempoRestante = CONFIG.TIEMPO_NIVEL;

            estado = 'jugando';
        }
    }
}


function crearEnemigo(x, y) {
    const malla = crearModeloEnemigo();

    grupoNivel.add(malla);

    enemigos.push({
        x: x + 0.5,
        y,

        vx: 0,
        vy: 0,

        ancho: 0.8,
        alto: 0.7,

        direccion: -1,

        vivo: true,
        tiempoMuerto: 0,

        malla
    });
}

function actualizarEnemigos(dt, tiempo) {
    enemigos.forEach(en => {
        if (!en.vivo) {
            en.tiempoMuerto -= dt;

            if (
                en.tiempoMuerto <= 0 &&
                en.malla.parent
            ) {
                grupoNivel.remove(en.malla);
            }

            return;
        }

        if (Math.abs(en.x - jugador.x) > 18) return;

        en.vx = en.direccion * CONFIG.VEL_ENEMIGO;

        en.vy += CONFIG.GRAVEDAD * dt;

        moverEntidad(en, dt);

        if (en.chocoPared) {
            en.direccion *= -1;
        }

        if (en.enSuelo) {
            const pieDelantero = Math.floor(
                en.x + en.direccion * (en.ancho / 2 + 0.05)
            );

            if (
                !obtenerBloque(
                    pieDelantero,
                    Math.floor(en.y - 0.1)
                )
            ) {
                en.direccion *= -1;
            }
        }

        if (en.y < CONFIG.LIMITE_CAIDA) {
            en.vivo = false;
            en.tiempoMuerto = 0;
        }

        en.malla.position.set(en.x, en.y, 0);

        en.malla.scale.y =
            1 + Math.sin(tiempo * 12) * 0.08;

        en.malla.rotation.y = en.direccion * 0.6;

        // Colisión con el jugador
        if (
            estado === 'jugando' &&
            seSuperponen(jugador, en)
        ) {
            const cayendoEncima =
                jugador.vy < 0 &&
                jugador.y > en.y + en.alto * 0.4;

            if (cayendoEncima) {
    derrotarEnemigo(en, 200);

    jugador.vy = CONFIG.FUERZA_SALTO * 0.65;

    reproducirEfecto(sonidoEnemigo);

    jugador.saltando = teclaSaltoPresionada();
}
            else if (jugador.invulnerable <= 0) {
                perderVida(true);
            }
        }
    });
}

function derrotarEnemigo(en, puntosGanados) {
    en.vivo = false;
    en.tiempoMuerto = 0.5;

    en.malla.scale.set(1.2, 0.25, 1.2);

    puntos += puntosGanados;
}


function construirNivel() {
    if (grupoNivel) {
        scene.remove(grupoNivel);
    }

    grupoNivel = new THREE.Group();

    scene.add(grupoNivel);

    bloques = new Map();
    gemas = [];
    enemigos = [];
    particulas = [];

    puntoControl = null;
    banderaMeta = null;

    const alto = mapaActual.length;

    mapaActual.forEach((fila, y) => {
        const yMundo = alto - 1 - y;

        for (let index = 0; index < fila.length; index++) {
            const elemento = fila[index];

            if (SOLIDOS.has(elemento)) {
                crearBloque(index, yMundo, elemento);
            } else if (elemento === 'o') {
                crearGema(index, yMundo);
            } else if (elemento === 'E') {
                crearEnemigo(index, yMundo);
            } else if (elemento === 'P') {
                posicionInicial = {
                    x: index + 0.5,
                    y: yMundo
                };
            } else if (elemento === 'K') {
                const bandera = crearBandera(2, 0x9e9e9e);

                bandera.position.set(
                    index + 0.5,
                    yMundo,
                    0
                );

                grupoNivel.add(bandera);

                puntoControl = {
                    x: index + 0.5,
                    y: yMundo,
                    bandera,
                    activo: false
                };
            } else if (elemento === 'F') {
                const bandera = crearBandera(6, 0xff595e);

                bandera.position.set(
                    index + 0.5,
                    yMundo,
                    0
                );

                grupoNivel.add(bandera);

                banderaMeta = {
                    x: index + 0.5,
                    bandera
                };
            }
        }
    });

    jugador.vx = 0;
    jugador.vy = 0;

    construirDecoracion();
}

function crearBloque(x, y, tipo) {
    const material = {
        '#': MATERIALES.suelo,
        'B': MATERIALES.ladrillo,
        'G': MATERIALES.sorpresa,
        'S': MATERIALES.piedra,
        'C': MATERIALES.columna,
        'U': MATERIALES.usado
    }[tipo];

    const malla = new THREE.Mesh(
        GEO_BLOQUE,
        material
    );

    malla.position.set(
        x + 0.5,
        y + 0.5,
        0
    );

    malla.castShadow = true;
    malla.receiveShadow = true;

    grupoNivel.add(malla);

    bloques.set(clave(x, y), {
        x,
        y,
        tipo,
        malla,
        rebote: 0
    });

    if (tipo === '#') {
        const tierra = new THREE.Mesh(
            GEO_TIERRA,
            MATERIALES.tierra
        );

        tierra.position.set(
            x + 0.5,
            y - 2,
            0
        );

        tierra.receiveShadow = true;

        grupoNivel.add(tierra);
    }
}


window.cambiarNivel = function(num) {
    numeroNivelActual = num;

    mapaActual = num === 2
        ? MAPA_NIVEL_2
        : MAPA_NIVEL_1;

    construirNivel();
    reaparecerJugador();
};


function iniciarJuego() {
    vidas = CONFIG.VIDAS_INICIALES;
    puntos = 0;
    gemasRecogidas = 0;

    tiempoRestante = CONFIG.TIEMPO_NIVEL;

    construirNivel();
    reaparecerJugador();

    jugador.invulnerable = 0;

    camera.position.set(8, 4.5, 14);

    ui.inicio?.classList.add('oculto');
    ui.fin?.classList.add('oculto');
    ui.pausa?.classList.add('oculto');

    estado = 'jugando';

    sonidoGameOver.pause();
    sonidoGameOver.audio.currentTime = 0;

    sonidoNivel.play();
}

function alternarPausa() {
    if (estado === 'jugando') {
        estado = 'pausa';

        sonidoNivel.pause();

        ui.pausa?.classList.remove('oculto');

    } else if (estado === 'pausa') {
        estado = 'jugando';

        sonidoNivel.play();

        ui.pausa?.classList.add('oculto');

        reloj.getDelta();
    }
}



function ganarNivel() {
    if (estado !== 'jugando') return;

    if (numeroNivelActual === 1) {
        numeroNivelActual = 2;
        mapaActual = MAPA_NIVEL_2;

        construirNivel();
        reaparecerJugador();

        tiempoRestante = CONFIG.TIEMPO_NIVEL;
        jugador.invulnerable = 1;

        actualizarHUD();
        mostrarAviso('¡NIVEL 2!');

    } else {
        terminarJuego(
            true,
            Math.max(0, Math.ceil(tiempoRestante)) * 10
        );
    }
}

function terminarJuego(gano, bonus = 0) {
    estado = gano ? 'victoria' : 'gameover';

    sonidoNivel.pause();

if (!gano) {
    sonidoGameOver.audio.currentTime = 0;
    sonidoGameOver.play();
}

    actualizarHUD();

    if (ui.finTitulo) {
        ui.finTitulo.textContent = gano
            ? '¡NIVEL COMPLETADO!'
            : 'GAME OVER';
    }

    if (ui.finDetalle) {
        ui.finDetalle.innerHTML = gano
            ? `Puntos: ${puntos}<br>
               Gemas: ${gemasRecogidas}<br>
               Bono por tiempo: ${bonus}`
            : `Puntos: ${puntos}<br>
               Gemas: ${gemasRecogidas}`;
    }

    setTimeout(() => {
        ui.fin?.classList.remove('oculto');
    }, gano ? 800 : 200);
}

const GEO_PEDAZO = new THREE.BoxGeometry(
    0.25,
    0.25,
    0.25

    
);

function crearParticulas(x, y, material, cantidad) {
    for (let i = 0; i < cantidad; i++) {
        const malla = new THREE.Mesh(
            GEO_PEDAZO,
            material
        );

        malla.position.set(x, y, 0);

        grupoNivel.add(malla);

        particulas.push({
            malla,

            vx: (Math.random() - 0.5) * 6,
            vy: 5 + Math.random() * 5,
            vz: (Math.random() - 0.5) * 6,

            vida: 1.2,
            gira: 10,

            gravedad: CONFIG.GRAVEDAD
        });
    }
}

function actualizarParticulas(dt) {
    for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i];

        p.vy += p.gravedad * dt;

        p.malla.position.x += p.vx * dt;
        p.malla.position.y += p.vy * dt;
        p.malla.position.z += p.vz * dt;

        p.malla.rotation.x += p.gira * dt;
        p.malla.rotation.y += p.gira * dt;

        p.vida -= dt;

        if (p.vida <= 0) {
            grupoNivel.remove(p.malla);
            particulas.splice(i, 1);
        }
    }
}


function animarNivel(dt, tiempo) {
    bloques.forEach(b => {
        if (b.rebote > 0) {
            b.rebote -= dt;

            b.malla.position.y =
                b.y + 0.5 +
                Math.sin(Math.max(0, b.rebote) * 15) * 0.15;
        }
    });

    gemas.forEach(g => {
        if (!g.recogida) {
            g.malla.rotation.y = tiempo * 2;

            g.malla.position.y =
                g.y + 0.5 +
                Math.sin(tiempo * 3 + g.x) * 0.08;
        }
    });

    if (banderaMeta) {
        banderaMeta.bandera.userData.tela.rotation.y =
            Math.sin(tiempo * 3) * 0.25;
    }
}


function actualizarCamara(dt) {
    const suavizado = Math.min(1, 5 * dt);

    const objetivoX = Math.max(8, jugador.x + 2);
    const objetivoY = Math.max(4.5, jugador.y + 3);

    camera.position.x +=
        (objetivoX - camera.position.x) * suavizado;

    camera.position.y +=
        (objetivoY - camera.position.y) * suavizado;

    camera.position.z = 14;

    camera.lookAt(
        camera.position.x,
        camera.position.y - 2,
        0
    );

    moverSol();
}


const reloj = new THREE.Clock();

function animate() {
    const dt = Math.min(
        reloj.getDelta(),
        1 / 30
    );

    const tiempo = reloj.elapsedTime;

    if (estado === 'jugando') {
        actualizarJugador(dt);
        actualizarEnemigos(dt, tiempo);

        tiempoRestante -= dt;

        if (tiempoRestante <= 0) {
            tiempoRestante = 0;
            perderVida(true);
        }
    } else if (estado === 'muriendo') {
        actualizarMuerte(dt);
    }

    if (estado !== 'pausa') {
        actualizarParticulas(dt);
        animarNivel(dt, tiempo);
    }

    if (estado !== 'inicio') {
        actualizarCamara(dt);
        actualizarHUD();
    } else {
        camera.position.set(
            10 + Math.sin(tiempo * 0.2) * 6,
            5,
            14
        );

        camera.lookAt(
            camera.position.x,
            3,
            0
        );

        moverSol();
    }

    renderer.render(scene, camera);
}


document.getElementById('btn-jugar')
    ?.addEventListener('click', iniciarJuego);

document.getElementById('btn-reiniciar')
    ?.addEventListener('click', iniciarJuego);

window.addEventListener('resize', () => {
    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});

ui.inicio?.classList.remove('oculto');

construirNivel();
reaparecerJugador();

actualizarModeloJugador(0);

renderer.setAnimationLoop(animate);