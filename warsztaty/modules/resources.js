import SubscriberPublisher from "../helpers/SubscriberPublisher.js";
import { clamp } from "../helpers/math.js";

const boatMaxHealth = 100;

let events = null;
let state = null;
export default class Resources {
    static eventSubscribers = {
        damaged,
        healed,
        scored,
    };
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Resources.eventSubscribers);

        state.hp = boatMaxHealth;
        hp.max = boatMaxHealth.toString();
        state.score = 0;
        updateHPMeter();
        updateScoreMeter();
    }
    static changeHP(amount) {
        state.hp = clamp(state.hp + amount, 0, parseFloat(hp.max));
        if (amount > 0) {
            events.healed.publish(state.hp);
        } else if (amount < 0) {
            events.damaged.publish(state.hp);
        }
        if (state.hp == 0) {
            events.gameover.publish(state.score);
        }
    }
    static changeScore(amount) {
        state.score += amount;
        events.scored.publish(state.score);
    }
}

/**
 * Subscribers
 */
function damaged() {
    updateHPMeter();
}
function healed() {
    updateHPMeter();
}
function scored() {
    updateScoreMeter();
}
/**
 * Private
 */
function updateHPMeter() {
    hp.value = state.hp;
    hp.textContent = state.hp.toString();
}
function updateScoreMeter() {
    score.value = state.score;
    score.textContent = state.score.toString();
}