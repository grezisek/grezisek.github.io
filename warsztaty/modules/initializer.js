import SubscriberPublisher from "../helpers/SubscriberPublisher.js";

export const GAME_SIZE_X = 1920;
export const GAME_SIZE_Y = 1080;
const MODULE_READY_TIMEOUT = 50;

let events = null;
let state = null;
let $;
export default class Initializer {
    static #state = {};
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        events.readyToPlay = new SubscriberPublisher();
        
        $ = Initializer.#state;
        $.waiting = 0;
    }
    static wait(count = 1) {
        $.waiting += count;
    }
    static ready() {
        requestIdleCallback(moduleReady, { timeout: MODULE_READY_TIMEOUT });
    }
    static async promiseReady(promise) {
        await promise;
        moduleReady();
    }
}

/**
 * Subscribers
 */

/**
 * Private
 */
function moduleReady() {
    $.waiting--;
    if (!$.waiting) {
        events.readyToPlay.publish();
    }
}