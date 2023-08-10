import TurboOP from "./TurboOP.js";
const length = 30;
const averageFrom = 50;

const data = [];
for (let i = 0; i < length; i++) {
    data[i] = Math.random();
}

const benchFunction = (number) => {
    for (let _ = 0; _ < 1000; _++) {
        number = number ** Math.random()
        + (3 / 11 * number) ** Math.random();
    }

    return number;
};

const op = new TurboOP({
    bench: { toThread: benchFunction }
});

await op.Command("bench", 1);

bench.addEventListener("submit", async (e) => {
    e.preventDefault();

    let result;

    let timestamp = performance.now();
    for (let i = 0; i < averageFrom; i++) {
        for (let ii = 0; ii < length; ii++) {
            result = benchFunction(data[ii]);
        }
    }
    const normaltime = performance.now() - timestamp;

    timestamp = performance.now();
    for (let i = 0; i < averageFrom; i++) {
        result = op.CommandBunch("bench", data);
    }
    result = await result;
    const optime = performance.now() - timestamp;
    
    bench_result.value = `${Math.round(normaltime / optime * 100) / 100} razy szybciej (${Math.round(optime / averageFrom * 100) / 100}ms vs. ${Math.round(normaltime / averageFrom * 100) / 100}ms)`;
});