import SubscriberPublisher from "../helpers/SubscriberPublisher.js";

let events = null;
let state = null;
let $;
export default class Controls {
    static keyMap = {
        "Escape": controlPause,
        "w": controlUp,
        "s": controlDown,
        "a": controlLeft,
        "d": controlRight,
        " ": controlBonus,
    };
    static defaultKeysState = [
        ["Escape", false],
        ["w", false],
        ["s", false],
        ["a", false],
        ["d", false],
        [" ", false],
    ];

    static eventSubscribers = {
        start,
        stop,
        gameover,
        restart,
    };
    static #state = {};
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Controls.eventSubscribers);
        
        $ = Controls.#state;

        addEventListener("keydown", onKeyDown);
        addEventListener("keyup", onKeyUp);
        document.addEventListener("visibilitychange", pause);
        document.addEventListener("visibilitychange", resetKeys);
        addEventListener("blur", pause);
        addEventListener("blur", resetKeys);
        addEventListener("fullscreenchange", onFullscreenChange);
        resume_game.addEventListener("click", resume);
        start_game.focus();
    }
}

/**
 * Subscribers
 */
function start() {
    $.keys = new Map(Controls.defaultKeysState);
    state.movement = [0, 0, 0];
    setTabindexesIn(document.body, "-1");
    start_game.blur();
}
function stop() {
    delete state.movement;
    delete $.keys;
    setTabindexesIn(document.body, "-1");
    setTabindexesIn(settings, "");
    start_game.tabindex = "";
    start_game.focus();
}
function gameover(score) {
    pause();
    setTabindexesIn(in_pause, "-1");
    setTabindexesIn(in_gameover, "");
}
function restart() {
    resume();
    setTabindexesIn(in_pause, "-1");
    setTabindexesIn(in_gameover, "-1");
}

/**
 * Private
 */
function onKeyDown(e) {
    if (!$?.keys) {
        return;
    }
    if (!$.keys.has(e.key)) {
        return;
    }
    if ($.keys.get(e.key)) {
        return;
    }
    $.keys.set(e.key, true);
    Controls.keyMap[e.key](true);
}
function onKeyUp(e) {
    if (!$?.keys) {
        return;
    }
    if (!$.keys.has(e.key)) {
        return;
    }
    if (!$.keys.get(e.key)) {
        return;
    }
    $.keys.set(e.key, false);
    Controls.keyMap[e.key](false);
}
function onFullscreenChange(e) {
    if (document.fullscreenElement !== null) {
        return;
    }

    controlPause(true);
}
function resetKeys() {
    for (let [key, val] of Controls.defaultKeysState) {
        if ($.keys.get(key) === val) {
            continue;
        }
        $.keys.set(key, val);
    }
    state.movement[0] = 0;
    state.movement[1] = 0;
    state.movement[2] = 0;
}

function controlPause(newKeyState) {
    if (!newKeyState) {
        return;
    }
    if (state.paused) {
        resume();
    } else {
        pause();
    }

    console.log("control pause", state.paused);
}
function controlUp(newKeyState) {
    if (newKeyState) {
        state.movement[1]++;
    } else {
        state.movement[1]--;
    }
}
function controlDown(newKeyState) {
    if (newKeyState) {
        state.movement[1]--;
    } else {
        state.movement[1]++;
    }
}
function controlLeft(newKeyState) {
    if (newKeyState) {
        state.movement[0]--;
    } else {
        state.movement[0]++;
    }
}
function controlRight(newKeyState) {
    if (newKeyState) {
        state.movement[0]++;
    } else {
        state.movement[0]--;
    }
}
function controlBonus(newKeyState) {
    if (newKeyState) {
        state.movement[2] = 1;
    } else {
        state.movement[2] = 0;
    }
    console.log("bonus", state.movement);
}

function pause() {
    if (state.paused) {
        return;
    }
    setTabindexesIn(in_pause, "");
    resume_game.focus();
    state.paused = true;
    events.pause?.publish(state.paused);
    console.log("pause function", state.paused);
}
function resume() {
    if (!state.paused) {
        return;
    }
    if (settings.elements.fullscreen.checked) {
        in_game.requestFullscreen();
    }
    resume_game.blur();
    setTabindexesIn(in_pause, "-1");
    state.paused = false;
    events.pause?.publish(state.paused);
    console.log("resume function", state.paused);
}

function setTabindexesIn(container, tabindex) {
    for (let node of container.querySelectorAll("button, input")) {
        node.setAttribute("tabindex", tabindex);
    }
}