import "./lib/protobuf.min.js";
import "./lib/license_protocol.min.js";
const { LicenseType, SignedMessage, LicenseRequest, License } = protobuf.roots.default.license_protocol;

import "./lib/forge.min.js";

import { Session } from "./lib/cdm.js";
import { DeviceManager, SettingsManager, AsyncLocalStorage, RemoteCDMManager, Util } from "./lib/util.js";
import { WidevineDevice } from "./lib/device.js";
import { RemoteCdm } from "./lib/remote_cdm.js";


let manifests = new Map();
let requests = new Map();
let sessions = new Map();
let logs = [];

chrome.webRequest.onBeforeSendHeaders.addListener(
    function (details) {
        if (details.method === "GET") {
            if (!requests.has(details.url)) {
                const headers = details.requestHeaders
                    .filter(item => !(
                        item.name.startsWith('sec-ch-ua') ||
                        item.name.startsWith('Sec-Fetch') ||
                        item.name.startsWith('Accept-') ||
                        item.name.startsWith('Host') ||
                        item.name === "Connection"
                    )).reduce((acc, item) => {
                        acc[item.name] = item.value;
                        return acc;
                    }, {});
                requests.set(details.url, headers);
            }
        }
    },
    { urls: ["<all_urls>"] },
    ['requestHeaders', chrome.webRequest.OnSendHeadersOptions.EXTRA_HEADERS].filter(Boolean)
);

async function parseClearKey(body, sendResponse, tab_url) {
    const clearkey = JSON.parse(atob(body));

    const formatted_keys = clearkey["keys"].map(key => ({
        ...key,
        kid: Util.bytesToHex(Util.b64.decode(key.kid.replace(/-/g, "+").replace(/_/g, "/") + "==")),
        k: Util.bytesToHex(Util.b64.decode(key.k.replace(/-/g, "+").replace(/_/g, "/") + "=="))
    }));
    const pssh_data = btoa(JSON.stringify({ kids: clearkey["keys"].map(key => key.k) }));

    if (logs.filter(log => log.pssh_data === pssh_data).length > 0) {
        console.log("[WidevineProxy2]", `KEYS_ALREADY_RETRIEVED: ${pssh_data}`);
        sendResponse();
        return;
    }

    console.log("[WidevineProxy2]", "CLEARKEY KEYS", formatted_keys, tab_url);
    const log = {
        type: "CLEARKEY",
        pssh_data: pssh_data,
        keys: formatted_keys,
        url: tab_url,
        timestamp: Math.floor(Date.now() / 1000),
        manifests: manifests.has(tab_url) ? manifests.get(tab_url) : []
    }
    logs.push(log);

    await AsyncLocalStorage.setStorage({ [pssh_data]: log });
    sendResponse();
}

async function generateChallenge(body, sendResponse) {
    const signed_message = SignedMessage.decode(Util.b64.decode(body));
    const license_request = LicenseRequest.decode(signed_message.msg);
    const pssh_data = license_request.contentId.widevinePsshData.psshData[0];

    if (!pssh_data) {
        console.log("[WidevineProxy2]", "NO_PSSH_DATA_IN_CHALLENGE");
        sendResponse(body);
        return;
    }

    if (logs.filter(log => log.pssh_data === Session.psshDataToPsshBoxB64(pssh_data)).length > 0) {
        console.log("[WidevineProxy2]", `KEYS_ALREADY_RETRIEVED: ${Util.b64.encode(pssh_data)}`);
        sendResponse(body);
        return;
    }

    const selected_device_name = await DeviceManager.getSelectedWidevineDevice();
    if (!selected_device_name) {
        sendResponse(body);
        return;
    }

    const device_b64 = await DeviceManager.loadWidevineDevice(selected_device_name);
    const widevine_device = new WidevineDevice(Util.b64.decode(device_b64).buffer);

    const private_key = `-----BEGIN RSA PRIVATE KEY-----${Util.b64.encode(widevine_device.private_key)}-----END RSA PRIVATE KEY-----`;
    const session = new Session(
        {
            privateKey: private_key,
            identifierBlob: widevine_device.client_id_bytes
        },
        pssh_data
    );

    const [challenge, request_id] = session.createLicenseRequest(LicenseType.STREAMING, widevine_device.type === 2);
    sessions.set(Util.b64.encode(request_id), session);

    sendResponse(Util.b64.encode(challenge));
}

