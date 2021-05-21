function getFile(filePath = "") {
    return getFile.load(filePath);
}

(promiseResponse => {
    //create get and set methods from indexedDB
    const {get, set} = (filestorage => { return {
        get: key => filestorage('readonly', store => promiseResponse(store.get(key))),
        set: (key, value) => filestorage('readwrite', store => {
            store.put(value, key);
            return promiseResponse(store.transaction);
        })
    }})((permissions, callback) => promiseResponse(Object.assign(indexedDB.open('file-database'), {
        onupgradeneeded: (event) => event.target.result.createObjectStore('files')
    })).then((db) => callback(db.transaction('files', permissions).objectStore('files'))));

    //create internal methods
    Object.defineProperties(getFile, {
        load: {
            writable: false,
            value: async path => {
                const fileHeadResponse = await fetch(new Request(path, { method: "HEAD" }));
                const fileLastModified = fileHeadResponse.headers.get("Last-Modified");

                let cached = await get("grezisek-" + path);

                if (cached) cached = JSON.parse(cached);
                else cached = { lastModified: "Thu, 01 Jan 1970 00:00:00 GMT" };
            
                if (fileHeadResponse.headers.get("Last-Modified") == cached.lastModified)
                    return JSON.parse(cached.data);

                const fileRequest = new Request(path, { cache: "reload" });
                const fileResponse = await fetch(fileRequest);
                const fileData = await fileResponse.text();

                set(
                    "grezisek-" + path,
                    JSON.stringify({ "lastModified": fileLastModified, "data": JSON.stringify(fileData) })
                );

                return fileData;
            }
        }
    });

})(request => new Promise((ok, fail) => {
    request.oncomplete = request.onsuccess = () => ok(request.result);
    request.onabort = request.onerror = () => fail(request.error);
}));
