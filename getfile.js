async function getFile(filePath = "", options={}, responseMode) {
    const fileHeadResponse = await fetch(filePath, { method: "HEAD" });
    const fileLastModified = Math.floor(new Date(fileHeadResponse.headers.get("Last-Modified")).getTime() / 6000) * 6000;
    let local = localStorage.getItem("grezisek-" + filePath);
    if (local) local = JSON.parse(local)
    else local = { lastModified: "0" };
    if (local.lastModified == fileLastModified) return JSON.parse(local.data);
    const fileRequest = new Request(filePath, Object.assign({ cache: "reload" }, options));
    const fileResponse = await fetch(fileRequest);
    const fileData = await fileResponse[responseMode || "text"]();
    localStorage.setItem("grezisek-" + filePath, JSON.stringify({ "lastModified": fileLastModified, "data": JSON.stringify(fileData) }));
    return fileData;
}
