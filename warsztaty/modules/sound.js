import SubscriberPublisher from "../helpers/SubscriberPublisher.js";

let events = null;
let state = null;
let $;
export default class Sound {
    static eventSubscribers = {
        start,
        stop
    };
    static #state = {};
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Sound.eventSubscribers);
        $ = Sound.#state;
    }
}

/**
 * Subscribers
 */
function start() {
    $.ctx = new AudioContext();
    $.gain = $.ctx.createGain();
    $.gain.connect($.ctx.destination);
    $.musicGain = $.ctx.createGain();
    $.musicGain.connect($.gain);
    $.musicGain.gain.value = settings.elements.music.valueAsNumber / parseFloat(settings.elements.music.max);
    $.sfxGain = $.ctx.createGain();
    $.sfxGain.connect($.gain);
    $.sfxGain.gain.value = settings.elements.sfx.valueAsNumber / parseFloat(settings.elements.sfx.max);
}
function stop() {

}
/**
 * Private
 */