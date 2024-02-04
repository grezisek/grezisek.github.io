import SubscriberPublisher from "../helpers/SubscriberPublisher.js";

import Particles, {
    PARTICLE_X,
    PARTICLE_Y,
    PARTICLE_DENS,
    PARTICLE_TYPE,
} from "./particles.js";
import {
    DENS_OF_WATER,
} from "./physics.js";
import Initializer, {
    GAME_SIZE_X,
    GAME_SIZE_Y,
} from "./initializer.js";

const squareMesh = new Float32Array([
    -0.5, -0.5,
    0.5, -0.5,
    -0.5, 0.5,
    0.5, 0.5,
]);
const squareTexcoord = new Float32Array([
    0, 1,
    1 / 5, 1,
    0, 0,
    1 / 5, 0,

    1 / 5, 1,
    1, 1,
    1 / 5, 1,
    1, 1,
]);


export const TYPE_DENSE = 0;
export const TYPE_AIRY = 1;
export const TYPE_OBSTACLE = 2;
export const TYPE_HEALTH = 3;
export const PARTICLE_TYPES = [
    TYPE_DENSE,
    TYPE_AIRY,
    TYPE_OBSTACLE,
    TYPE_HEALTH,
];

const TEXTURES_URL = "./images/textures.png";
export const BOAT_SIZE = 64;
export const WATER_RADIUS = 8;

const VERTEX_SHADER_CODE = `#version 300 es
precision highp float;
uniform float scale;
uniform int textureIndex;
vec2 gameSize = vec2(${GAME_SIZE_X}.0, ${GAME_SIZE_Y}.0);
vec2 toClipSpace(vec2 vertexPosition, vec2 modelPosition) {
    vec2 scaled = scale * vertexPosition;
    vec2 normalized = (scaled + modelPosition) / gameSize;
    vec2 inClipSpace = normalized * 2.0 - vec2(1.0, 1.0);
    return inClipSpace;
}

in vec2 vertexPosition;
in vec2 textureCoord;
in vec2 position;
out vec2 texCoord;
void main() {
    texCoord = textureCoord;
    texCoord.x = texCoord.x + float(textureIndex) / 5.0;
    gl_Position = vec4(toClipSpace(vertexPosition, position) - vec2(0.01, 0.0), 0.0, 1.0);
}
`;
const FRAGMENT_SHADER_CODE = `#version 300 es
precision highp float;
in vec2 texCoord;
uniform sampler2D texImg;
out vec4 fragColor;
void main() {
    fragColor = texture(texImg, texCoord);
}
`;

let events = null;
let state = null;
let $;
export default class Graphics {
    static eventSubscribers = {
        start,
        stop,
        play,
        pause,
        update,
    };
    static #state = {};
    static setup(eventsRef, stateRef) {
        events = eventsRef;
        state = stateRef;
        SubscriberPublisher.autosubscribe(events, Graphics.eventSubscribers);

        $ = Graphics.#state;
        $.textures = new Image()

        canvas.width = GAME_SIZE_X * devicePixelRatio;
        canvas.height = GAME_SIZE_Y * devicePixelRatio;
    }
}

/**
 * Subscribers
 */
function start() {
    createMemory();

    in_game.classList.add("is-in-game");
    if (settings.elements.fullscreen.checked) {
        Initializer.wait();
        Initializer.promiseReady(in_game.requestFullscreen());
    }
}
function stop() {
    in_game.classList.remove("is-in-game");
    in_game.classList.remove("is-in-pause");
    emptyMemory();
}
function play() {
    
}
function pause() {
    in_game.classList.toggle("is-in-pause", state.paused);
}
function update(dt) {
    if (!state.playing || state.paused) {
        return;
    }
    $.ctx.clear($.ctx.COLOR_BUFFER_BIT | $.ctx.DEPTH_BUFFER_BIT);
    $.ctx.viewport(0, 0, canvas.width, canvas.height);
    $.ctx.bindVertexArray($.vertexArray);
    createDrawData();
    drawParticles();
    drawBoat();
}


/**
 * Private
 */
function createMemory() {
    prepareRendering();
    prepareTextures();
}
function emptyMemory() {
    clearRendering();
    clearTextures();
}

