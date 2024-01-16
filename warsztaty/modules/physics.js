import SubscriberPublisher from "../helpers/SubscriberPublisher.js";
import {
    clamp,
    distanceApprox,
} from "../helpers/math.js";

// particle indexes
export const PARTICLE_X = 0;
export const PARTICLE_Y = 1;
export const PARTICLE_VX = 2;
export const PARTICLE_VY = 3;
export const PARTICLE_TYPE = 4;
export const PARTICLE_FUTURE_X = 5;
export const PARTICLE_FUTURE_Y = 6;
export const PARTICLE_DENS = 7;

// config
export const GAME_SIZE_X = 1920;
export const GAME_SIZE_Y = 1080;
export const GAME_ASPECT_RATIO = GAME_SIZE_X / GAME_SIZE_Y;
export const FIXED_FRAMETIME = 1000 / 65;
export const GRID_CELL_SIZE = 20;
export const DENS_OF_WATER = 0.005;
export const GRID_CELLS_X = GAME_SIZE_X / GRID_CELL_SIZE + 2;
export const GRID_CELLS_Y = GAME_SIZE_Y / GRID_CELL_SIZE;
export const X_LAST = GRID_CELLS_X * GRID_CELL_SIZE - 1;
export const Y_LAST = GRID_CELLS_Y * GRID_CELL_SIZE - 1;
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

const NBHD_OFFSETS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [0,0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
];

