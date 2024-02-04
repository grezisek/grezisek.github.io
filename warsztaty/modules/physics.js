import SubscriberPublisher from "../helpers/SubscriberPublisher.js";
import {
    clamp,
    distanceApprox,
} from "../helpers/math.js";
import Particles, {
    GRID_CELL_SIZE,
    PARTICLE_X,
    PARTICLE_Y,
    PARTICLE_VX,
    PARTICLE_VY,
    PARTICLE_FUTURE_X,
    PARTICLE_FUTURE_Y,
    PARTICLE_DENS,
    GRID_CELLS_X,
    GRID_CELLS_Y,
    X_LAST,
    Y_LAST,
} from "./particles.js";
import {
    GAME_SIZE_X,
    GAME_SIZE_Y,
} from "../modules/initializer.js";

export const GAME_ASPECT_RATIO = GAME_SIZE_X / GAME_SIZE_Y;
export const FIXED_FRAMETIME = 1000 / 65;
export const DENS_OF_WATER = 0.005;

const GY_LAST = GRID_CELLS_Y - 1;
const GX_LAST = GRID_CELLS_X - 1;
const PRESSURE_MULT = 1;
const PRESSURE_MULT_NEG = 1;
const PRESSURE_MULT_POS = 1;
const BOAT_PRESSURE_MULT_X = 0.5;
const BOAT_PRESSURE_MULT_Y = 4;
const WATER_DAMP = 0.996;
const DENS_OF_AIR = DENS_OF_WATER / 1000;
const AIR_DAMP = 0.9994;
const VEL_LIM_SQ = 0.4;
const FUTURE_STEP = 0.2;
const BOAT_DAMP = 0.95;
const BOAT_VEL_LIM_SQ = 0.1;
const WALL_BOUNCINESS = 0.5;
const GRAVITY = -0.001 * FIXED_FRAMETIME;
const SMOOTHING_R = GRID_CELL_SIZE;
const SMOOTHING_R_BOAT = GRID_CELL_SIZE * 2;
const SMOOTHING_VOL = Math.PI * (SMOOTHING_R ** 4) / 6;
const SMOOTHING_DERIV_SCALE = 12 / ((SMOOTHING_R ** 4) * Math.PI);

let events = null;
let state = null;
let $;
export default class Physics {
    static eventSubscribers = {
        start,
        stop,
        fixedUpdate,
    };
    static #state = {};
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Physics.eventSubscribers);
        $ = Physics.#state;
    }
}

/**
 * Subscribers
 */
function start() {
    createMemory();
}
function stop() {
    emptyMemory();
}

let frameLenAcc = 0;
let frameLenI = 0;
const frameAvgFrom = 50;
function fixedUpdate() {
    if (!state.playing || state.paused) {
        return;
    }
    $.boatDens = DENS_OF_AIR;
    Particles.iterateParticles(updateWaterFuturePos);
    Particles.iterateParticlesWithNbhd(updateDensity);
    Particles.iterateParticlesWithNbhd(addParticleForces);
    addBoatForces();

    Particles.iterateParticles(integrateForces);
    state.boatX = clamp(state.boatX + state.boatVX * FIXED_FRAMETIME, 0, GAME_SIZE_X - 1);
    state.boatY = clamp(state.boatY + state.boatVY * FIXED_FRAMETIME, 0, GAME_SIZE_Y - 1);
    
    waterWallCollisions();
    Particles.iterateParticles(updateGridCell);
    
    if (exploding) {
        explode(mousePos[0], mousePos[1]);
    }

    frameLenAcc += performance.now() - state.currentTimestamp;
    frameLenI++;
    if (frameLenI == frameAvgFrom) {
        if (state.benchmarkUntil) {
            if (state.benchmarkUntil < performance.now()) {
                let sum = 0;
                for (let time of state.benchmark) {
                    sum += time;
                }
                sum /= state.benchmark.length;
                alert(sum);
                delete state.benchmarkUntil;
                delete state.benchmark;
            } else {
                state.benchmark.push(frameLenAcc / frameAvgFrom);
            }
        }
        console.log(frameLenAcc / frameAvgFrom);
        frameLenI = 0;
        frameLenAcc = 0;
    }
}