function prepareRendering() {
    $.ctx = canvas.getContext("webgl2");
    $.ctx.viewport(0, 0, canvas.width, canvas.height);
    $.ctx.clearColor(0.8, 0.9, 1, 1);
    $.ctx.enable($.ctx.BLEND);
    $.ctx.blendFunc($.ctx.SRC_ALPHA, $.ctx.ONE_MINUS_SRC_ALPHA);
    $.ctx.enable($.ctx.CULL_FACE);
    $.ctx.cullFace($.ctx.BACK);

    $.vertexShader = $.ctx.createShader($.ctx.VERTEX_SHADER);
    $.ctx.shaderSource($.vertexShader, VERTEX_SHADER_CODE);
    $.ctx.compileShader($.vertexShader);

    $.fragmentShader = $.ctx.createShader($.ctx.FRAGMENT_SHADER);
    $.ctx.shaderSource($.fragmentShader, FRAGMENT_SHADER_CODE);
    $.ctx.compileShader($.fragmentShader);

    $.shaderProgram = $.ctx.createProgram();
    $.ctx.attachShader($.shaderProgram, $.vertexShader);
    $.ctx.attachShader($.shaderProgram, $.fragmentShader);
    $.ctx.linkProgram($.shaderProgram);
    $.ctx.useProgram($.shaderProgram);

    $.vertexArray = $.ctx.createVertexArray();
    $.ctx.bindVertexArray($.vertexArray);

    $.squareModelAttributeLocation = $.ctx.getAttribLocation($.shaderProgram, "vertexPosition");
    $.squareTexcoordAttributeLocation = $.ctx.getAttribLocation($.shaderProgram, "textureCoord");
    $.pDataAttributeLocation = $.ctx.getAttribLocation($.shaderProgram, "position");
    $.scaleUniformLocation = $.ctx.getUniformLocation($.shaderProgram, "scale");
    $.textureIndexUniformLocation = $.ctx.getUniformLocation($.shaderProgram, "textureIndex");
    
    $.squareModelBuffer = $.ctx.createBuffer();
    $.ctx.bindBuffer($.ctx.ARRAY_BUFFER, $.squareModelBuffer);
    $.ctx.bufferData($.ctx.ARRAY_BUFFER, squareMesh, $.ctx.STATIC_DRAW);
    $.ctx.enableVertexAttribArray($.squareModelAttributeLocation);
    $.ctx.vertexAttribPointer($.squareModelAttributeLocation, 2, $.ctx.FLOAT, false, 0, 0);
    
    $.squareTexcoordBuffer = $.ctx.createBuffer();
    $.ctx.bindBuffer($.ctx.ARRAY_BUFFER, $.squareTexcoordBuffer);
    $.ctx.bufferData($.ctx.ARRAY_BUFFER, squareTexcoord, $.ctx.STATIC_DRAW);
    $.ctx.enableVertexAttribArray($.squareTexcoordAttributeLocation);
    $.ctx.vertexAttribPointer($.squareTexcoordAttributeLocation, 2, $.ctx.FLOAT, false, 0, 0);

    $.particlesDrawData = new Array(PARTICLE_TYPES.length);
    for (let pType = 0; pType < PARTICLE_TYPES.length; pType++) {
        $.particlesDrawData[pType] = [];
    }
    
    $.pDataBuffer = $.ctx.createBuffer();
    $.ctx.bindBuffer($.ctx.ARRAY_BUFFER, $.pDataBuffer);
    $.ctx.bufferData($.ctx.ARRAY_BUFFER, new Float32Array(), $.ctx.DYNAMIC_DRAW);
    $.ctx.enableVertexAttribArray($.pDataAttributeLocation);
    $.ctx.vertexAttribPointer($.pDataAttributeLocation, 2, $.ctx.FLOAT, false, 0, 0);
    $.ctx.vertexAttribDivisor($.pDataAttributeLocation, 1);
}
function prepareTextures() {
    Initializer.wait();
    Initializer.promiseReady(new Promise((res) => {
        $.textures.src = TEXTURES_URL;
        $.textures.onload = () => {
            $.ctxTextures = $.ctx.createTexture();
            $.ctx.activeTexture($.ctx.TEXTURE0);
            $.ctx.bindTexture($.ctx.TEXTURE_2D, $.ctxTextures);
            $.ctx.texImage2D($.ctx.TEXTURE_2D, 0, $.ctx.RGBA,
                $.textures.width, $.textures.height,
                0, $.ctx.RGBA, $.ctx.UNSIGNED_BYTE,
                $.textures
            );
            $.ctx.texParameteri($.ctx.TEXTURE_2D, $.ctx.TEXTURE_MIN_FILTER, $.ctx.NEAREST);
            res($.textures);
        };
    }));
}
function clearRendering() {
    $.ctx.deleteBuffer($.pDataBuffer);
    $.ctx.deleteBuffer($.squareModelBuffer);
    $.ctx.deleteBuffer($.squareTexcoordBuffer);
    $.ctx.deleteVertexArray($.vertexArray);
    $.ctx.deleteShader($.vertexShader);
    $.ctx.deleteShader($.fragmentShader);
    $.ctx.deleteProgram($.shaderProgram);
    delete $.pDataBuffer;
    delete $.squareModelBuffer;
    delete $.squareTexcoordBuffer;
    delete $.vertexArray;
    delete $.vertexShader;
    delete $.fragmentShader;
    delete $.shaderProgram;
    delete $.ctx;
}
function clearTextures() {
    delete $.textures.src;
}
function pTypeToTextureIndex(type) {
    return type + 1;
}
function pTypeToScale(type) {
    if (type == TYPE_AIRY || type == TYPE_DENSE) {
        return 2 * WATER_RADIUS;
    }
    if (type == TYPE_HEALTH || type == TYPE_OBSTACLE) {
        return 4 * WATER_RADIUS;
    }
    return 1;
}
function createDrawData() {
    for (let data of $.particlesDrawData) {
        data.length = 0;
    }
    Particles.iterateParticles(addParticleDrawData);
    $.boatDrawData = [
        state.boatX,
        state.boatY,
    ];
}
function updateWaterType(gx, gy, di, particle) {
    if (particle[PARTICLE_DENS] > DENS_OF_WATER * 1.3) {
        if (particle[PARTICLE_TYPE] == TYPE_AIRY) {
            particle[PARTICLE_TYPE] = TYPE_DENSE;
        }
    } else if (particle[PARTICLE_TYPE] == TYPE_DENSE) {
        particle[PARTICLE_TYPE] = TYPE_AIRY;
    }
}
function addParticleDrawData(gx, gy, di, particle) {
    if (!$.particlesDrawData[particle[PARTICLE_TYPE]]) {
        $.particlesDrawData[particle[PARTICLE_TYPE]] = [
            particle[PARTICLE_X],
            particle[PARTICLE_Y],
        ];
    } else {
        $.particlesDrawData[particle[PARTICLE_TYPE]].push(
            particle[PARTICLE_X],
            particle[PARTICLE_Y],
        );
    }
}

