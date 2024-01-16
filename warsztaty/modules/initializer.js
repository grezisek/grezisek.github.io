import SubscriberPublisher from "../helpers/SubscriberPublisher.js";

const MODULE_READY_TIMEOUT = 50;

let events = null;
let state = null;
export default class Initializer {
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        
        events.readyToPlay = new SubscriberPublisher();
        state.readyToPlay = {
            waiting: 0,
            wait(count = 1) {
                this.waiting += count;
            },
            ready() {
                requestIdleCallback(moduleReady, { timeout: MODULE_READY_TIMEOUT });
            },
            async promiseReady(promise) {
                await promise;
                moduleReady();
            }
        };
    }
}

/**
 * Subscribers
 */

/**
 * Private
 */
function moduleReady() {
    state.readyToPlay.waiting--;
    if (!state.readyToPlay.waiting) {
        events.readyToPlay.publish();
    }
}