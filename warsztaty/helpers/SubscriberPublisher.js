export default class SubscriberPublisher {
    static autosubscribe(events, subscribers) {
        for (let key of Object.keys(subscribers)) {
            if (!Object.hasOwn(events, key)) {
                events[key] = new SubscriberPublisher();
            }
            events[key].subscribe(subscribers[key]);
        }
    }
    
    constructor() {
        this.subscribers = [];
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }
    unsubscribe(callback) {
        const i = this.subscribers.indexOf(callback);
        if (i < 0) {
            return;
        }
        this.subscribers.splice(i, 1);
    }
    publish() {
        for (let callback of this.subscribers) {
            callback.apply(null, arguments);
        }
    }
}