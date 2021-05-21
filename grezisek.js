async function grezisek(conf) {
    return grezisek.init(conf);
}


(async loadTimeStamp => {
    const timeStamps = {load: loadTimeStamp};

    /**
     * file loader
     * @param {String} p filePath
     * @param {String} j responseMode
     */
    const _load = window.getFile || ((p, j) => fetch(p).then(r => j? r[j]() : r.text()));

    /**
     * template renderer
     * @param {String} slangMarkup markup to render
     * @param {String} templatesMarkup templates to render
     * @param {Node} outputContainer optional container to be cleared and used as output 
     */
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



    /**
     * Creates compatible query object from location.search
     * @return {Object} query: request, params
     */
    function createQuery() {
        const searchParamsIterator = new URLSearchParams(location.search).entries();
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

    /**
     * Renders and returns query execution result
     * @return {Node} outputContainer
     */
    async function executeQuery({query, database, templates, outputContainer, home}) {
        database = JSON.parse(await database);

        if (!query.request[0].length) query.request = home || ["page", "home"];
        if (
            !database ||
            !database[query.request[0]] ||
            !database[query.request[0]][query.request[1]]
        ) return;

        const data = database[query.request[0]][query.request[1]];
        const markup = `<template ${query.request[0]}>${Object.keys(data).map(key => `<${key}>${data[key]}</${key}>`).join("")}</template>`;
        return _render(
            markup,
            templates = await templates,
            outputContainer,
            // query.params
        );
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

    /**
     * Gets everything ready before execution
     * @param {Object} conf init configuration
     * @param {String} conf.database database file path
     * @param {String} conf.templates templates file path
     * @returns {Object} initResult: success, details
     */
    function init(conf) {
        timeStamps.init = performance.now();

        if (conf.templates) conf.templates = _load(conf.templates);
        else {
            conf.templates = document.createElement("div");
            conf.templates.prepend(...(conf.outputContainer || document.body).children);
            conf.templates = conf.templates.innerHTML;
        }

        if (conf.database) conf.database = _load(conf.database);
        else {
            conf.database = (conf.outputContainer || document.body).innerText;
        }

        conf.query = createQuery();

        return run(conf);
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