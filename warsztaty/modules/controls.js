import SubscriberPublisher from "../helpers/SubscriberPublisher.js";

let events = null;
let state = null;
export default class Controls {
    static keyMap = {
        "Escape": pause,
        "w": up,
        "s": down,
        "a": left,
        "d": right,
        " ": bonus,
    };
    static defaultKeysState = [
        ["Escape", false],
        ["w", false],
        ["s", false],
        ["a", false],
        ["d", false],
        [" ", false],
    ];
    static movement = [0, 0, 0];

    static eventSubscribers = {
        start,
        stop,
    };
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Controls.eventSubscribers);
        
        addEventListener("keydown", onKeyDown);
        addEventListener("keyup", onKeyUp);
        document.addEventListener("visibilitychange", resetKeys);
        document.addEventListener("visibilitychange", forcePause);
        addEventListener("blur", forcePause);
        addEventListener("fullscreenchange", onFullscreenChange);
        resume_game.addEventListener("click", resume);
        start_game.focus();
    }
}

/**
 * Subscribers
 */
function start() {
    state.keys = new Map(Controls.defaultKeysState);
    state.movement = [0, 0, 0];
}
function stop() {
    delete state.movement;
    delete state.keys;
}

/**
 * Private
 */
function onKeyDown(e) {
    if (!state?.keys) {
        return;
    }
    if (!state.keys.has(e.key)) {
        return;
    }
    if (state.keys.get(e.key)) {
        return;
    }
    state.keys.set(e.key, true);
    Controls.keyMap[e.key](true);
}
function onKeyUp(e) {
    if (!state?.keys) {
        return;
    }
    if (!state.keys.has(e.key)) {
        return;
    }
    if (!state.keys.get(e.key)) {
        return;
    }
    state.keys.set(e.key, false);
    Controls.keyMap[e.key](false);
}
function onFullscreenChange(e) {
    if (document.fullscreenElement !== null) {
        return;
    }

    pause(true);
}
function resetKeys() {
    for (let [key, val] of Controls.defaultKeysState) {
        if (state.keys[key] === val) {
            continue;
        }
        state.keys[key] = val;
        Controls.keyMap[key](state.keys[key]);
    }
}

function pause(newKeyState) {
    if (!newKeyState) {
        return;
    }
    state.paused = !state.paused;
    events.pause?.publish(state.paused);
    if (state.paused) {
        resume_game.focus();
    }
    console.log("pause", state.paused);
}
function up(newKeyState) {
    if (newKeyState) {
        state.movement[1]++;
    } else {
        state.movement[1]--;
    }
    // console.log("up", state.movement);
}
function down(newKeyState) {
    if (newKeyState) {
        state.movement[1]--;
    } else {
        state.movement[1]++;
    }
    // console.log("down", state.movement);
}
function left(newKeyState) {
    if (newKeyState) {
        state.movement[0]--;
    } else {
        state.movement[0]++;
    }
    // console.log("left", state.movement);
}
function right(newKeyState) {
    if (newKeyState) {
        state.movement[0]++;
    } else {
        state.movement[0]--;
    }
    // console.log("right", state.movement);
}
function bonus(newKeyState) {
    if (newKeyState) {
        state.movement[2] = 1;
    } else {
        state.movement[2] = 0;
    }
    console.log("bonus", state.movement);
}

function forcePause() {
    if (state.paused) {
        return;
    }
    state.paused = true;
    events.pause?.publish(state.paused);
    console.log("force pause", state.paused);

}

function resume() {
    if (settings.elements.fullscreen.checked) {
        in_game.requestFullscreen();
    }
    pause(true);
}