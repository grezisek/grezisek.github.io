export default class Grid {
    #lengthX;
    #lengthY;
    constructor(lengthX, lengthY) {
        this.#lengthX = lengthX;
        this.#lengthY = lengthY;
        this.cells = new Array(lengthX);
        for (let x = 0; x < lengthX; x++) {
            this.cells[x] = new Array(lengthY);
            for (let y = 0; y < lengthY; y++) {
                this.cells[x][y] = [];
            }
        }
    }
    add(x, y, data) {
        try {
            this.cells[x][y].push(data);
        } catch(e) {
            console.warn(x, y);
        }
    }
    remove(x, y, i) {
        this.cells[x][y].splice(i, 1);
    }
    removeAll() {
        for (let x = 0; x < this.#lengthX; x++) {
            for (let y = 0; y < this.#lengthY; y++) {
                this.cells[x][y].length = 0;
            }
        }
    }
}