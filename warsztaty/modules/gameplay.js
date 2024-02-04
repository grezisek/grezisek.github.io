import SubscriberPublisher from "../helpers/SubscriberPublisher.js";
import { distanceSq } from "../helpers/math.js";
import {
    TYPE_HEALTH,
    TYPE_OBSTACLE,
    BOAT_SIZE,
    WATER_RADIUS,
} from "./graphics.js";
import Particles, {
    GRID_CELL_SIZE,
    GRID_CELLS_Y,
    PARTICLE_TYPE,
    PARTICLE_X,
    PARTICLE_Y,
    X_LAST,
} from "./particles.js";
import {
    GAME_SIZE_X,
    GAME_SIZE_Y,
} from "../modules/initializer.js";
import Resources from "./resources.js";

const waterInitialLevel = 0.45; //0.4 7.5ms
const waterInitialDensity = 1.6;
const boatInitialX = 960;
const boatInitialY = 540*1.8;

let events = null;
let state = null;
let $;
export default class Gameplay {
    static eventSubscribers = {
        start,
        stop,
        readyToPlay,
        fixedUpdate,
        play,
        gameover,
        restart,
    };
    static #state = {};
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Gameplay.eventSubscribers);
        
        $ = Gameplay.#state;
        state.gameplay = $;
        state.waterCountOverflow = 500;
        state.targetWaterCount = 4000;
        state.newWaterPerFrame = 64;
        state.removalThreshold = 0.2;
        state.bonusThreshold = 0.0001;
        state.obstacleThreshold = 0.001;
        state.pickupRangeSq = (BOAT_SIZE / 2 + WATER_RADIUS * 4) ** 2;
        state.obstacleRangeSq = (BOAT_SIZE / 2 + WATER_RADIUS * 4) ** 2;
    }
}

/**
 * Subscribers
 */
function start() {
    placeBoatAtStart();
    createParticles();
}
function stop() {
    state.playing = false;
}
function readyToPlay() {
    state.playing = true;
    events.play?.publish();
}
function play() {
}
function fixedUpdate() {
    if (!state.playing || state.paused) {
        return;
    }
    removeOldParticle();
    addNewParticle();
    logWaterCount();
    handleBoatCollisions();
}
function gameover(score) {
    in_game.classList.add("is-in-gameover");
}
function restart() {
    removeParticles();
    placeBoatAtStart();
    createParticles();
    in_game.classList.remove("is-in-gameover");
}

/**
 * Private
 */
function placeBoatAtStart() {
    state.boatX = boatInitialX;
    state.boatY = boatInitialY;
    state.boatVX = 0;
    state.boatVY = 0;
}

function createParticles() {
    let randomX = 5;
    for (let x = 0; x < GAME_SIZE_X - randomX; x += GRID_CELL_SIZE / waterInitialDensity) {
        for (let y = 0; y < GAME_SIZE_Y * waterInitialLevel; y += GRID_CELL_SIZE / waterInitialDensity) {
            Particles.addParticle(x + Math.random() * randomX, y, 0, 0, 0);
        }
    }
}

function removeOldParticle() {
    if (state.particleCount < state.targetWaterCount) {
        return;
    }
    removal: for (let gy = 0; gy < GRID_CELLS_Y; gy++) {
        for (let di = 0; di < state.particles[0][gy].length; di++) {
            if (state.particles[0][gy][di][0] < 3) {
                if (Math.random() < state.removalThreshold) {
                    Particles.removeParticle(0, gy, di);
                    if (state.particleCount < state.targetWaterCount) {
                        break removal;
                    }
                }
            }
        }
    }
}
let benchmarkTime = 30_000;
function addNewParticle() {
    let i = state.newWaterPerFrame;
    let yOffset = 0;
    while (i > 0 && state.particleCount < state.targetWaterCount + state.waterCountOverflow) {
        if (!state.benchmarkUntil) {
            state.benchmarkUntil = performance.now() + benchmarkTime;
            state.benchmark = [];
        }
        Particles.addParticle(
            X_LAST - Math.random(), Math.random() + GAME_SIZE_Y / 8 + yOffset,
            0, 0,
            randomParticle()
        );
        yOffset += 8;
        i--;
    }
}
function randomParticle() {
    const rand = Math.random();
    if (rand < state.bonusThreshold) {
        return randomBonus();
    }

    if (rand < state.obstacleThreshold) {
        return randomObstacle();
    }

    return 0;
}
function randomBonus() {
    return 3;
}
function randomObstacle() {
    return 2;
}

function removeParticles() {
    Particles.iterateCells(Particles.emptyCell);
}

let lastCount = 0;
const countRounding = 500;
function logWaterCount() {
    let newCount = Math.round(state.particleCount / countRounding) * countRounding;
    if (newCount != lastCount) {
        lastCount = newCount;
        console.log("count: ", lastCount);
    }
}

function handleBoatCollisions() {
    Particles.iterateNbhd(handleBoatCollisionsItem, Particles.getNbhd(
        Math.floor(state.boatX / GRID_CELL_SIZE),
        Math.floor(state.boatY / GRID_CELL_SIZE),
    ));
}
function handleBoatCollisionsItem(particle) {
    switch (particle[PARTICLE_TYPE]) {
    case TYPE_HEALTH:
        if (distanceSq(
            particle[PARTICLE_X],
            particle[PARTICLE_Y],
            state.boatX,
            state.boatY,
        ) < state.pickupRangeSq) {
            Resources.changeHP(15);
            Resources.changeScore(15);
            particle[PARTICLE_X] = -1;
        }
        break;
    case TYPE_OBSTACLE:
        if (distanceSq(
            particle[PARTICLE_X],
            particle[PARTICLE_Y],
            state.boatX,
            state.boatY,
        ) < state.obstacleRangeSq) {
            Resources.changeHP(-25);
            Resources.changeScore(5);
            particle[PARTICLE_X] = -1;
        }
        break;
    default: break;
    }
}