async function parseLicense(body, sendResponse, tab_url) {
    const license = Util.b64.decode(body);
    const signed_license_message = SignedMessage.decode(license);

    if (signed_license_message.type !== SignedMessage.MessageType.LICENSE) {
        sendResponse();
        return;
    }

    const license_obj = License.decode(signed_license_message.msg);
    const loaded_request_id = Util.b64.encode(license_obj.id.requestId);

    if (!sessions.has(loaded_request_id)) {
        sendResponse();
        return;
    }

    const loadedSession = sessions.get(loaded_request_id);
    const keys = await loadedSession.parseLicense(license);
    const pssh = loadedSession.getPSSH();

    console.log("[WidevineProxy2]", "KEYS", JSON.stringify(keys), tab_url);
    const log = {
        type: "WIDEVINE",
        pssh_data: pssh,
        keys: keys,
        url: tab_url,
        timestamp: Math.floor(Date.now() / 1000),
        manifests: manifests.has(tab_url) ? manifests.get(tab_url) : []
    }
    logs.push(log);
    await AsyncLocalStorage.setStorage({ [pssh]: log });

    sessions.delete(loaded_request_id);
    sendResponse();
}

async function generateChallengeRemote(body, sendResponse) {
    const signed_message = SignedMessage.decode(Util.b64.decode(body));
    const license_request = LicenseRequest.decode(signed_message.msg);
    const pssh_data = license_request.contentId.widevinePsshData.psshData[0];

    if (!pssh_data) {
        console.log("[WidevineProxy2]", "NO_PSSH_DATA_IN_CHALLENGE");
        sendResponse(body);
        return;
    }

    const pssh = Session.psshDataToPsshBoxB64(pssh_data);

    if (logs.filter(log => log.pssh_data === pssh).length > 0) {
        console.log("[WidevineProxy2]", `KEYS_ALREADY_RETRIEVED: ${Util.b64.encode(pssh_data)}`);
        sendResponse(body);
        return;
    }

    const selected_remote_cdm_name = await RemoteCDMManager.getSelectedRemoteCDM();
    if (!selected_remote_cdm_name) {
        sendResponse(body);
        return;
    }

    const selected_remote_cdm = JSON.parse(await RemoteCDMManager.loadRemoteCDM(selected_remote_cdm_name));
    const remote_cdm = RemoteCdm.from_object(selected_remote_cdm);

    const session_id = await remote_cdm.open();
    const challenge_b64 = await remote_cdm.get_license_challenge(session_id, pssh, true);

    const signed_challenge_message = SignedMessage.decode(Util.b64.decode(challenge_b64));
    const challenge_message = LicenseRequest.decode(signed_challenge_message.msg);

    sessions.set(Util.b64.encode(challenge_message.contentId.widevinePsshData.requestId), {
        id: session_id,
        pssh: pssh
    });
    sendResponse(challenge_b64);
}

