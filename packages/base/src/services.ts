﻿import { blockUI, blockUndo } from "./blockui";
import { Config } from "./config";
import { ErrorHandling } from "./errorhandling";
import { RequestErrorInfo, ServiceOptions, ServiceResponse } from "./servicetypes";
import { getjQuery } from "./system";

export function resolveUrl(url: string) {
    if (url != null && url.charAt(0) == '~' && url.charAt(1) == '/')
        return Config.applicationPath + url.substring(2);
    return url;
}

export function resolveServiceUrl(url: string) {
    if (url && url.length && url.charAt(0) != '~' && url.charAt(0) != '/' && url.indexOf('://') < 0)
        return resolveUrl("~/Services/") + url;

    return resolveUrl(url);
}

(function () {
    let $ = getjQuery();
    $?.ajaxSetup?.({
        beforeSend: function (xhr: XMLHttpRequest, opt: any) {
            if (!opt || !opt.crossDomain) {
                var token = getCookie('CSRF-TOKEN');
                if (token)
                    xhr.setRequestHeader('X-CSRF-TOKEN', token);
            }
        }
    });
});

export function getCookie(name: string) {
    let $ = getjQuery();
    if (typeof $?.cookie === "function")
        return $.cookie(name);

    name += '=';
    for (var ca = document.cookie.split(/;\s*/), i = ca.length - 1; i >= 0; i--)
        if (!ca[i].indexOf(name))
            return ca[i].replace(name, '');
}

export function isSameOrigin(url1: string, url2?: string) {
    url2 ??= window.location.href;
    var uri1 = new URL(url1);
    var uri2 = new URL(url2);
    return uri1.host === uri2.host &&
        uri1.port === uri2.port &&
        uri1.protocol === uri2.protocol;
}

function serviceOptions<TResponse>(url: string, options: ServiceOptions<TResponse>) {
    options = Object.assign(<ServiceOptions<TResponse>>{
        allowRedirect: true,
        async: true,
        blockUI: true,
        method: 'POST',
    }, options);

    options.headers ??= {};
    options.headers["Accept"] ??= "application/json";
    options.headers["Content-Type"] ??= "application/json";
    if (isSameOrigin(url)) {
        var token = getCookie('CSRF-TOKEN');
        if (token)
            options.headers["X-CSRF-TOKEN"] = token;
    }
    return options;
}

let activeRequests: number = 0;

export function requestStarting() {
    let $ = getjQuery();
    $ && typeof $.active === "number" && ($.active++ === 0) && $.event?.trigger?.("ajaxStart");
    activeRequests++;
}

export function requestFinished() {
    let $ = getjQuery();
    $ && typeof $.active === "number" && !(--$.active) && $.event?.trigger?.("ajaxStop");
    activeRequests--;
}

export function getActiveRequests() {
    return activeRequests;
}

