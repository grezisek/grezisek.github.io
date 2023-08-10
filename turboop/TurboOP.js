class TurboOP {
    static IsTransferable = (sus) => {
        return (sus instanceof ArrayBuffer
            || sus instanceof MessagePort
            || (typeof ReadableStream !== "undefined" && sus instanceof ReadableStream)
            || (typeof WritableStream !== "undefined" && sus instanceof WritableStream)
            || (typeof TransformStream !== "undefined" && sus instanceof TransformStream)
            || (typeof ImageBitmap !== "undefined" && sus instanceof ImageBitmap)
            || (typeof OffscreenCanvas !== "undefined" && sus instanceof OffscreenCanvas)
            || (typeof RTCDataChannel !== "undefined" && sus instanceof RTCDataChannel)
        // || (typeof VideoFrame !== "undefined" && sus instanceof VideoFrame)
        // || (typeof WebTransportReceiveStream !== "undefined" && sus instanceof WebTransportReceiveStream)
        // || (typeof AudioData !== "undefined" && sus instanceof AudioData)
        );
    };
    #cores;
    cores;
    #commandsToThread;
    constructor(commandsToThread, cores = navigator.hardwareConcurrency - 1) {
        this.cores = cores;
        this.#cores = new Array(this.cores);
        this.#commandsToThread = commandsToThread;
        const commandsKeys = Object.keys(commandsToThread);
        let commands = [];
        let withTransferableCallbacks = [];
        let withoutTransferableCallbacks = [];
        for (const key of commandsKeys) {
            if (commandsToThread[key].withTransferable) {
                commands.push(`${key}: (data, memory, asBunch) => {
                    if (asBunch) {
                        returnArgs = [new Array(data.length), new Array(data.length)];

                        for (let i = 0; i < data.length; i++) {
                            returnArgs[0][i] = commandsCallbacksT[${withTransferableCallbacks.length}](
                                new Float64Array(data[i]),
                                memory
                            ).buffer;
                        }

                        returnArgs[1] = returnArgs[0];
                        return;
                    }

                    // not bunch, but still buffer
                    returnArgs[0] = [
                        new Float64Array(
                            commandsCallbacksT[${withTransferableCallbacks.length}](
                                new Float64Array(data[0]),
                                memory
                            )
                        ).buffer
                    ];
                    returnArgs[1] = returnArgs[0];
                }`);
                withTransferableCallbacks.push(commandsToThread[key].toThread.toString());
            }
            else {
                commands.push(`${key}: (data, memory, asBunch) => {
                    returnArgs[1] = undefined;

                    if (asBunch) {
                        returnArgs[0] = new Array(data.length);
                        for (let i = 0; i < data.length; i++) {
                            returnArgs[0][i] = commandsCallbacks[${withoutTransferableCallbacks.length}](data[i], memory);
                        }
                        return;
                    }

                    returnArgs[0] = commandsCallbacks[${withoutTransferableCallbacks.length}](data, memory);
                }`);
                withoutTransferableCallbacks.push(commandsToThread[key].toThread.toString());
            }
        }
        commands = commands.join(",");
        withTransferableCallbacks = withTransferableCallbacks.join(",");
        withoutTransferableCallbacks = withoutTransferableCallbacks.join(",");
        for (let i = 0; i < cores; i++) {
            this.#cores[i] = new TurboOPCore(commands, withTransferableCallbacks, withoutTransferableCallbacks);
        }
        commands = undefined;
        withTransferableCallbacks = undefined;
        withoutTransferableCallbacks = undefined;
    }
    #CommandLeastBusyI;
    #CommandLeastBusyV;
    Command = (command, data, runOnMainThread = false) => {
        if (runOnMainThread) {
            return new Promise((resolve) => {
                resolve(this.#commandsToThread[command].toThread(data));
            });
        }
        this.#CommandLeastBusyI = -1;
        this.#CommandLeastBusyV = Infinity;
        for (let i = 0; i < this.#cores.length; i++) {
            if (this.#cores[i].busyness < this.#CommandLeastBusyV) {
                this.#CommandLeastBusyI = i;
                this.#CommandLeastBusyV = this.#cores[i].busyness;
            }
        }
        return this.#cores[this.#CommandLeastBusyI].Command(command, data, this.#commandsToThread[command].withTransferable);
    };
    CommandBunch = (command, data, runOnMainThread = false) => {
        if (runOnMainThread) {
            if (this.#commandsToThread[command].withTransferable) {
                return new Promise((resolve) => {
                    const result = new Array(data.length);
                    for (let i = 0; i < data.length; i++) {
                        result[i] = this.#commandsToThread[command].toThread(new Float64Array(data[i]));
                    }
                    resolve(result);
                });
            }
            return new Promise((resolve) => {
                const result = new Array(data.length);
                for (let i = 0; i < data.length; i++) {
                    result[i] = this.#commandsToThread[command].toThread(data[i]);
                }
                resolve(result);
            });
        }
        return new Promise(async (resolve) => {
            const coreData = new Array(this.#cores.length);
            const coreDataSize = Math.ceil(data.length / this.#cores.length);
            const transferables = this.#commandsToThread[command].withTransferable;
            let i = 0;
            for (; i < this.#cores.length; i++) {
                coreData[i] = data.slice(coreDataSize * i, coreDataSize * (i + 1));
            }
            i = 0;
            for (; coreData[i]; i++) {
                coreData[i] = this.#cores[i].Command(command, coreData[i], transferables, true);
            }
            i = 0;
            for (; coreData[i]; i++) {
                coreData[i] = await coreData[i];
            }
            const result = [];
            i = 0;
            for (; coreData[i]; i++) {
                result.push.apply(result, coreData[i]);
            }
            coreData.length = 0;
            resolve(result);
        });
    };
    CommandBunchAndMutate = (command, data, runOnMainThread = false) => {
        if (runOnMainThread) {
            if (this.#commandsToThread[command].withTransferable) {
                return new Promise((resolve) => {
                    for (let i = 0; i < data.length; i++) {
                        data[i] = this.#commandsToThread[command].toThread(new Float64Array(data[i]));
                    }
                    resolve();
                });
            }
            return new Promise((resolve) => {
                for (let i = 0; i < data.length; i++) {
                    data[i] = this.#commandsToThread[command].toThread(data[i]);
                }
                resolve();
            });
        }
        return new Promise(async (resolve) => {
            const coreData = new Array(this.#cores.length);
            const coreDataSize = Math.ceil(data.length / this.#cores.length);
            const transferables = this.#commandsToThread[command].withTransferable;
            let i = 0;
            for (; i < this.#cores.length; i++) {
                coreData[this.#cores.length - 1 - i] = data.splice(coreDataSize * (this.#cores.length - 1 - i), coreDataSize);
            }
            i = 0;
            for (; coreData[i]; i++) {
                coreData[i] = this.#cores[i].Command(command, coreData[i], transferables, true);
            }
            i = 0;
            for (; coreData[i]; i++) {
                coreData[i] = await coreData[i];
            }
            i = 0;
            for (; coreData[i]; i++) {
                data.push.apply(data, coreData[i]);
            }
            coreData.length = 0;
            resolve();
        });
    };
    CommandBunchSeparately = (command, data, runOnMainThread = false) => {
        if (runOnMainThread) {
            if (this.#commandsToThread[command].withTransferable) {
                return new Promise((resolve) => {
                    const result = new Array(data.length);
                    for (let i = 0; i < data.length; i++) {
                        result[i] = [this.#commandsToThread[command].toThread(new Float64Array(data[i][0])).buffer];
                    }
                    resolve(result);
                });
            }
            return new Promise((resolve) => {
                const result = new Array(data.length);
                for (let i = 0; i < data.length; i++) {
                    result[i] = this.#commandsToThread[command].toThread(data[i]);
                }
                resolve(result);
            });
        }
        return new Promise(async (resolve) => {
            const result = new Array(data.length);
            const transferables = this.#commandsToThread[command].withTransferable;
            let i = 0;
            for (; i < data.length; i++) {
                result[i] = this.#cores[i % this.#cores.length].Command(command, data[i], transferables);
            }
            i = 0;
            for (; i < data.length; i++) {
                result[i] = await result[i];
            }
            resolve(result);
        });
    };
    CommandBunchSeparatelyAndMutate = (command, data, runOnMainThread = false) => {
        if (runOnMainThread) {
            if (this.#commandsToThread[command].withTransferable) {
                return new Promise((resolve) => {
                    for (let i = 0; i < data.length; i++) {
                        data[i] = [this.#commandsToThread[command].toThread(new Float64Array(data[i][0])).buffer];
                    }
                    resolve();
                });
            }
            return new Promise((resolve) => {
                for (let i = 0; i < data.length; i++) {
                    data[i] = this.#commandsToThread[command].toThread(data[i]);
                }
                resolve();
            });
        }
        return new Promise(async (resolve) => {
            const transferables = this.#commandsToThread[command].withTransferable;
            let i = 0;
            for (; i < data.length; i++) {
                data[i] = this.#cores[i % this.#cores.length].Command(command, data[i], transferables);
            }
            i = 0;
            for (; i < data.length; i++) {
                data[i] = await data[i];
            }
            resolve();
        });
    };
    Destroy = () => {
        for (let i = 0; i < this.#cores.length; i++) {
            this.#cores[i].Destroy();
        }
        this.#cores.length = 0;
        this.#commandsToThread = {};
        this.#CommandLeastBusyI = -1;
        this.#CommandLeastBusyV = Infinity;
    };
}
class TurboOPWorker {
    instance;
    constructor(code) {
        this.instance = new Worker(URL.createObjectURL(new Blob([code], {
            type: "text/javascript"
        })));
    }
    Terminate() {
        this.instance.terminate();
    }
}
class TurboOPCore {
    #worker;
    #CommandCallStack;
    busyness = 0;
    constructor(commands, withTransferableCallbacks, withoutTransferableCallbacks) {
        this.#CommandCallStack = new LinkedList();
        this.#worker = new TurboOPWorker(`
            let returnArgs = [null, false];
            const commandsCallbacks = [${withoutTransferableCallbacks}];
            const commandsCallbacksT = [${withTransferableCallbacks}];
            const commands = {${commands}};
            const memory = {};
            onmessage = async ({ data: { command, data, asBunch } }) => {
                Promise.resolve(commands[command](data, memory, asBunch));
                postMessage(returnArgs[0], returnArgs[1]);
            };
        `);
        this.#worker.instance.onmessage = this.#CommandFinished;
    }
    #CommandTemp = { command: "", data: null, asBunch: false };
    Command = (command, data, transferables = false, asBunch = false) => new Promise((resolve) => {
        this.#CommandTemp.command = command;
        this.#CommandTemp.data = data;
        this.#CommandTemp.asBunch = asBunch;
        this.#CommandCallStack.Push(resolve);
        if (transferables) {
            this.#worker.instance.postMessage(this.#CommandTemp, data);
        }
        else {
            this.#worker.instance.postMessage(this.#CommandTemp);
        }
        this.busyness++;
    });
    #CommandFinished = (message) => {
        this.#CommandCallStack.Shift()(message.data);
        this.busyness--;
    };
    Destroy = () => {
        this.#worker.Terminate();
    };
}
class LinkedList {
    static errors = {
        shiftFailedEmpty: Error("shift_failed_empty")
    };
    head;
    tail;
    length;
    constructor() {
        this.head = null;
        this.tail = null;
        this.length = 0;
    }
    Push(value) {
        if (this.head !== null) {
            this.tail[0] = [null, value];
            this.tail = this.tail[0];
        }
        else {
            this.head = [null, value];
            this.tail = this.head;
        }
        this.length++;
        return this.length;
    }
    #ShiftValue;
    Shift() {
        if (this.head === null) {
            return LinkedList.errors.shiftFailedEmpty;
        }
        this.#ShiftValue = this.head[1];
        this.head = this.head[0];
        this.length--;
        return this.#ShiftValue;
    }
}
const debug = {
    TurboOPWorker,
    TurboOPCore,
    LinkedList,
};
export { debug };
export default TurboOP;