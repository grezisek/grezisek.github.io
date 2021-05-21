/** 
* slang.js
*
* @fileOverview Markup renderer. Creates window.slang function.
*
* @author   Grezisek
* @param    {String} slangMarkup        html / slang markup to render
* @param    {String} templatesMarkup    slang markup with template definitions
* @param    {String} outputContainer    Node to be emptied and used as container for rendered nodes
* @return   {String}                    Temporary node / outputContainer clone with rendered nodes
*/
(()=> {
    window.slang = (
        slangMarkup = "",
        templatesString = "",
        outputContainer
    ) => {
        const isOutputContainer = !!outputContainer;
        if (!outputContainer) outputContainer = document.createElement("div");
        return markupRenderer(slangMarkup, templatesString, outputContainer, isOutputContainer);
    };
    
    Object.defineProperties(slang, createPublicProperties());

    /** 
    * Fixes script tags inside node so they can execute 
    * @return {Node}
    */
    function scriptFixer(node) {
        node.querySelectorAll("script").forEach(script => {
            script.parentNode.insertBefore(
                document.createElement("script").appendChild(document.createTextNode(script.innerHTML)).parentNode,
                script
            );
            script.remove();
        });
    
        return node;
    }
    
    const eventSubscriptionList = {
        renderStart: [],
        renderEnd: [],
        eachStructRenderStart: [],
        eachStructRenderEnd: [],
        eachTemplateRenderStart: [],
        eachTemplateRenderEnd: [],
        eachDataRenderStart: [],
        eachDataRenderEnd: []
    }
    
    /** 
    * Adds common event listeners and handlers to media node
    */
    function addMediaEventHandlers(node) {
        for ([eventName, callback] of [
            ["play", event => {
                event.target.classList.remove("error");
                event.target.classList.remove("waiting");
                event.target.classList.remove("ended");
                event.target.classList.remove("pause");
                event.target.classList.add("play");
            }],
            ["playing", event => {
                event.target.classList.remove("error");
                event.target.classList.remove("waiting");
                event.target.classList.remove("ended");
                event.target.classList.remove("pause");
                event.target.classList.add("play");
            }],
            ["pause", event => {
                event.target.classList.remove("play");
                event.target.classList.add("pause");
            }],
            ["ended", event => {
                event.target.classList.remove("play");
                event.target.classList.remove("pause");
                event.target.classList.add("ended");
            }],
            ["waiting", event => {
                event.target.classList.remove("play");
                event.target.classList.add("waiting");
            }],
            ["loadeddata", event => {
                event.target.classList.remove("waiting");
            }],
            ["error", event => {
                event.target.classList.remove("play");
                event.target.classList.add("error");
            }],
        ]) {
            node.addEventListener(eventName, callback);
        }
    }
    
    /** 
    * Copies names and values of attributes from sourceNode into targetNode
    */
    function cloneAttributes(targetNode, sourceNode) {
        for (let i = 0; i < sourceNode.attributes.length; i++)
            targetNode.setAttribute(
                sourceNode.attributes[i].name,
                sourceNode.attributes[i].value
            );
    }
    
    /** 
    * Executes publication of render event
    */
    function elementRenderPublisher(eventName, oldNode, newNode) {
        if (
            eventName == "eachDataRenderEnd" || 
            eventName == "eachTemplateRenderEnd"
        ) {
            dataRenderCounterStack--;
            if (!dataRenderedIndex[oldNode.innerText])
                dataRenderedIndex[oldNode.innerText] = newNode.cloneNode ? newNode.cloneNode(true) : newNode;
        }
        eventSubscriptionList[eventName].forEach(callback => callback(eventName, oldNode, newNode));
    }
    
    /** 
    * Index of supported data elements
    */ 
    const dataTypes = {
        iframe(node, mimetype, isOutputContainer) {
            const newNode = document.createElement("iframe");
            elementRenderPublisher("eachDataRenderStart", node, newNode);
            cloneAttributes(newNode, node);
            newNode.setAttribute("loading", "lazy");
            newNode.classList.add("loading");
            newNode.addEventListener("load", event => {
                newNode.classList.remove("loading");
                newNode.classList.add("loaded");
                elementRenderPublisher("eachDataRenderEnd", node, newNode);
            });
            node.replaceWith(newNode);
            newNode.src = node.innerText;
        },
        video(node, mimetype, isOutputContainer) {
            const sourceNode = document.createElement("source");
            sourceNode.setAttribute("src", node.innerText);
            sourceNode.setAttribute("type", mimetype);
    
            const newNode = document.createElement("video");
            elementRenderPublisher("eachDataRenderStart", node, newNode);
            cloneAttributes(newNode, node);
            addMediaEventHandlers(newNode);
            newNode.setAttribute("loading", "lazy");
            newNode.appendChild(sourceNode);
    
            elementRenderPublisher("eachDataRenderEnd", node, newNode);
            node.replaceWith(newNode);
        },
        image(node, mimetype, isOutputContainer) {
            const newNode = document.createElement("img");
            elementRenderPublisher("eachDataRenderStart", node, newNode);
            cloneAttributes(newNode, node);
            newNode.setAttribute("loading", "lazy");
            newNode.classList.add("loading");
            newNode.addEventListener("load", event => {
                newNode.classList.remove("loading");
                newNode.classList.add("loaded");
                elementRenderPublisher("eachDataRenderEnd", node, newNode);

            });
            newNode.setAttribute("type", mimetype);
            newNode.setAttribute("src", node.innerText);
            node.replaceWith(newNode);
        },
        audio(node, mimetype, isOutputContainer) {
            const sourceNode = document.createElement("source");
            sourceNode.setAttribute("src", node.innerText);
            sourceNode.setAttribute("type", mimetype);
    
            const newNode = document.createElement("audio");
            elementRenderPublisher("eachDataRenderStart", node, newNode);
            cloneAttributes(newNode, node);
            addMediaEventHandlers(newNode);
            newNode.setAttribute("loading", "lazy");
            newNode.appendChild(sourceNode);
    
            elementRenderPublisher("eachDataRenderEnd", node, newNode);
            node.replaceWith(newNode);
        },
        async html(node, mimetype, isOutputContainer) {
            elementRenderPublisher("eachDataRenderStart", node);
    
            const request = new Request(node.innerText);
            const response = await fetch(request);
            if (!response.ok) return node.outerHTML = node.outerHTML.replace(node.localName, `${node.localName}-error`);
            const data = await response.text();
            const dataCont = node.parentNode.cloneNode();
            dataCont.innerHTML = data;
            Array.prototype.forEach.call(dataCont.children, child => cloneAttributes(child, node));
            node.replaceWith(...dataCont.childNodes);
            elementRenderPublisher("eachDataRenderEnd", node, dataCont.childNodes);
        },
        script(node, mimetype, isOutputContainer) {
            const newNode = document.head.appendChild(document.createElement("script"));
            elementRenderPublisher("eachDataRenderStart", node, newNode);
            cloneAttributes(newNode, node);
            newNode.setAttribute("type", mimetype);
            newNode.setAttribute("src", node.innerText);
    
            elementRenderPublisher("eachDataRenderEnd", node, newNode);
            node.remove();
        },
        style(node, mimetype, isOutputContainer) {
            const newNode = document.createElement("link");
            if (isOutputContainer) document.head.appendChild(newNode);
            elementRenderPublisher("eachDataRenderStart", node, newNode);
            cloneAttributes(newNode, node);
            newNode.setAttribute("rel", "stylesheet");
            newNode.setAttribute("href", node.innerText);
    
            elementRenderPublisher("eachDataRenderEnd", node, newNode);
            node.remove();
        }
    }
    
    let dataRenderCounterStack = 0;
    const dataRenderedIndex = {};
    /** 
    * Index of supported slang elements with their render methods and parameters of rendering
    */  
    const support = {
        defs: {
            struct: {
                "row": "display:flex;flex-direction:row;",
                "col": "display:flex;flex-direction:column;",
                "wor": "display:flex;flex-direction:row-reverse;",
                "loc": "display:flex;flex-direction:column-reverse;"
            },
            data: {
                "ogv":  [dataTypes.video,   "video/ogg"],
                "webm": [dataTypes.video,   "video/webm"],
                "mp4":  [dataTypes.video,   "video/mp4"],
    
                "png":  [dataTypes.image,   "image/png"],
                "jpg":  [dataTypes.image,   "image/jpeg"],
                "jpeg": [dataTypes.image,   "image/jpeg"],
                "ico":  [dataTypes.image,   "image/x-icon"],
                "bmp":  [dataTypes.image,   "image/bmp"],
                "gif":  [dataTypes.image,   "image/gif"],
                "svg":  [dataTypes.image,   "image/svg+xml"],
    
                "oga":  [dataTypes.audio,   "audio/ogg"],
                "ogg":  [dataTypes.audio,   "audio/ogg"],
                "mp3":  [dataTypes.audio,   "audio/mpeg"],
    
                "html": [dataTypes.html,    "text/html"],
                "txt":  [dataTypes.html,    "text/html"],
    
                "js":   [dataTypes.script,  "text/javascript"],
    
                "css":  [dataTypes.style,   "text/css"]
            }
        },
        elements: {
            template({node, templates}, isOutputContainer) {
                if (!node.attributes.length || !templates[node.attributes[0].name]) {
                    console.error("Template not found: ", node);
                    node.outerHTML = node.outerHTML.replace(node.localName, `${node.localName}-error`);
                    return;
                }
        
                const template = templates[node.attributes[0].name].cloneNode(true);
    
                elementRenderPublisher("eachTemplateRenderStart", node, template);
        
                template.querySelectorAll("slot")
                    .forEach(slot => slot.outerHTML = 
                        (src => src ? src.innerHTML : slot.outerHTML)
                            ( slot.attributes.length ? node.content.querySelector(slot.attributes[0].name) : null)
                    );
                    
                node.outerHTML = template.innerHTML;
        
                elementRenderPublisher("eachTemplateRenderEnd", node, template);
            },
            struct({node}, isOutputContainer) {
                let newNode;
                if (node.attributes[1]) newNode = document.createElement(node.attributes[1].name);
                else newNode = document.createElement("div");
    
                elementRenderPublisher("eachStructRenderStart", node, newNode);
        
                newNode.prepend(...node.childNodes);
    
                const className = createClassName(node);
                newNode.classList.add("struct", className);
                addMissingStyles(className);
    
                elementRenderPublisher("eachStructRenderEnd", node, newNode);
                node.replaceWith(newNode);
            },
            data({node}, isOutputContainer) {
                dataRenderCounterStack++;
                node.innerHTML = node.innerText.replace(/[ \n]/g, "");
                let fileType = node.innerText.slice((Math.max(0, node.innerText.lastIndexOf(".")) || Infinity) + 1);
                if (support.defs.data[fileType]) {
                    node.classList.add("async", "file", `file--${fileType}`);
                    support.defs.data[fileType][0](node, support.defs.data[fileType][1], isOutputContainer)
                } else dataTypes.iframe(node, "");
            }
        }
    };
    
    support.selectorAll = `:is(${Object.keys(support.elements).join(", ")}):not(.async)`;
    
    /** 
    * Creates CSS media query rule from breakpoint markup
    * @return {String} CSS media query rule
    */
    function getCssMediaQuery(breakpoint) {
        return breakpoint.split("_").reduce((mediaQuery, rule) => {
            if (rule.includes("w")) return mediaQuery += `(min-width: ${rule.slice(0, -1)}px)`;
            if (rule.includes("h")) return mediaQuery += `(min-height: ${rule.slice(0, -1)}px)`;
            return mediaQuery += ` ${rule.replace("or",",")} `;
        },"");
    }
    
    /** 
    * Creates className from node first attribute's name
    * @return {String} className, default "col"
    */
    function createClassName(node) {
        if (!node.attributes.length) return "col";
        return node.attributes[0].name
            .replace("?","_or_")
            .replace("!","_and_");
    }
    
    /** 
    * Creates CSS markup based on className
    * @return {String} CSS markup
    */
    function createCssFromClassName(className) {
        return className.split("-").reduce((acc, part, i) => {
            part = part + "";
            if (!acc) acc = "";
    
            if (i == 0) 
                acc += `.${className}{${support.defs.struct[part]}}`;
    
            if (i % 2)
                acc += ` @media ${getCssMediaQuery(part)}{.${className}{!mediaQueryStylesHere!}}`;
            else 
                acc = acc.replace("!mediaQueryStylesHere!", support.defs.struct[part]);
    
            return acc;
        },"");
    }
    
    const templateMarkupRenderedIndex = {};
    /** 
    * Creates named collection of template nodes
    * @return {Object}
    */
    function createTemplateCollection(templatesMarkup) {
        if (!templatesMarkup.length) return {};

        const templates = {};
        const tempRoot = document.createElement("div");

        if (templateMarkupRenderedIndex[templatesMarkup]) tempRoot.innerHTML = templateMarkupRenderedIndex[templatesMarkup];
        else {
            templateMarkupRenderedIndex[templatesMarkup] = templatesMarkup
                .split(/(<\/template-(?:\w+)>)/g)
                .map(e => e.replace(/[\r\n]/g,""))
                .filter((v, i, a) => a.indexOf(v) === i)
                .join("");

            tempRoot.innerHTML = templateMarkupRenderedIndex[templatesMarkup];
        }
        
        Array.prototype.forEach.call(
            tempRoot.children,
            template => templates[template.localName.substring(template.localName.indexOf('-')+1)] = template.cloneNode(true)
        );
    
        return templates;
    }
    
    /** 
    * Adds CSS markup into style node only on first occurence of className
    */
    function addMissingStyles(className) {
        if (slang.styles.classList.contains(className)) return;
        slang.styles.node.innerHTML += createCssFromClassName(className);
        slang.styles.classList.add(className);
    }
    
    /** 
    * Loops while some elements can be rendered inside root, renders and replaces them
    * @return {Node} root clone
    */
    function createNodesFromMarkup(root, markup, templates, isOutputContainer) {
        const tempRoot = root.cloneNode();
        tempRoot.innerHTML = markup;
        let queue = tempRoot.querySelectorAll(support.selectorAll);
        while (queue.length) {
            queue.forEach(node => support.elements[node.localName]({node, templates}, isOutputContainer));
            queue = tempRoot.querySelectorAll(support.selectorAll);
        }
    
        return scriptFixer(tempRoot);
    }
    
    /** 
    * Creates single property description
    * @return {Object}
    */
    function createPublicProperty(value) {
        return {
            writable: false,
            value
        };
    }
    
    /** 
    * Creates object with properties and methods meant to be in user's use or remembered between executions
    * @return {Object}
    */
    function createPublicProperties() {
        return {
            styles: createPublicProperty({
                node: document.head.appendChild(document.createElement("style")),
                classList: document.createElement("null-node").classList
            }),
            subscribe: createPublicProperty((eventName, callback) => {
                if (!eventSubscriptionList[eventName]) return;
                if (eventSubscriptionList[eventName].includes(callback)) return;
                eventSubscriptionList[eventName].push(callback);
            }),
            unsubscribe: createPublicProperty((eventName, callback) => {
                if (!eventSubscriptionList[eventName]) return;
                if (!eventSubscriptionList[eventName].includes(callback)) return;
                eventSubscriptionList[eventName].splice(eventSubscriptionList[eventName].indexOf(callback), 1);
            })
        };
    }
    
    const markupRenderedIndex = {};
    /** 
    * Renders contentMarkup and templatesMarkup into outputContainer
    * Private version of window.slang with defaults granted
    * @return {Node}
    */
    function markupRenderer(contentMarkup, templatesMarkup, outputContainer, isOutputContainer) {
        if (!contentMarkup.length) return outputContainer;

        if (markupRenderedIndex[contentMarkup]) {
            eventSubscriptionList.renderEnd.forEach(callback => callback({
                eventName: "renderEnd",
                outputContainer
            }));
            return markupRenderedIndex[contentMarkup];
        };
        const templates = createTemplateCollection(templatesMarkup);
        
        eventSubscriptionList.renderStart.forEach(callback => callback({
            eventName: "renderStart",
            outputContainer,
            templates
        }));

        function dataLoadedCounterCallback() {
            
            if (!dataRenderCounterStack) {
                markupRenderedIndex[contentMarkup] = outputContainer;
                eventSubscriptionList.renderEnd.forEach(callback => callback({
                    eventName: "renderEnd",
                    outputContainer
                }));
            }
        }

        function rendered() {
            if (dataRenderCounterStack) eventSubscriptionList.eachDataRenderEnd.unshift(dataLoadedCounterCallback);
            else dataLoadedCounterCallback();
        }

        while (outputContainer.lastChild) outputContainer.lastChild.remove();
        outputContainer.prepend(...createNodesFromMarkup(outputContainer, contentMarkup, templates, isOutputContainer).childNodes);

        rendered();

        return outputContainer;
    }
})();
