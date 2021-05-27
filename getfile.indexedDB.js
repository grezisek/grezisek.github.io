async function getFile(filePath = "", options={}, responseMode) {
    //solve cache
    const fileHeadResponse = await fetch(filePath, { method: "HEAD" });
    const fileLastModified = Math.floor(new Date(fileHeadResponse.headers.get("Last-Modified")).getTime() / 6000) * 6000;

    let local = localStorage.getItem("grezisek-" + filePath);
    if (local) local = JSON.parse(local)
    else local = { lastModified: "0" };
    //cached return
    if (local.lastModified == fileLastModified) 
        return responseMode == "json" ? JSON.parse(local.data) : local.data;

    //new fetch
    const fileRequest = new Request(filePath, Object.assign({ cache: "reload" }, options));
    const fileResponse = await fetch(fileRequest);
    const fileData = await fileResponse.text();

    localStorage.setItem("grezisek-" + filePath, JSON.stringify({ "lastModified": fileLastModified, "data": fileData }));

    if (fileData != JSON.parse(localStorage.getItem("grezisek-" + filePath)).data) {
        console.warn(`getFile: file content mismatch in cached ${filePath}. Deleting corrupted cache data...`);
        localStorage.removeItem("grezisek-" + filePath);
    }
    
    //live return
    return responseMode == "json" ? JSON.parse(fileData) : fileData;
}