let events = null;
let state = null;
let $;
export default class Physics {
    static eventSubscribers = {
        start,
        stop,
        fixedUpdate,
    };
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Physics.eventSubscribers);
        $ = {};
        state.physics = $;
    }

    static addParticle(x, y, vx, vy, type) {
        const gx = Math.floor(x / GRID_CELL_SIZE);
        const gy = Math.floor(y / GRID_CELL_SIZE);
        $.particles[gx][gy].push([x, y, vx, vy, type, 0, 0, 0]);
        $.particleCount++;
    }
    static removeParticle(gx, gy, di) {
        $.particles[gx][gy].splice(di, 1);
        $.particleCount--;
    }
    static iterateParticles(cb, arg) {
        for (let gx = 0; gx < GRID_CELLS_X; gx++) {
            for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
                if (!$.particles[gx][gy].length) {
                    continue;
                }
                for (let di = 0; di < $.particles[gx][gy].length; di++) {
                    cb(gx, gy, di, $.particles[gx][gy][di], arg);
                }
            }
        }
    }
    static iterateParticlesWithNbhd(cb, arg) {
        let nbhd;
        for (let gx = 0; gx < GRID_CELLS_X; gx++) {
            for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
                if (!$.particles[gx][gy].length) {
                    continue;
                }
                nbhd = Physics.getNbhd(gx, gy);
                for (let di = 0; di < $.particles[gx][gy].length; di++) {
                    cb(gx, gy, di, $.particles[gx][gy][di], nbhd, arg);
                }
            }
        }
    }
    static iterateNbhd(cb, nbhd, arg) {
        for (let cell of nbhd) {
            for (let particle of cell) {
                cb(particle, arg);
            }
        }
    }
    static createNbhd(gx, gy, nbhd = null) {
        const _nbhd = nbhd ?? [];
        
        for (let offset of NBHD_OFFSETS) {
            const _gx = gx + offset[PARTICLE_X];
            if (_gx < 0 || _gx >= GRID_CELLS_X) {
                continue;
            }
            const _gy = gy + offset[PARTICLE_Y];
            if (_gy < 0 || _gy >= GRID_CELLS_Y) {
                continue;
            }
            
            _nbhd.push($.particles[_gx][_gy]);
        }
    
        return _nbhd;
    }
    static getNbhd(gx, gy) {
        return $.nbhd[gx][gy];
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
function fixedUpdate() {
    if (!state.playing || state.paused) {
        return;
    }

    $.boatDens = DENS_OF_AIR;
    Physics.iterateParticles(updateWaterFuturePos);
    Physics.iterateParticlesWithNbhd(updateDensity);
    Physics.iterateParticlesWithNbhd(addForces);
    addBoatForce();

    Physics.iterateParticles(integrateForces);
    $.boatX = clamp($.boatX + $.boatVX * FIXED_FRAMETIME, 0, GAME_SIZE_X - 1);
    $.boatY = clamp($.boatY + $.boatVY * FIXED_FRAMETIME, 0, GAME_SIZE_Y - 1);
    
    waterWallCollisions();
    Physics.iterateParticles(updateGridCell);
    
    if (exploding) {
        explode(mousePos[0], mousePos[1]);
    }
}

/**
 * Private
 */
function createMemory() {
    $.particles = new Array(GRID_CELLS_X);
    for (let gx = 0; gx < GRID_CELLS_X; gx++) {
        $.particles[gx] = new Array(GRID_CELLS_Y);
        for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
            $.particles[gx][gy] = [];
        }
    }
    $.nbhd = new Array(GRID_CELLS_X);
    for (let gx = 0; gx < GRID_CELLS_X; gx++) {
        $.nbhd[gx] = new Array(GRID_CELLS_Y);
        for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
            $.nbhd[gx][gy] = [];
            for (let [ox, oy] of NBHD_OFFSETS) {
                if (!$.particles[gx + ox]?.[gy + oy]) {
                    continue;
                }
                $.nbhd[gx][gy].push($.particles[gx + ox][gy + oy]);
            }
        }
    }

    $.particleCount = 0;
    $.boatX = 0;
    $.boatY = 0;
    $.boatVX = 0;
    $.boatVY = 0;
    $.boatDens = 0;
}
function emptyMemory() {
    delete $.particles;
    delete $.nbhd;
    delete $.particleCount;
    delete $.boatX;
    delete $.boatY;
    delete $.boatVX;
    delete $.boatVY;
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

    const dx = particle[PARTICLE_FUTURE_X] - $.boatX;
    const dy = particle[PARTICLE_FUTURE_Y] - $.boatY;
    if (dx < SMOOTHING_R_BOAT && dx > -SMOOTHING_R_BOAT && dy < SMOOTHING_R_BOAT && dy > -SMOOTHING_R_BOAT) {
        const particleBoatDist = distanceApprox(dx, dy);
        particle[PARTICLE_DENS] -= smoothing(particleBoatDist, SMOOTHING_R);
        $.boatDens += smoothing(particleBoatDist, SMOOTHING_R_BOAT);
    }

    Physics.iterateNbhd(updateDensityItem, nbhd, particle);
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
function addForces(gx, gy, di, particle, nbhd) {
    let forceX = 0;
    let forceY = 0;
    let _particle;
    for (let cell of nbhd) {
        for (_particle of cell) {
            if (particle === _particle) {
                continue;
            }

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
            let pressure = densityToPressure(particle[PARTICLE_DENS], DENS_OF_WATER, PRESSURE_MULT)
                * smoothingDeriv(dist, SMOOTHING_R, SMOOTHING_DERIV_SCALE)
                / particle[PARTICLE_DENS]
                / dist;
            
            if (pressure < 0) {
                pressure *= PRESSURE_MULT_NEG;
            } else {
                pressure *= PRESSURE_MULT_POS;
            }

            const dx = _particle[PARTICLE_X] - particle[PARTICLE_X];
            const dy = _particle[PARTICLE_Y] - particle[PARTICLE_Y];
            
            forceX += pressure * (dx + dxFuture) / 2;
            forceY += pressure * (dy + dyFuture) / 2;
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
function addBoatForce() {
    const gx = Math.floor($.boatX / GRID_CELL_SIZE);
    const gy = Math.floor($.boatY / GRID_CELL_SIZE);
    const nbhd = Physics.getNbhd(gx, gy);

    let forceX = 0;
    let forceY = 0;
    for (let cell of nbhd) {
        for (let particle of cell) {
            const dx = particle[PARTICLE_X] - $.boatX;
            const dy = particle[PARTICLE_Y] - $.boatY;
            const dsq = dx ** 2 + dy ** 2;
            const d = dsq ** 0.5;
            let pressure = densityToPressure($.boatDens, DENS_OF_WATER, PRESSURE_MULT)
                * smoothingDeriv(d, SMOOTHING_R, SMOOTHING_DERIV_SCALE)
                / $.boatDens
                / d;
            
            if (pressure < 0) {
                pressure *= PRESSURE_MULT_NEG;
            } else {
                pressure *= PRESSURE_MULT_POS;
            }
            forceX += pressure * dx;
            forceY += -Math.abs(-pressure * dy);
        }
    }
    $.boatVX -= forceX * FIXED_FRAMETIME * BOAT_PRESSURE_MULT_X;
    $.boatVY -= forceY * FIXED_FRAMETIME * BOAT_PRESSURE_MULT_Y;

    $.boatVX += state.movement[0] * FIXED_FRAMETIME / 1500;
    if (state.movement[1] > 0) {
        $.boatVY += state.movement[1] * FIXED_FRAMETIME / 1500;
    } else {
        $.boatVY += state.movement[1] * FIXED_FRAMETIME / 120;
    }
    
    $.boatVX *= BOAT_DAMP;
    $.boatVY = ($.boatVY + GRAVITY) * BOAT_DAMP;

    const currVSq = $.boatVX**2 + $.boatVY**2;
    if (currVSq > BOAT_VEL_LIM_SQ) {
        const damp = BOAT_VEL_LIM_SQ / currVSq;
        $.boatVX *= damp;
        $.boatVY *= damp;
    }
}
function integrateForces(gx, gy, di, particle) {
    particle[PARTICLE_X] += particle[PARTICLE_VX] * FIXED_FRAMETIME;
    particle[PARTICLE_Y] += particle[PARTICLE_VY] * FIXED_FRAMETIME;
}
function waterWallCollisions() {
    for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
        for (let particle of $.particles[0][gy]) {
            if (particle[PARTICLE_X] < 0) {
                particle[PARTICLE_X] = 0;
                particle[PARTICLE_VX] *= -WALL_BOUNCINESS;
                particle[PARTICLE_VY] *= WALL_BOUNCINESS;
            }
        }
        for (let particle of $.particles[GX_LAST][gy]) {
            if (particle[PARTICLE_X] > X_LAST) {
                particle[PARTICLE_X] = X_LAST;
                particle[PARTICLE_VX] *= -WALL_BOUNCINESS;
                particle[PARTICLE_VY] *= WALL_BOUNCINESS;
            }
        }
    }
    for (let gx = 0; gx < GRID_CELLS_X; gx++) {
        for (let particle of $.particles[gx][0]) {
            if (particle[PARTICLE_Y] < 0) {
                particle[PARTICLE_Y] = 0;
                particle[PARTICLE_VX] *= WALL_BOUNCINESS;
                particle[PARTICLE_VY] *= -WALL_BOUNCINESS;
            }
        }
        for (let particle of $.particles[gx][GY_LAST]) {
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
    $.particles[gx][gy].splice(di, 1);
    $.particles[newGX][newGY].push(particle);
    
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


const mousePos = [0, 0];
const radius = 200;
const power = 0.0003;
let exploding = false;
let inverted = false;
function explode(x, y) {
    for (let gx = 0; gx < GRID_CELLS_X; gx++) {
        for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
            if (!$.particles[gx][gy].length) {
                continue;
            }
            for (let di = 0; di < $.particles[gx][gy].length; di++) {
                const dx = x - $.particles[gx][gy][di][0];
                const dy = y - $.particles[gx][gy][di][1];
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
                    $.particles[gx][gy][di][2] += nx * s * power;
                    $.particles[gx][gy][di][3] += ny * s * power;
                } else {
                    $.particles[gx][gy][di][2] -= nx * s * power;
                    $.particles[gx][gy][di][3] -= ny * s * power;
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
