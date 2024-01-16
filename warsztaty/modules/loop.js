import SubscriberPublisher from "../helpers/SubscriberPublisher.js";
import { FIXED_FRAMETIME } from "./physics.js";

const SKIP_FIXED_FRAME_AFTER = 5;

let events = null;
let state = null;
export default class Loop {
    static eventSubscribers = {
        start,
        stop,
    };
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Loop.eventSubscribers);
    }
}

/**
 * Subscribers
 */
function start() {
    state.lastTimestamp = performance.now() - 10;
    state.fixedUpdateTimeAcc = 0;
    state.frame = requestAnimationFrame(loop);
}
function stop() {
    cancelAnimationFrame(state.frame);
    delete state.frame;
    delete state.lastTimestamp;
    delete state.currentTimestamp;
    delete state.frameTime;
    delete state.fixedUpdateTimeAcc;
}

/**
 * Private
 */
function loop() {
    state.currentTimestamp = performance.now();
    state.frameTime = state.currentTimestamp - state.lastTimestamp;

    state.fixedUpdateTimeAcc += state.frameTime;
    let skipAcc = SKIP_FIXED_FRAME_AFTER;
    while (state.fixedUpdateTimeAcc > FIXED_FRAMETIME) {
        events.fixedUpdate.publish(FIXED_FRAMETIME);
        state.fixedUpdateTimeAcc -= FIXED_FRAMETIME;
        skipAcc--;
        if (!skipAcc) {
            state.fixedUpdateTimeAcc = 0;
            break;
        }
    }
    events.update.publish(state.frameTime);
    
    state.lastTimestamp = state.currentTimestamp;
    state.frame = requestAnimationFrame(loop);
}