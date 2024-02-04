import Initializer from "./modules/initializer.js";
import Loop from "./modules/loop.js";
import Graphics from "./modules/graphics.js";
import Physics from "./modules/physics.js";
import Particles from "./modules/particles.js";
import Controls from "./modules/controls.js";
import Resources from "./modules/resources.js";
import Sound from "./modules/sound.js";
import Gameplay from "./modules/gameplay.js";

// shared
const events = {};
const state = {};

// event creations and connections, refs setup
Initializer.setup(events, state);
Loop.setup(events, state);
Particles.setup(events, state);
Graphics.setup(events, state);
Physics.setup(events, state);
Controls.setup(events, state);
Resources.setup(events, state);
Sound.setup(events, state);
Gameplay.setup(events, state);

// lifecycle events triggers
function start() {
    events.start?.publish();
}
function stop(e) {
    events.stop?.publish();
}
function restart() {
    events.restart?.publish();
}
start_game.addEventListener("click", start);
stop_game.addEventListener("click", stop);
restart_game.addEventListener("click", restart);