async function parseLicenseRemote(body, sendResponse, tab_url) {
    const license = Util.b64.decode(body);
    const signed_license_message = SignedMessage.decode(license);

    if (signed_license_message.type !== SignedMessage.MessageType.LICENSE) {
        sendResponse();
        return;
    }

    const license_obj = License.decode(signed_license_message.msg);
    const loaded_request_id = Util.b64.encode(license_obj.id.requestId);

    if (!sessions.has(loaded_request_id)) {
        sendResponse();
        return;
    }

    const session_id = sessions.get(loaded_request_id);

    const selected_remote_cdm_name = await RemoteCDMManager.getSelectedRemoteCDM();
    if (!selected_remote_cdm_name) {
        sendResponse();
        return;
    }

    const selected_remote_cdm = JSON.parse(await RemoteCDMManager.loadRemoteCDM(selected_remote_cdm_name));
    const remote_cdm = RemoteCdm.from_object(selected_remote_cdm);

    await remote_cdm.parse_license(session_id.id, body);
    const returned_keys = await remote_cdm.get_keys(session_id.id, "CONTENT");
    await remote_cdm.close(session_id.id);

    if (returned_keys.length === 0) {
        sendResponse();
        return;
    }

    const keys = returned_keys.map(({ key, key_id }) => ({ k: key, kid: key_id }));

    console.log("[WidevineProxy2]", "KEYS", JSON.stringify(keys), tab_url);
    const log = {
        type: "WIDEVINE",
        pssh_data: session_id.pssh,
        keys: keys,
        url: tab_url,
        timestamp: Math.floor(Date.now() / 1000),
        manifests: manifests.has(tab_url) ? manifests.get(tab_url) : []
    }
    logs.push(log);
    await AsyncLocalStorage.setStorage({ [session_id.pssh]: log });

    sessions.delete(loaded_request_id);
    sendResponse();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        const tab_url = sender.tab ? sender.tab.url : null;

        switch (message.type) {
            case "REQUEST":
                if (!await SettingsManager.getEnabled()) {
                    sendResponse(message.body);
                    manifests.clear();
                    return;
                }

                try {
                    JSON.parse(atob(message.body));
                    sendResponse(message.body);
                    return;
                } catch {
                    if (message.body) {
                        const device_type = await SettingsManager.getSelectedDeviceType();
                        switch (device_type) {
                            case "WVD":
                                await generateChallenge(message.body, sendResponse);
                                break;
                            case "REMOTE":
                                await generateChallengeRemote(message.body, sendResponse);
                                break;
                        }
                    }
                }
                break;

            case "RESPONSE":
                if (!await SettingsManager.getEnabled()) {
                    sendResponse(message.body);
                    manifests.clear();
                    return;
                }

                try {
                    await parseClearKey(message.body, sendResponse, tab_url);
                    return;
                } catch (e) {
                    const device_type = await SettingsManager.getSelectedDeviceType();
                    switch (device_type) {
                        case "WVD":
                            await parseLicense(message.body, sendResponse, tab_url);
                            break;
                        case "REMOTE":
                            await parseLicenseRemote(message.body, sendResponse, tab_url);
                            break;
                    }
                    return;
                }
            case "GET_LOGS":
                sendResponse(logs);
                break;
            case "OPEN_PICKER_WVD":
                chrome.windows.create({
                    url: 'picker/wvd/filePicker.html',
                    type: 'popup',
                    width: 300,
                    height: 200,
                });
                break;
            case "OPEN_PICKER_WVD_MOBILE":
                chrome.tabs.create({
                    url: chrome.runtime.getURL("picker/wvd/filePicker.html")
                });
                break;
            case "OPEN_PICKER_REMOTE":
                chrome.windows.create({
                    url: 'picker/remote/filePicker.html',
                    type: 'popup',
                    width: 300,
                    height: 200,
                });
                break;
            case "OPEN_PICKER_REMOTE_MOBILE":
                chrome.tabs.create({
                    url: chrome.runtime.getURL("picker/remote/filePicker.html")
                });
                break;
            case "CLEAR":
                logs = [];
                manifests.clear();
                break;
            case "MANIFEST":
                const parsed = JSON.parse(message.body);
                const element = {
                    type: parsed.type,
                    url: parsed.url,
                    headers: requests.has(parsed.url) ? requests.get(parsed.url) : [],
                };

                if (!manifests.has(tab_url)) {
                    manifests.set(tab_url, [element]);
                } else {
                    let elements = manifests.get(tab_url);
                    if (!elements.some(e => e.url === parsed.url)) {
                        elements.push(element);
                        manifests.set(tab_url, elements);
                    }
                }
                sendResponse();
        }
    })();
    return true;
});
