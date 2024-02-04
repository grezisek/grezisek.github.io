export default class LinkedList {
    constructor() {
        this.head = null;
        this.tail = null;
        this.length = 0;
    }
    push(value) {
        if (this.head !== null) {
            this.tail[0] = [null, value];
            this.tail = this.tail[0];
        }
        else {
            this.head = [null, value];
            this.tail = this.head;
        }
        this.length++;
    }
    shift() {
        if (this.head === null) {
            return;
        }
        const ret = this.head[1];
        this.head = this.head[0];
        this.length--;
        return ret;
    }
}