/**
 * Private
 */
function createMemory() {
    state.boatX = 0;
    state.boatY = 0;
    state.boatVX = 0;
    state.boatVY = 0;
    $.boatDens = 0;
}
function emptyMemory() {
    delete state.boatX;
    delete state.boatY;
    delete state.boatVX;
    delete state.boatVY;
    delete $.boatDens;
}

function updateWaterFuturePos(gx, gy, di, particle) {
    particle[PARTICLE_FUTURE_X] = particle[PARTICLE_X]
        + particle[PARTICLE_VX]
            * FIXED_FRAMETIME
            * FUTURE_STEP;
    particle[PARTICLE_FUTURE_Y] = particle[PARTICLE_Y]
        + particle[PARTICLE_VY]
            * FIXED_FRAMETIME
            * FUTURE_STEP;
}
function updateDensity(gx, gy, di, particle, nbhd) {
    particle[PARTICLE_DENS] = DENS_OF_AIR;

    const dx = particle[PARTICLE_FUTURE_X] - state.boatX;
    const dy = particle[PARTICLE_FUTURE_Y] - state.boatY;
    if (dx < SMOOTHING_R_BOAT && dx > -SMOOTHING_R_BOAT && dy < SMOOTHING_R_BOAT && dy > -SMOOTHING_R_BOAT) {
        const particleBoatDist = distanceApprox(dx, dy);
        particle[PARTICLE_DENS] -= smoothing(particleBoatDist, SMOOTHING_R);
        $.boatDens += smoothing(particleBoatDist, SMOOTHING_R_BOAT);
    }

    Particles.iterateNbhd(updateDensityItem, nbhd, particle);
}
function updateDensityItem(_particle, particle) {
    const dx = _particle[PARTICLE_FUTURE_X] - particle[PARTICLE_FUTURE_X];
    if (dx < -SMOOTHING_R || dx > SMOOTHING_R) {
        return;
    }
    const dy = _particle[PARTICLE_FUTURE_Y] - particle[PARTICLE_FUTURE_Y];
    if (dy < -SMOOTHING_R || dy > SMOOTHING_R) {
        return;
    }
    particle[PARTICLE_DENS] += smoothing(distanceApprox(dx, dy), SMOOTHING_R);
}
function addParticleForces(gx, gy, di, particle, nbhd) {
    let forceX = 0;
    let forceY = 0;
    let _particle;
    for (let ci = 0; ci < 9; ci++) {
        if (!nbhd[ci]) {
            continue;
        }
        for (let pi = 0; pi < nbhd[ci].length; pi++) {
            if (ci == 4 && particle === nbhd[ci][pi]) {
                continue;
            }
            _particle = nbhd[ci][pi];

            const dxFuture = _particle[PARTICLE_FUTURE_X] - particle[PARTICLE_FUTURE_X];
            if (dxFuture < -SMOOTHING_R || dxFuture > SMOOTHING_R) {
                continue;
            }
            const dyFuture = _particle[PARTICLE_FUTURE_Y] - particle[PARTICLE_FUTURE_Y];
            if (dyFuture < -SMOOTHING_R || dyFuture > SMOOTHING_R) {
                continue;
            }
            const dist = distanceApprox(dxFuture, dyFuture);
            if (dist > SMOOTHING_R) {
                continue;
            }

            const dx = _particle[PARTICLE_X] - particle[PARTICLE_X];
            const dy = _particle[PARTICLE_Y] - particle[PARTICLE_Y];

            const p = computePressure(particle[PARTICLE_DENS], dist) / 2;
            forceX += p * (dx + dxFuture);
            forceY += p * (dy + dyFuture);
        }
    }
    const div = particle[PARTICLE_DENS] / FIXED_FRAMETIME;
    particle[PARTICLE_VX] += forceX / div;
    particle[PARTICLE_VY] += forceY / div + GRAVITY;

    if (particle[PARTICLE_DENS] > DENS_OF_WATER) {
        particle[PARTICLE_VX] *= WATER_DAMP;
        particle[PARTICLE_VY] *= WATER_DAMP;
    } else {
        particle[PARTICLE_VX] *= AIR_DAMP;
        particle[PARTICLE_VY] *= AIR_DAMP;
    }

    const currVSq = particle[PARTICLE_VX]**2 + particle[PARTICLE_VY]**2;
    if (currVSq > VEL_LIM_SQ) {
        const damp = VEL_LIM_SQ / currVSq;
        particle[PARTICLE_VX] *= damp;
        particle[PARTICLE_VY] *= damp;
    }
}
function addBoatForces() {
    const gx = Math.floor(state.boatX / GRID_CELL_SIZE);
    const gy = Math.floor(state.boatY / GRID_CELL_SIZE);
    const nbhd = Particles.getNbhd(gx, gy);

    let forceX = 0;
    let forceY = 0;
    for (let ci = 0; ci < 9; ci++) {
        if (!nbhd[ci]) {
            continue;
        }
        for (let pi = 0; pi < nbhd[ci].length; pi++) {
            const particle = nbhd[ci][pi];
            const dx = particle[PARTICLE_X] - state.boatX;
            const dy = particle[PARTICLE_Y] - state.boatY;
            const dsq = dx ** 2 + dy ** 2;
            const d = dsq ** 0.5;
            const pressure = computePressure($.boatDens, d);
            forceX += pressure * dx;
            forceY += -Math.abs(-pressure * dy);
        }
    }
    state.boatVX -= forceX * FIXED_FRAMETIME * BOAT_PRESSURE_MULT_X;
    state.boatVY -= forceY * FIXED_FRAMETIME * BOAT_PRESSURE_MULT_Y;

    state.boatVX += state.movement[0] * FIXED_FRAMETIME / 1500;
    if (state.movement[1] > 0) {
        state.boatVY += state.movement[1] * FIXED_FRAMETIME / 1500;
    } else {
        state.boatVY += state.movement[1] * FIXED_FRAMETIME / 120;
    }
    
    state.boatVX *= BOAT_DAMP;
    state.boatVY = (state.boatVY + GRAVITY) * BOAT_DAMP;

    const currVSq = state.boatVX**2 + state.boatVY**2;
    if (currVSq > BOAT_VEL_LIM_SQ) {
        const damp = BOAT_VEL_LIM_SQ / currVSq;
        state.boatVX *= damp;
        state.boatVY *= damp;
    }
}
function computePressure(density, distance) {
    let pressure = densityToPressure(density, DENS_OF_WATER, PRESSURE_MULT)
        * smoothingDeriv(distance, SMOOTHING_R, SMOOTHING_DERIV_SCALE)
        / density
        / distance;

    if (pressure < 0) {
        pressure *= PRESSURE_MULT_NEG;
    } else {
        pressure *= PRESSURE_MULT_POS;
    }

    return pressure;
}
function integrateForces(gx, gy, di, particle) {
    particle[PARTICLE_X] += particle[PARTICLE_VX] * FIXED_FRAMETIME;
    particle[PARTICLE_Y] += particle[PARTICLE_VY] * FIXED_FRAMETIME;
}
function waterWallCollisions() {
    for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
        for (let particle of state.particles[0][gy]) {
            if (particle[PARTICLE_X] < 0) {
                particle[PARTICLE_X] = 0;
                particle[PARTICLE_VX] *= -WALL_BOUNCINESS;
                particle[PARTICLE_VY] *= WALL_BOUNCINESS;
            }
        }
        for (let particle of state.particles[GX_LAST][gy]) {
            if (particle[PARTICLE_X] > X_LAST) {
                particle[PARTICLE_X] = X_LAST;
                particle[PARTICLE_VX] *= -WALL_BOUNCINESS;
                particle[PARTICLE_VY] *= WALL_BOUNCINESS;
            }
        }
    }
    for (let gx = 0; gx < GRID_CELLS_X; gx++) {
        for (let particle of state.particles[gx][0]) {
            if (particle[PARTICLE_Y] < 0) {
                particle[PARTICLE_Y] = 0;
                particle[PARTICLE_VX] *= WALL_BOUNCINESS;
                particle[PARTICLE_VY] *= -WALL_BOUNCINESS;
            }
        }
        for (let particle of state.particles[gx][GY_LAST]) {
            if (particle[PARTICLE_Y] > Y_LAST) {
                particle[PARTICLE_Y] = Y_LAST;
                particle[PARTICLE_VX] *= WALL_BOUNCINESS;
                particle[PARTICLE_VY] *= -WALL_BOUNCINESS;
            }
        }
    }
}
function updateGridCell(gx, gy, di, particle) {
    const newGX = Math.floor(particle[PARTICLE_X] / GRID_CELL_SIZE);
    const newGY = Math.floor(particle[PARTICLE_Y] / GRID_CELL_SIZE);
    
    if (newGX < 0 || newGX >= GRID_CELLS_X || newGY < 0 || newGY >= GRID_CELLS_Y) {
        return false;
    }
    if (gx == newGX && gy == newGY) {
        return false;
    }
    state.particles[gx][gy].splice(di, 1);
    state.particles[newGX][newGY].push(particle);
    
    return true;
}

