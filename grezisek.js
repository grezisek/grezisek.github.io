async function grezisek(conf) {
    return grezisek.init(conf);
}


(async loadTimeStamp => {
    const timeStamps = { load: loadTimeStamp };

    const _load = window.getFile || ((p, c, t) => fetch(p, c).then(r => r[t || "text"]()));

    const _render = window.slang ||
        ((slangMarkup, templatesMarkup, outputContainer = document.createElement("div")) => {
            outputContainer.innerHTML = slangMarkup;
            const templateContainer = document.createElement("div");
            templateContainer.innerHTML = templatesMarkup;

            const templatesToRender = outputContainer.querySelectorAll("template");
            templatesToRender.forEach(template => {
                if (template.attributes.length) {
                    const srcTemplate = templateContainer.querySelector(`[name=${template.attributes[0].name}]`);
                    if (srcTemplate) template.replaceWith(srcTemplate.content);
                }
            })
            templatesToRender.forEach(template => {
                if (template.attributes.length) {
                    const srcTemplate = templateContainer.querySelector(`template-${template.attributes[0].name}`);
                    if (srcTemplate) template.replaceWith(srcTemplate);
                }
            });
            return outputContainer;
        });

    Object.defineProperties(grezisek, createPublicProperties());

    function createQuery(queryString) {
        const searchParamsIterator = new URLSearchParams(queryString).entries();
        const search = searchParamsIterator.next();

        if (search.done) return {
            request: ["", ""],
            params: {}
        }

        const mainSearchRequest = search.value;
        const searchParams = {};

        let currentSearchParam;
        while (!(currentSearchParam = searchParamsIterator.next()).done)
            searchParams[currentSearchParam.value[0]] = currentSearchParam.value[1];

        return {
            request: mainSearchRequest,
            params: searchParams
        }
    }

    async function executeQuery({
        configuration,
        query,
        templates,
        data,
    }) {
        const outputContainer = document.querySelector(configuration.output.querySelector);
        if (!data || !data[query.request[0]]) return (query404 => _render(
            `<template ${query404.request[0]}>${Object.keys(data[query404.request[0]][query404.request[1]])
                .map(nodeName => `<${nodeName}>${data[query404.request[0]][query404.request[1]][nodeName]}</${nodeName}>`)
                .join("")}</template>`,
            templates,
            outputContainer,
            // query.params
        ))(createQuery(configuration.query["404"]));

        const templateName = query.request[0];

        const dataPart = data[templateName];

        const dataKey = query.request[1];


        if (!dataPart || !dataPart[dataKey]) return _render(
            `<template ${templateName}></template>`,
            templates,
            outputContainer,
            // query.params
        );

        return _render(
            `<template ${templateName}>${Object.keys(dataPart[dataKey])
                .map(nodeName => `<${nodeName}>${dataPart[dataKey][nodeName]}</${nodeName}>`)
                .join("")}</template>`,
            templates,
            outputContainer,
            // query.params
        );
    }

    function addCustomElementsSupport(database, data) {
        data.support.elements["grezisek-archive"] = function({node}) {
            node.classList.add("async");
            const config = {
                itemTemplate: node.querySelector("item-template"),
                perPage: node.querySelector("per-page"),
                fields: node.querySelector("use-fields"),
            }

            if (config.itemTemplate) config.itemTemplate = config.itemTemplate.attributes[0].name;
            if (config.perPage) config.perPage = parseInt(config.perPage.attributes[0].name);
            config.itemType = node.attributes.length ? node.attributes[0].name : config.itemTemplate;

            if (!database.data[config.itemType]) return;

            const itemsCollection = database.data[config.itemType];
            const itemsSlugCollection = Object.keys(itemsCollection);
            while (node.lastChild) node.lastChild.remove();
            for (let i = 0; i < config.perPage; i++) {
                if (!itemsSlugCollection[i]) break;
                const slug = itemsSlugCollection[i];
                let innerHTML = `<template ${config.itemTemplate}>`;
                if (config.fields && config.fields.attributes.length)
                    innerHTML += [...config.fields.attributes].map(field => {
                        const fieldKey = field.value ? field.value : field.name;
                        let dataValue;
                        if (fieldKey == "item-link" && !field.value) {
                            dataValue = `?${config.itemType}=${slug}`;
                        } else dataValue = database.data[config.itemType][slug][fieldKey];
                        return `<${field.name}>${dataValue}</${field.name}>`;
                    }).join("");
                innerHTML += `</template>`;
                node.innerHTML += innerHTML;
            }
        }
    }

    async function run(conf) {
        return (queried => {
            return {
            success: !!queried,
                details: {
                    queried,
                    time: {
                        fromScriptLoad: performance.now() - timeStamps.load,
                        fromInit: performance.now() - timeStamps.init,
                    }
                }
            }
        })(await executeQuery(conf))
    }

    function dbInfoToConfigObject(dbInfo) {
        const configObject = {};
        if (
            typeof dbInfo == "string" ||
            dbInfo instanceof String ||
            dbInfo instanceof Request
        ) {
            configObject.url = dbInfo;
            configObject.options = undefined;
        } else if (dbInfo instanceof Object) {
            if (
                typeof dbInfo.url == "string" ||
                dbInfo.url instanceof String ||
                dbInfo.url instanceof Request
            ) configObject.url = dbInfo.url;
            if (dbInfo.options instanceof Object)
                configObject.options = dbInfo.options;
        }
        return configObject;
    }

    
    async function init(dbInfo = {
        url: "./database.json",
        options: {}
    }) {
        timeStamps.init = performance.now();

        const customQuery = dbInfo.query;

        dbInfo = dbInfoToConfigObject(dbInfo);

        const database = await _load(dbInfo.url, dbInfo.options, "json");

        const configuration = Object.assign({
            query: {
                // mode: "dynamic",
                defaultQuery: "?page=home",
                404: "?error=notfound",
                // search: "?s"
            },
            output: {
                querySelector: "body"
            },
            templates: "./templates.html"
        }, database.configuration);

        if (_render.subscribe) {
            _render.subscribe("renderStart", data => addCustomElementsSupport(database, data));
        }
        
        return run({
            configuration,
            query: createQuery(customQuery ? customQuery : location.search.length ? location.search : configuration.query.defaultQuery),
            templates: await _load(configuration.templates),
            data: database.data
        });
    }

    function createPublicProperties() {
        return {
            init: createPublicProperty(init)
        };
    }

    function createPublicProperty(value) {
        return {
            writable: false,
            value
        };
    }
})(performance.now());