function serviceFetch<TResponse extends ServiceResponse>(options: ServiceOptions<TResponse>): Promise<TResponse> {

    if (typeof fetch === "undefined")
        return Promise.reject("The fetch method is not available!");

    return (async function () {

        let url = options.service ? resolveServiceUrl(options.service) : resolveUrl(options.url);
        options = serviceOptions(url, options);

        requestStarting();
        try {
            options.blockUI && blockUI();

            try {
                let {
                    allowRedirect,
                    async,
                    blockUI,
                    request,
                    service,
                    url,
                    onCleanup,
                    onError,
                    onSuccess,
                    ...fetchInit
                } = options;

                var fetchResponse = await fetch(url, fetchInit);

                if (!fetchResponse.ok) {
                    await handleFetchError(fetchResponse, options);
                    return Promise.reject(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}!`);
                }

                let response = await fetchResponse.json() as TResponse;
                if (!response)
                    return Promise.reject(`Empty response received!`);

                if (response.Error) {
                    handleError(response ?? {}, { status: fetchResponse.status, statusText: fetchResponse.statusText }, options);
                    return Promise.reject(`Error: ${response?.Error?.Code} ${response?.Error.Message} ${response?.Error?.Arguments}!`);
                }

                options.onSuccess?.(response);
                return response;
            }
            finally {
                options.blockUI && blockUndo();
                options.onCleanup && options.onCleanup();
            }
        }
        finally {
            requestFinished();
        }
    })();
}

export function serviceCall<TResponse extends ServiceResponse>(options: ServiceOptions<TResponse>): PromiseLike<TResponse> {

    if (options?.async ?? true)
        return serviceFetch(options);

    let url = options.service ? resolveServiceUrl(options.service) : resolveUrl(options.url);

    var xhr = new XMLHttpRequest();
    xhr.open(options.method, url, false);

    if (options.cache == "no-store")
        options.headers["Cache-Control"] ??= "no-cache, no-store, max-age=0";
    else if (options.cache === "no-cache")
        options.headers["Cache-Control"] ??= "no-cache";

    for (var x in options.headers) {
        xhr.setRequestHeader(x, options.headers[x]);
    }

    if (isSameOrigin(url)) {
        var token = getCookie('CSRF-TOKEN');
        if (token)
            xhr.setRequestHeader('X-CSRF-TOKEN', token);
    }

    requestStarting();
    try {
        if (options.signal) {
            options.signal.addEventListener("abort", () => {
                xhr.abort();
            }, { once: true });
        }

        xhr.send(JSON.stringify(options.request));
        try {
            if (xhr.status !== 200) {
                handleXHRError(xhr, options);
                return Promise.reject(`HTTP ${xhr.status}: ${xhr.statusText}!`);
            }

            let response = JSON.parse(xhr.responseText) as TResponse;
            if (!response)
                return Promise.reject(`Empty response received!`);

            if (response.Error) {
                handleError(response, { status: xhr.status, statusText: xhr.statusText }, options);
                return Promise.reject(`Error: ${response?.Error?.Code} ${response?.Error.Message} ${response?.Error?.Arguments}!`);
            }

            options.onSuccess?.(response);
            return Promise.resolve(response);
        }
        finally {
            options.blockUI && blockUndo();
            options.onCleanup && options.onCleanup();
        }
    }
    catch (e) {
        return Promise.reject(e);
    }
    finally {
        requestFinished();
    }
}

export function serviceRequest<TResponse extends ServiceResponse>(service: string, request?: any,
    onSuccess?: (response: TResponse) => void, options?: ServiceOptions<TResponse>): PromiseLike<TResponse> {
    return serviceCall(Object.assign({
        service: service,
        request: request,
        onSuccess: onSuccess
    }, options));
}

function handleError(response: any, errorInfo: RequestErrorInfo, options?: ServiceOptions<any>) {

    if (Config.notLoggedInHandler != null &&
        response &&
        response.Error &&
        response.Error.Code == 'NotLoggedIn' &&
        Config.notLoggedInHandler(options, response)) {
        return;
    }

    if (options.onError?.(response, errorInfo))
        return;

    if (response?.Error) {
        ErrorHandling.showServiceError(response.Error, errorInfo);
        return;
    }
};

function handleRedirect(getHeader: (key: string) => string): boolean {
    var l: any = null;
    try {
        l = getHeader('Location');
    }
    catch ($t1) {
        l = null;
    }
    if (l) {
        window.top.location.href = l;
        return true;
    }
}

async function handleFetchError(response: Response, options: ServiceOptions<any>): Promise<void> {

    if (response.status !== 403 || !options.allowRedirect || !handleRedirect(response.headers.get))
        return;

    if ((response.headers.get('content-type') || '').toLowerCase().indexOf('json') >= 0) {
        var json = (await response.json()) as ServiceResponse;
        if (json && json.Error) {
            handleError(json.Error, {
                status: response.status,
                statusText: response.statusText
            });
            return;
        }
    }

    handleError(null, {
        status: response.status,
        statusText: response.statusText,
        responseText: await response.text()
    }, options);
}

function handleXHRError(xhr: XMLHttpRequest, options: ServiceOptions<any>) {
    if (xhr.status !== 403 || !options.allowRedirect || handleRedirect(xhr.getResponseHeader))
        return;

    if ((xhr.getResponseHeader('content-type') || '')
        .toLowerCase().indexOf('application/json') >= 0) {
        var json = JSON.parse(xhr.responseText);
        if (json && json.Error) {
            handleError(json, { status: xhr.status, statusText: xhr.statusText });
            return;
        }
    }

    handleError(null, { status: xhr.status, statusText: xhr.statusText, responseText: xhr.responseText }, options);
}