function smoothing(d, r) {
    if (d > r) {
        return 0;
    }

    return ((r - d)**2) / SMOOTHING_VOL;
}
function densityToPressure(density, targetDensity, scale) {
    return (density - targetDensity) * scale;
}
function smoothingDeriv(d, r, scale) {
    if (d > r) {
        return 0;
    }

    return scale * (d - r);
}

//debug
const mousePos = [0, 0];
const radius = 200;
const power = 0.0003;
let exploding = false;
let inverted = false;
function explode(x, y) {
    for (let gx = 0; gx < GRID_CELLS_X; gx++) {
        for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
            if (!state.particles[gx][gy].length) {
                return;
            }
            for (let di = 0; di < state.particles[gx][gy].length; di++) {
                const dx = x - state.particles[gx][gy][di][0];
                const dy = y - state.particles[gx][gy][di][1];
                const dsq = dx ** 2 + dy ** 2;
                let d = dsq ** 0.5;
                if (d > radius) {
                    continue;
                }

                if (d < 0.01) {
                    d = 0.01;
                }
                const nx = dx / d;
                const ny = dy / d;
                const s = radius - d;
                if (inverted) {
                    state.particles[gx][gy][di][2] += nx * s * power;
                    state.particles[gx][gy][di][3] += ny * s * power;
                } else {
                    state.particles[gx][gy][di][2] -= nx * s * power;
                    state.particles[gx][gy][di][3] -= ny * s * power;
                }
            }
        }
    }
}

canvas.addEventListener("mousedown", e => {
    const rect = canvas.getBoundingClientRect();
    mousePos[0] = (e.x - rect.x) / rect.width * GAME_SIZE_X;
    mousePos[1] = (1 - (e.y - rect.y) / rect.height) * GAME_SIZE_Y;
    exploding = true;
});
canvas.addEventListener("mouseup", e => {
    mousePos[0] = e.x;
    mousePos[1] = e.y;
    exploding = false;
});
canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    mousePos[0] = (e.x - rect.x) / rect.width * GAME_SIZE_X;
    mousePos[1] = (1 - (e.y - rect.y) / rect.height) * GAME_SIZE_Y;
});
window.addEventListener("keydown", e => {
    if (e.key == "Control") {
        inverted = true;
    }
});
window.addEventListener("keyup", e => {
    if (e.key == "Control") {
        inverted = false;
    }
});
