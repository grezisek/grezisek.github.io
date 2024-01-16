import SubscriberPublisher from "../helpers/SubscriberPublisher.js";

let events = null;
let state = null;
export default class Sound {
    static eventSubscribers = {};
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Sound.eventSubscribers);
        updateSettings();
    }
}

/**
 * Subscribers
 */

/**
 * Private
 */
function updateSettings() {
    state.music = settings.elements.music.valueAsNumber;
    state.sfx = settings.elements.sfx.valueAsNumber;
}