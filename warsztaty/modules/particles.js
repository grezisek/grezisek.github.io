import SubscriberPublisher from "../helpers/SubscriberPublisher.js";
import {
    GAME_SIZE_X,
    GAME_SIZE_Y,
} from "./initializer.js";

export const GRID_CELL_SIZE = 20;
export const GRID_CELLS_X_OFFSET = 2;

export const PARTICLE_X = 0;
export const PARTICLE_Y = 1;
export const PARTICLE_VX = 2;
export const PARTICLE_VY = 3;
export const PARTICLE_TYPE = 4;
export const PARTICLE_FUTURE_X = 5;
export const PARTICLE_FUTURE_Y = 6;
export const PARTICLE_DENS = 7;

export const GRID_CELLS_X = GAME_SIZE_X / GRID_CELL_SIZE + GRID_CELLS_X_OFFSET;
export const GRID_CELLS_Y = GAME_SIZE_Y / GRID_CELL_SIZE;
export const X_LAST = GRID_CELLS_X * GRID_CELL_SIZE - 1;
export const Y_LAST = GRID_CELLS_Y * GRID_CELL_SIZE - 1;
export const NBHD_OFFSETS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [0,0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
];

let events = null;
let state = null;
let $;
export default class Particles {
    static eventSubscribers = {
        start,
        stop,
    };
    static #state = {};
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Particles.eventSubscribers);
        $ = Particles.#state;
    }

    static addParticle(x, y, vx, vy, type) {
        const gx = Math.floor(x / GRID_CELL_SIZE);
        const gy = Math.floor(y / GRID_CELL_SIZE);
        state.particles[gx][gy].push([x, y, vx, vy, type, 0, 0, 0]);
        state.particleCount++;
    }
    static removeParticle(gx, gy, di) {
        state.particles[gx][gy].splice(di, 1);
        state.particleCount--;
    }
    static emptyCell(gx, gy) {
        state.particleCount -= state.particles[gx][gy].length;
        state.particles[gx][gy].length = 0;
    }

    static iterateCells(cb, arg) {
        for (let gx = 0; gx < GRID_CELLS_X; gx++) {
            for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
                if (!state.particles[gx][gy].length) {
                    continue;
                }
                cb(gx, gy, state.particles[gx][gy], arg);
            }
        }
    }
    static iterateParticles(cb, arg) {
        for (let gx = 0; gx < GRID_CELLS_X; gx++) {
            for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
                if (!state.particles[gx][gy].length) {
                    continue;
                }
                for (let di = 0; di < state.particles[gx][gy].length; di++) {
                    cb(gx, gy, di, state.particles[gx][gy][di], arg);
                }
            }
        }
    }
    static iterateParticlesWithNbhd(cb, arg) {
        for (let gx = 0; gx < GRID_CELLS_X; gx++) {
            for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
                if (!state.particles[gx][gy].length) {
                    continue;
                }
                for (let di = 0; di < state.particles[gx][gy].length; di++) {
                    cb(gx, gy, di, state.particles[gx][gy][di], state.nbhd[gx][gy], arg);
                }
            }
        }
    }
    static iterateNbhd(cb, nbhd, arg) {
        for (let ci = 0; ci < 9; ci++) {
            if (!nbhd[ci]) {
                continue;
            }
            for (let pi = 0; pi < nbhd[ci].length; pi++) {
                cb(nbhd[ci][pi], arg);
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
            
            _nbhd.push(state.particles[_gx][_gy]);
        }
    
        return _nbhd;
    }
    static getNbhd(gx, gy) {
        return state.nbhd[gx][gy];
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

/**
 * Private
 */
function createMemory() {
    state.particles = new Array(GRID_CELLS_X);
    for (let gx = 0; gx < GRID_CELLS_X; gx++) {
        state.particles[gx] = new Array(GRID_CELLS_Y);
        for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
            state.particles[gx][gy] = [];
        }
    }
    state.nbhd = new Array(GRID_CELLS_X);
    for (let gx = 0; gx < GRID_CELLS_X; gx++) {
        state.nbhd[gx] = new Array(GRID_CELLS_Y);
        for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
            state.nbhd[gx][gy] = [];
            for (let [ox, oy] of NBHD_OFFSETS) {
                if (!state.particles[gx + ox]?.[gy + oy]) {
                    continue;
                }
                state.nbhd[gx][gy].push(state.particles[gx + ox][gy + oy]);
            }
        }
    }

    state.particleCount = 0;
}
function emptyMemory() {
    delete state.particles;
    delete state.nbhd;
    delete state.particleCount;
}