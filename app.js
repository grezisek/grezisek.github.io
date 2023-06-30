const Accordion = () => {
    document.querySelectorAll(".accordion__summary").forEach(node => node.classList.add("has-mouse-effects"));
};

const ScrollbarWidthVariableInCSS = () => {
    const probe = document.createElement("div");
    probe.style.setProperty("overflow", "scroll");
    probe.style.setProperty("position", "absolute");
    probe.style.setProperty("left", "-300vw");
    document.body.appendChild(probe);
    document.documentElement.style.setProperty("--scrollbar_width", probe.offsetWidth.toString());
    document.body.removeChild(probe);
};
const ResizeRWDVariableInCSS = () => {
    const computedStyle = window.getComputedStyle(document.documentElement);
    const min = parseFloat(computedStyle.getPropertyValue("--screen_scaling_minimum"));
    const max = parseFloat(computedStyle.getPropertyValue("--screen_scaling_maximum"));
    const current = parseFloat(window.getComputedStyle(document.documentElement, "::before").getPropertyValue("width"));
    const value = Math.min(1, Math.max(0, current - min) / (max - min));
    document.documentElement.style.setProperty("--rwd_state", value.toString());
};
const UpdateBodyHasScrollbar = () => {
    document.body.classList.toggle("is-scrollbar-visible", window.innerWidth > document.documentElement.clientWidth);
};
const CSSVars = () => {
    ScrollbarWidthVariableInCSS();
    ResizeRWDVariableInCSS();
    UpdateBodyHasScrollbar();
    window.addEventListener("resize", ScrollbarWidthVariableInCSS, { passive: true });
    window.addEventListener("resize", ResizeRWDVariableInCSS, { passive: true });
    window.addEventListener("resize", UpdateBodyHasScrollbar, { passive: true });
};

const ContentEntry = () => {
    document.querySelectorAll(".content-entry").forEach(node => node.classList.add("has-mouse-effects"));
};

const mouseEffectsNodes = [];
const UpdateMouseEffectsSubscriber = (subscriber, mouseMoveEvent) => {
    const rect = subscriber.getBoundingClientRect();
    const top = mouseMoveEvent.clientY - rect.top;
    const left = mouseMoveEvent.clientX - rect.left;
    subscriber.style.setProperty('--cursor-top--px', `${top}px`);
    subscriber.style.setProperty('--cursor-left--px', `${left}px`);
    subscriber.style.setProperty('--cursor-top--percent', `${top / (subscriber.offsetHeight ?? subscriber.clientHeight) * 100}%`);
    subscriber.style.setProperty('--cursor-left--percent', `${left / (subscriber.offsetWidth ?? subscriber.clientWidth) * 100}%`);
    subscriber.classList.add("mouse-effects-set");
};
const UpdateMouseEffects = (mouseMoveEvent) => {
    for (const node of mouseEffectsNodes) {
        UpdateMouseEffectsSubscriber(node, mouseMoveEvent);
    }
};
const MouseEffects = () => {
    if ("ontouchstart" in document.documentElement) {
        return;
    }
    document.querySelectorAll(".has-mouse-effects, button").forEach((subscriber) => {
        if (mouseEffectsNodes.includes(subscriber)) {
            return;
        }
        mouseEffectsNodes.push(subscriber);
    });
    addEventListener("mousemove", UpdateMouseEffects, { passive: true });
};

const settingsData = {
    border_width: "",
    theme: "",
    contrast: "",
    data: "",
};
const SettingsUpdateForm = () => {
    for (const settingKey of Object.keys(settingsData)) {
        if (window["settings_form"].elements[settingKey][0]) {
            for (let nodeIndex = 0; nodeIndex < window["settings_form"].elements[settingKey].length; nodeIndex++) {
                window["settings_form"].elements[settingKey][nodeIndex].checked =
                    window["settings_form"].elements[settingKey][nodeIndex].value == settingsData[settingKey];
            }
        }
        else {
            window["settings_form"].elements[settingKey].value = settingsData[settingKey];
        }
    }
};
const Settings = () => {
    SettingsModal();
    SettingsUpdateForm();
    // SettingsApply();
    window["settings_output"].textContent = sessionStorage.getItem("settings") ?? localStorage.getItem("settings") ?? "";
    SettingsListeners();
    window["settings_delete"].addEventListener("click", (clickEvent) => {
        localStorage.removeItem("settings");
        sessionStorage.removeItem("settings");
        for (const settingKey of Object.keys(settingsData)) {
            settingsData[settingKey] = "";
        }
        window["settings_output"].textContent = "";
        SettingsUpdateForm();
    });
    window["settings_form"].addEventListener("submit", submitEvent => submitEvent.preventDefault());
};
const SettingsModal = () => {
    window["settings_open"].addEventListener("click", clickEvent => {
        window["settings_panel"].showModal();
        document.body.classList.add("is-settings-open");
        window["settings_panel_content"].scrollTo(0, 0);
    });
    window["settings_close"].addEventListener("click", clickEvent => {
        window["settings_panel"].close();
        document.body.classList.remove("is-settings-open");
    });
};
const SettingsLoad = () => {
    const loadedSettingsData = JSON.parse(sessionStorage.getItem("settings") ?? localStorage.getItem("settings") ?? "{}");
    for (const settingKey of Object.keys(settingsData)) {
        settingsData[settingKey] = loadedSettingsData[settingKey] ?? "";
    }
};
const SettingsSave = () => {
    const saveData = {};
    for (const [settingKey, settingValue] of Object.entries(settingsData)) {
        if (!settingValue) {
            continue;
        }
        saveData[settingKey] = settingValue;
    }
    if (!Object.keys(saveData).length) {
        return;
    }
    if (settingsData.data == "local_storage") {
        localStorage.setItem("settings", JSON.stringify(saveData));
    }
    else {
        sessionStorage.setItem("settings", JSON.stringify(saveData));
    }
};
const SettingsApply = () => {
    document.documentElement.classList.toggle("colorscheme", !!settingsData.theme);
    document.documentElement.classList.toggle("colorscheme--dark", settingsData.theme == "dark");
    document.documentElement.classList.toggle("colorscheme--light", settingsData.theme == "light");
    document.documentElement.classList.toggle("colorscheme--contrast-high", settingsData.contrast == "more");
    document.documentElement.classList.toggle("colorscheme--contrast-low", settingsData.contrast == "less");
    if (settingsData.border_width) {
        document.body.style.setProperty("--border_width", `var(--border_width_${settingsData.border_width})`);
    }
    else {
        document.body.style.removeProperty("--border_width");
    }
};
const OnSettingsChange = (changeEvent) => {
    localStorage.removeItem("settings");
    sessionStorage.removeItem("settings");
    settingsData[changeEvent.target.name] = changeEvent.target.value ?? "";
    if (settingsData.data) {
        SettingsSave();
    }
    SettingsApply();
    window["settings_output"].textContent = sessionStorage.getItem("settings") ?? localStorage.getItem("settings") ?? "";
};
const SettingsListeners = () => {
    for (const settingKey of Object.keys(settingsData)) {
        if (window["settings_form"].elements[settingKey][0]) {
            for (let nodeIndex = 0; nodeIndex < window["settings_form"].elements[settingKey].length; nodeIndex++) {
                window["settings_form"].elements[settingKey][nodeIndex].addEventListener("change", OnSettingsChange);
            }
        }
        else {
            window["settings_form"].elements[settingKey].addEventListener("change", OnSettingsChange);
        }
    }
};

