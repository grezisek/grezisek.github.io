export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
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