function drawBoat() {
    $.ctx.uniform1i($.textureIndexUniformLocation, 0);
    $.ctx.uniform1f($.scaleUniformLocation, BOAT_SIZE);
    $.ctx.bindBuffer($.ctx.ARRAY_BUFFER, $.pDataBuffer);
    $.ctx.bufferData($.ctx.ARRAY_BUFFER, new Float32Array($.boatDrawData), $.ctx.STATIC_DRAW);
    $.ctx.drawArrays($.ctx.TRIANGLE_STRIP, 0, 4);
}

function drawParticles() {
    Particles.iterateParticles(updateWaterType);
    for (let pType = 0; pType < $.particlesDrawData.length; pType++) {
        if (!$.particlesDrawData[pType]) {
            console.log("tp", pType);
            continue;
        }
        $.ctx.uniform1i($.textureIndexUniformLocation, pTypeToTextureIndex(pType));
        $.ctx.uniform1f($.scaleUniformLocation, pTypeToScale(pType));
        $.ctx.bindBuffer($.ctx.ARRAY_BUFFER, $.pDataBuffer);
        $.ctx.bufferData($.ctx.ARRAY_BUFFER, new Float32Array($.particlesDrawData[pType]), $.ctx.DYNAMIC_DRAW);
        $.ctx.drawArraysInstanced($.ctx.TRIANGLE_STRIP, 0, 4, $.particlesDrawData[pType].length / 2);
    }
}