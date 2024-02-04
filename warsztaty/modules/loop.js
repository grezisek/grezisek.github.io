import SubscriberPublisher from "../helpers/SubscriberPublisher.js";
import {
    FIXED_FRAMETIME,
} from "./physics.js";

const SKIP_FIXED_FRAME_AFTER = 5;

let events = null;
let state = null;
let $;
export default class Loop {
    static eventSubscribers = {
        start,
        stop,
    };
    static #state = {};
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Loop.eventSubscribers);
        $ = Loop.#state;
    }
}

/**
 * Subscribers
 */
function start() {
    $.lastTimestamp = performance.now() - 10;
    $.fixedUpdateTimeAcc = 0;
    $.frame = requestAnimationFrame(loop);
}
function stop() {
    cancelAnimationFrame($.frame);
    delete $.frame;
    delete $.lastTimestamp;
    delete state.currentTimestamp;
    delete $.frameTime;
    delete $.fixedUpdateTimeAcc;
}

/**
 * Private
 */
function loop() {
    state.currentTimestamp = performance.now();
    $.frameTime = state.currentTimestamp - $.lastTimestamp;

    $.fixedUpdateTimeAcc += $.frameTime;
    let skipAcc = SKIP_FIXED_FRAME_AFTER;
    while ($.fixedUpdateTimeAcc > FIXED_FRAMETIME) {
        events.fixedUpdate.publish(FIXED_FRAMETIME);
        $.fixedUpdateTimeAcc -= FIXED_FRAMETIME;
        skipAcc--;
        if (!skipAcc) {
            $.fixedUpdateTimeAcc = 0;
            break;
        }
    }
    events.update.publish($.frameTime);
    
    $.lastTimestamp = state.currentTimestamp;
    $.frame = requestAnimationFrame(loop);
}