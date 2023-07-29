const apiKey = "ddafNA5xyFLZKvHdMKR1mI6S2e91iX3rhJhTr6b8XgdH4fT4OhtPUMVOVK0mqjcW";
const pi2 = Math.PI * 2;
const radius = 0.05;

const state = {
    imageCtx: wajbuj_panel_canvas.getContext("2d"),
    audioCtx: null,
    audioSources: [],
    masterGainNode: null,
    gainNode: null,
    
    user: null,
    position: 0,
    wave: Math.round((wave.valueAsNumber ?? 0) * 10),
    
    loopFrame: null,
    data: [],
    abortController: null,

    timeRemaining: 1000,
    lastTimestamp: 0,

    request: null,
};

const UpdatePosition = (changeEvent) => {
    state.position = changeEvent.target.valueAsNumber ?? 0;
    wajbuj_panel_position.value = state.position;
    wajbuj_panel_position_slider.value = state.position;
};
const UpdateWave = (changeEvent) => {
    state.wave = Math.round((changeEvent.target.valueAsNumber ?? 0) * 10);
    wajbuj_panel_wave.value = changeEvent.target.valueAsNumber;
    wajbuj_panel_wave_slider.value = changeEvent.target.valueAsNumber;
};
const UpdateVolume = (changeEvent) => state.masterGainNode.gain.value = changeEvent.target.valueAsNumber / 100;
const ResizeCanvas = () => {
    const canvasRect = wajbuj_panel_canvas.getBoundingClientRect();
    wajbuj_panel_canvas.width = Math.floor(canvasRect.width * devicePixelRatio);
    wajbuj_panel_canvas.height = Math.floor(canvasRect.height * devicePixelRatio);
};

const Start = async () => {
    if (!wave.validity.valid || !state.wave) {
        alert("Wybierz falę");
        return;
    }

    state.user = fetch("https://eu-central-1.aws.data.mongodb-api.com/app/wajbuj-cjyqh/endpoint/wajbuj", {
        method: "POST",
        cache: "no-cache",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "api-key" : apiKey, w: state.wave }),
    });

    wajbuj_panel_wave.value = state.wave / 10;
    wajbuj_panel_wave_slider.value = state.wave / 10;

    wajbuj_panel_position.value = state.position;
    wajbuj_panel_position_slider.value = state.position;

    wajbuj_panel.showModal();
    document.body.classList.add("wajbuj-open");

    state.timeRemaining = 1000;
    state.lastTimestamp = performance.now();

    state.user = await state.user;

    if (!state.user.ok) {
        alert("Błąd połączenia");
        console.debug(state.user.text());
        return;
    }

    if (state.audioCtx === null) {
        state.audioCtx = new AudioContext();
        state.masterGainNode = state.audioCtx.createGain();
        state.masterGainNode.connect(state.audioCtx.destination);
        state.gainNode = state.audioCtx.createGain();
        state.gainNode.connect(state.masterGainNode);
    }

    state.user = await state.user.json();
    state.loopFrame = requestAnimationFrame(Loop);

    state.masterGainNode.gain.value = wajbuj_panel_volume.valueAsNumber / 100;
};
const Stop = () => {
    cancelAnimationFrame(state.loopFrame);
    state.loopFrame = null;

    for (let i = state.audioSources.length - 1; i >= 0; i--) {
        state.audioSources[i][0].stop();
        state.audioSources[i][0].disconnect();
        state.audioSources[i][1].disconnect();
        state.audioSources.pop();
    }

    if (state.abortController !== null) {
        state.abortController.abort();
        state.abortController = null;
    }
};
const Loop = () => {
    state.timeRemaining -= performance.now() - state.lastTimestamp;

    if (state.timeRemaining <= 0) {
        TimePassed();
        state.timeRemaining = 1000 - state.timeRemaining;
    }

    state.lastTimestamp = performance.now();
    state.loopFrame = requestAnimationFrame(Loop);
};

