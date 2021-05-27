function getFile(filePath = "", options={}, responseMode) {
    return getFile.load(filePath, options={}, responseMode);
}
(promiseResponse => {
    const {get, set} = (filestorage => { return {
        get: key => filestorage('readonly', store => promiseResponse(store.get(key))),
        set: (key, value) => filestorage('readwrite', store => {
            store.put(value, key);
            return promiseResponse(store.transaction);
        }),
        del: key => filestorage('readwrite', store => {
            store.delete(key);
            return promiseResponse(store.transaction);
        })
    }})((permissions, callback) => promiseResponse(Object.assign(indexedDB.open('file-database'), {
        onupgradeneeded: (event) => event.target.result.createObjectStore('files')
    })).then((db) => callback(db.transaction('files', permissions).objectStore('files'))));
    Object.defineProperties(getFile, {
        load: {
            writable: false,
            value: async (filePath, options={}, responseMode) => {
                const fileHeadResponse = await fetch(filePath, { method: "HEAD" });
                if (!fileHeadResponse.ok) return;
                const fileLastModified = Math.floor(new Date(fileHeadResponse.headers.get("Last-Modified")).getTime() / 6000) * 6000;
                let local = await get("grezisek-" + filePath);
                if (local) local = JSON.parse(local)
                else local = { lastModified: "0" };
                if (local.lastModified == fileLastModified) return responseMode == "json" ? JSON.parse(local.data) : local.data;
                const fileResponse = await fetch(filePath, Object.assign({ cache: "reload" }, options));
                if (!fileResponse.ok) return;
                const fileData = await fileResponse.text();
                set("grezisek-" + filePath, JSON.stringify({ "lastModified": fileLastModified, "data": fileData }));
                if (fileData != JSON.parse(await get("grezisek-" + filePath)).data) {
                    console.warn(`getFile: file content mismatch in cached ${filePath}. Deleting corrupted cache data...`);
                    del("grezisek-" + filePath);
                }
                return fileData;
            }
        }
    });
})(request => new Promise((ok, fail) => {
    request.oncomplete = request.onsuccess = () => ok(request.result);
    request.onabort = request.onerror = () => fail(request.error);
}));
