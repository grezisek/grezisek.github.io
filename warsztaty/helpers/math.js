import {
    GAME_ASPECT_RATIO,
    GAME_SIZE_X,
    GAME_SIZE_Y,
} from "../modules/physics.js";

export function viewport() {
    let targetWidth = innerHeight * GAME_ASPECT_RATIO;
    let targetHeight = innerHeight;
    let scale = innerHeight / GAME_SIZE_Y;
    if (innerWidth / innerHeight <= GAME_ASPECT_RATIO) {
        targetWidth = innerWidth;
        targetHeight = innerWidth / GAME_ASPECT_RATIO;
        scale = innerWidth / GAME_SIZE_X;
    }

    const diffX = innerWidth - targetWidth;
    const diffY = innerHeight - targetHeight;
    return [
        diffX / 2 * devicePixelRatio,
        diffY / 2 * devicePixelRatio,
        (innerWidth - diffX) * devicePixelRatio,
        (innerHeight - diffY) * devicePixelRatio,
        scale
    ];
}
export function mapIntoViewport(x, y, viewport) {
    return [
        mapXIntoViewport(x, viewport),
        mapYIntoViewport(y, viewport),
    ];
}
export function mapXIntoViewport(x, viewport) {
    return x / GAME_SIZE_X * viewport[2] + viewport[0];
}
export function mapYIntoViewport(y, viewport) {
    return (GAME_SIZE_Y - y) / GAME_SIZE_Y * viewport[3] + viewport[1];
}
export function mapFromViewport(x, y, viewport) {
    return [
        (x - viewport[0] / devicePixelRatio) * GAME_SIZE_X / viewport[2] * devicePixelRatio,
        GAME_SIZE_Y - (y - viewport[1] / devicePixelRatio) * GAME_SIZE_Y / viewport[3] * devicePixelRatio
    ];
}

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
export function clampToRatio(value, min, max) {
    return (clamp(value, min, max) - min) / (max - min);
}
export function distanceSq(x1, y1, x2, y2) {
    return (x2 - x1) ** 2 + (y2 - y1) ** 2;
}
export function distanceApprox(dx, dy, min = 1) {
    if (!(dx < min && dx > -min && dy < min && dy > -min)) {
        return (dx ** 2 + dy ** 2) ** 0.5;
    }
    return min;
}

export function lerp(a, b, ratio) {
    return a * (1 - ratio) + b * ratio;
}