const TimePassed = async () => {
    state.data = await Wajbuj();

    for (let i = state.audioSources.length; i < state.data.length; i++) {
        state.audioSources[i] = [
            state.audioCtx.createOscillator(),
            state.audioCtx.createStereoPanner(),
        ];
        state.audioSources[i][0].type = "sine";
        state.audioSources[i][0].connect(state.audioSources[i][1]);
        state.audioSources[i][1].connect(state.gainNode);
        state.audioSources[i][0].start();
    }

    for (let i = state.audioSources.length - 1; i > state.data.length - 1; i--) {
        state.audioSources[i][0].stop();
        state.audioSources[i][0].disconnect();
        state.audioSources[i][1].disconnect();
        state.audioSources.pop();
    }

    let x, y;
    let r = Math.min(state.imageCtx.canvas.width, state.imageCtx.canvas.height) * radius / 2;
    
    state.imageCtx.clearRect(0, 0, state.imageCtx.canvas.width, state.imageCtx.canvas.height);
    state.imageCtx.fillStyle = window.getComputedStyle(document.body).getPropertyValue("--accent");
    state.imageCtx.beginPath();
    for (let i = 0; i < state.data.length; i++) {
        state.audioSources[i][0].frequency.setValueAtTime(state.data[i][0], state.audioCtx.currentTime);
        state.audioSources[i][1].pan.setValueAtTime(-state.data[i][1], state.audioCtx.currentTime);
        
        x = (1 - (state.data[i][1] + 1) / 2) * state.imageCtx.canvas.width;
        y = (1 - state.data[i][0] / 20000) * state.imageCtx.canvas.height;
        
        state.imageCtx.moveTo(x + r, y);
        state.imageCtx.arc(x, y, r, 0, pi2);
    }
    state.imageCtx.fill();

    state.gainNode.gain.value = state.audioSources.length ? 1 / state.audioSources.length : 1;

    wajbuj_panel_count.value = state.data.length;
};

const Wajbuj = async () => {
    state.abortController = new AbortController();

    let data = await fetch("https://eu-central-1.aws.data.mongodb-api.com/app/wajbuj-cjyqh/endpoint/w", {
        method: "POST",
        cache: "no-cache",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "api-key" : apiKey, d: `${state.user}${Math.floor((state.position + 1) / 2 * 99).toString().padStart(2, "0")}${state.wave}` }),
        signal: state.abortController.signal
    });

    if (!data.ok) {
        console.debug(request);
        return;
    }

    data = await data.json();

    state.abortController = null;

    if (data == "") {
        wajbuj_panel.close();
        return [];
    }

    data = data.split(",");

    for (const dataIndex in data) {
        data[dataIndex] = [parseInt(data[dataIndex].slice(2)) / 10, parseInt(data[dataIndex].slice(0, 2)) * 2 / -99 + 1];
    }

    return data;
};

wave.addEventListener("change", UpdateWave);
wajbuj_panel_volume.addEventListener("change", UpdateVolume);

wajbuj_panel_wave.addEventListener("change", UpdateWave);
wajbuj_panel_wave_slider.addEventListener("change", UpdateWave);
wajbuj_panel_position.addEventListener("change", UpdatePosition);
wajbuj_panel_position_slider.addEventListener("change", UpdatePosition);

wajbuj_panel.addEventListener("close", () => document.body.classList.remove("wajbuj-open"));
wajbuj_panel.addEventListener("close", Stop);
wajbuj_panel_close.addEventListener("click", () => wajbuj_panel.close());
wajbuj.addEventListener("click", Start);
window.addEventListener("resize", ResizeCanvas, { passive: true });
setTimeout(ResizeCanvas, 50);

let hue = Math.random() * 240 + 60;
setInterval(() => {document.documentElement.style.setProperty("--accent-hue", hue = (hue+0.05) % 360)}, 100);