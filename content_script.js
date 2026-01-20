(async () => {
    const proxy = (object, method, handler) => {
        const original = object[method];
        if (typeof original !== "function")
            return;

        Object.defineProperty(object, method, {
            value: new Proxy(original, { apply: handler }),
            configurable: true,
            writable: true
        });
    };

    const b64 = {
        decode: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)),
        encode: b => btoa(String.fromCharCode(...new Uint8Array(b)))
    };

    const getManifestType = (text) => {
        const lower = text.toLowerCase();
        if (lower.includes('<mpd') && lower.includes('</mpd>')) {
            return "DASH";
        } else if (lower.includes('#extm3u')) {
            if (lower.includes('#ext-x-stream-inf')) {
                return "HLS_MASTER";
            } else {
                return "HLS_PLAYLIST";
            }
        } else if (lower.includes('<smoothstreamingmedia') && lower.includes('</smoothstreamingmedia>')) {
            return "MSS";
        }
    }

    function emitAndWaitForResponse(type, data) {
        return new Promise((resolve) => {
            const requestId = Math.random().toString(16).substring(2, 9);
            const responseHandler = (event) => {
                const { detail } = event;
                if (detail.substring(0, 7) === requestId) {
                    document.removeEventListener('responseReceived', responseHandler);
                    resolve(detail.substring(7));
                }
            };
            document.addEventListener('responseReceived', responseHandler);
            const requestEvent = new CustomEvent('response', {
                detail: {
                    type: type,
                    body: data,
                    requestId: requestId,
                }
            });
            document.dispatchEvent(requestEvent);
        });
    }

    if (typeof EventTarget !== 'undefined') {
        proxy(EventTarget.prototype, 'addEventListener', (target, thisArg, args) => {
            const [type, listener] = args;

            if (thisArg == null || typeof MediaKeySession === 'undefined' || !(thisArg instanceof MediaKeySession) || typeof MediaKeyMessageEvent === 'undefined' || type !== "message" || !listener) {
                return target.apply(thisArg, args);
            }

            args[1] = async function (event) {
                if (event instanceof MediaKeyMessageEvent && event.isTrusted && event.message.byteLength > 2) {
                    const oldChallenge = b64.encode(event.message);
                    const newChallenge = await emitAndWaitForResponse("REQUEST", oldChallenge);

                    const clonedEvent = new MediaKeyMessageEvent("message", {
                        messageType: event.messageType,
                        message: b64.decode(newChallenge).buffer
                    });

                    event.stopImmediatePropagation();
                    event.preventDefault();

                    thisArg.dispatchEvent(clonedEvent);
                    return;
                }

                if (listener.handleEvent) {
                    listener.handleEvent.call(listener, event);
                } else {
                    listener.call(this, event);
                }
            };

            return target.apply(thisArg, args);
        });
    }

    if (typeof MediaKeySession !== 'undefined') {
        proxy(MediaKeySession.prototype, 'update', async (target, thisArg, args) => {
            if (thisArg == null || !(thisArg instanceof MediaKeySession)) {
                return target.apply(thisArg, args);
            }

            await emitAndWaitForResponse("RESPONSE", b64.encode(args[0]))

            return await target.apply(thisArg, args);
        });
    }

    proxy(XMLHttpRequest.prototype, "open", (target, thisArg, args) => {
        const [method, url] = args;

        thisArg.requestMethod = method.toUpperCase();
        thisArg.requestURL = url;

        return target.apply(thisArg, args);
    });

    proxy(XMLHttpRequest.prototype, "send", (target, thisArg, args) => {
        thisArg.addEventListener("readystatechange", async () => {
            if (thisArg.requestMethod !== "GET" || thisArg.readyState !== 4) {
                return;
            }

            let body = null;
            switch (thisArg.responseType) {
                case "":
                case "text":
                    body = thisArg.responseText ?? thisArg.response;
                    break;

                case "json":
                    body = typeof thisArg.response === 'string' ? thisArg.response : JSON.stringify(thisArg.response);
                    break;

                case "arraybuffer":
                    if (thisArg.response && thisArg.response.byteLength > 0 && thisArg.response.byteLength < 1_000_000) {
                        const arr = new Uint8Array(thisArg.response);
                        const decoder = new TextDecoder('utf-8', { fatal: false });
                        body = arr.length <= 2000
                            ? decoder.decode(arr)
                            : decoder.decode(arr.slice(0, 1000)) + decoder.decode(arr.slice(-1000));
                    }
                    break;

                case "blob":
                    if (thisArg.response.type.startsWith('text/') || thisArg.response.type.includes('xml') || thisArg.response.type.includes('json') || thisArg.response.size < 100_000) {
                        body = await thisArg.response.text();
                    }
                    break;

                case "document":
                    if (thisArg.response?.documentElement) {
                        body = new XMLSerializer().serializeToString(thisArg.response);
                    }
                    break;
            }

            if (body) {
                const manifest_type = getManifestType(body);
                if (manifest_type) {
                    console.log("WVP2 FOUND MANIFEST", manifest_type, thisArg.responseURL);
                    await emitAndWaitForResponse("MANIFEST", JSON.stringify({
                        url: thisArg.responseURL,
                        type: manifest_type,
                    }));
                }
            }
        });

        return target.apply(thisArg, args);
    });

    proxy(window, "fetch", async (target, thisArg, args) => {
        const response = await target.apply(thisArg, args);

        try {
            if (response) {
                const text = await response.clone().text();
                const manifest_type = getManifestType(text);

                if (manifest_type) {
                    const url = typeof args[0] === "string" ? args[0] : args[0]?.url;

                    if (url) {
                        await emitAndWaitForResponse("MANIFEST", JSON.stringify({
                            url,
                            type: manifest_type
                        }));
                    }
                }
            }
        } catch (err) {
            console.debug("Manifest intercept failed:", err);
        }

        return response;
    });
})();