const SyntaxBackground = () => {
    document.querySelectorAll("pre code").forEach(node => node.classList.add("has-mouse-effects"));
};

const ViewTransitions = () => {
    if (!("startViewTransition" in document)) {
        return;
    }
    let hashIndex = location.href.lastIndexOf("#");
    let lastLink = hashIndex == -1 ? location.href : location.href.slice(0, hashIndex);
    const linksQuery = "a:not(.skip-link):not([href^='mailto'])";
    let tempHrefPrevious = null;
    let tempHref = null;
    let tempAbortController = null;
    const UpdateView = async (href, pushState = false) => {
        document.body.classList.add("is-loading");
        try {
            const viewTransition = document.startViewTransition(async () => {
                tempHref = href;
                tempAbortController = new AbortController();
                let request = fetch(tempHref, { signal: tempAbortController.signal });
                if (pushState) {
                    history.pushState(null, "", href);
                }
                const header = document.querySelector(".site__header");
                const content = document.querySelector(".site__content");
                const tempNode = document.createElement("div");
                request = await request;
                if (!request.ok) {
                    document.title = "404";
                    content.innerHTML = "<h1>404</h1>";
                    throw new Error("404");
                }
                tempNode.innerHTML = await request.text();
                tempHref = null;
                tempAbortController = null;
                header.replaceWith(tempNode.querySelector(".site__header"));
                content.replaceWith(tempNode.querySelector(".site__content"));
                document.title = tempNode.querySelector("title").textContent;
                UpdateBodyHasScrollbar();
            });
            await viewTransition.updateCallbackDone;
            window.scrollTo(0, 0);
            Accordion();
            ContentEntry();
            SyntaxBackground();
            MouseEffects();
            window["hljs"]?.highlightAll();
            document.querySelectorAll(linksQuery)
                .forEach(link => link.addEventListener("click", HandleNavigationLinkClicked));
            tempHrefPrevious = location.href;
            document.documentElement.dispatchEvent(new CustomEvent("viewchange"));
        }
        catch (error) {
            console.debug(error);
        }
        document.body.classList.remove("is-loading");
    };
    const HandleNavigationLinkClicked = (clickEvent) => {
        if ((clickEvent.target.host ?? location.host) != location.host) {
            return;
        }
        const hashIndex = location.href.lastIndexOf("#");
        const newLink = hashIndex == -1 ? clickEvent.target.href : clickEvent.target.href.slice(0, hashIndex);
        if (lastLink == newLink) {
            return;
        }
        lastLink = newLink;
        clickEvent.preventDefault();
        tempHrefPrevious = location.href;
        UpdateView(clickEvent.target.href, true);
    };
    const HandleNavigationPopstate = (popstateEvent) => {
        const hashIndex = location.href.lastIndexOf("#");
        const newLink = hashIndex == -1 ? location.href : location.href.slice(0, hashIndex);
        if (lastLink == newLink) {
            return;
        }
        lastLink = newLink;
        popstateEvent.preventDefault();
        if (tempHref !== null) {
            tempAbortController.abort();
            tempHref = null;
            if (tempHrefPrevious == location.href) {
                return;
            }
        }
        UpdateView(location.href);
    };
    document.querySelectorAll(linksQuery)
        .forEach(link => link.addEventListener("click", HandleNavigationLinkClicked));
    window.addEventListener("popstate", HandleNavigationPopstate);
};

document.addEventListener("readystatechange", _ => {
    if (document.readyState != "complete") {
        return;
    }
    Accordion();
    ContentEntry();
    SyntaxBackground();
    MouseEffects();
    ViewTransitions();
    Settings();
});
SettingsLoad();
