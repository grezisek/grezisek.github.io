import SubscriberPublisher from "../helpers/SubscriberPublisher.js";
import { clamp } from "../helpers/math.js";

const boatMaxHealth = 100;

let events = null;
let state = null;
let $;
export default class Resources {
    static eventSubscribers = {
        start,
        stop,
        damaged,
        healed,
        scored,
        gameover,
        restart,
    };
    static #state = {};
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Resources.eventSubscribers);
        
        $ = Resources.#state;
        hp.max = boatMaxHealth.toString();
    }
    static changeHP(amount) {
        $.hp = clamp($.hp + amount, 0, parseFloat(hp.max));
        if (amount > 0) {
            events.healed.publish($.hp);
        } else if (amount < 0) {
            events.damaged.publish($.hp);
        }
        if ($.hp == 0) {
            events.gameover.publish($.score);
        }
    }
    static changeScore(amount) {
        $.score += amount;
        events.scored.publish($.score);
    }
}

/**
 * Subscribers
 */
function start() {
    createMemory();
    updateHPMeter();
    updateScoreMeter();
}
function stop() {
    emptyMemory();
}
function damaged() {
    updateHPMeter();
}
function healed() {
    updateHPMeter();
}
function scored() {
    updateScoreMeter();
}
function gameover(score) {
    $.scoreList.push(score);
    updateTopScores();
}
function restart() {
    $.hp = boatMaxHealth;
    $.score = 0;
    updateHPMeter();
    updateScoreMeter();
}

/**
 * Private
 */
function createMemory() {
    $.hp = boatMaxHealth;
    $.score = 0;
    $.scoreList = [];
    const storedScoreList = localStorage.getItem("scoreList");
    if (storedScoreList !== null) {
        $.scoreList = JSON.parse(storedScoreList);
    }
}
function emptyMemory() {
    delete $.hp;
    delete $.score;
    delete $.scoreList;
}

function updateHPMeter() {
    hp.value = $.hp;
    hp.textContent = $.hp.toString();
}
function updateScoreMeter() {
    score.value = $.score;
    score.textContent = $.score.toString();
}
function updateTopScores() {
    $.scoreList.sort((a, b) => a > b ? -1 : 1);
    top_scores.innerHTML = $.scoreList
        .map((s) => `<span>${s}</span>`)
        .join("");
    localStorage.setItem("scoreList", JSON.stringify($.scoreList));
}