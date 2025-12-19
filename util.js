import { WidevineDevice } from "./device.js";
import { RemoteCdm } from "./remote_cdm.js";

export class AsyncSyncStorage {
    static async setStorage(items) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.set(items, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve();
                }
            });
        });
    }

    static async getStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve(result);
                }
            });
        });
    }

    static async removeStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.remove(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve(result);
                }
            });
        });
    }
}

export class AsyncLocalStorage {
    static async setStorage(items) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve();
                }
            });
        });
    }

    static async getStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve(result);
                }
            });
        });
    }

    static async removeStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve(result);
                }
            });
        });
    }
}

export class DeviceManager {
    static async saveWidevineDevice(name, value) {
        const result = await AsyncSyncStorage.getStorage(['devices']);
        const array = result.devices === undefined ? [] : result.devices;
        array.push(name);
        await AsyncSyncStorage.setStorage({ devices: array });
        await AsyncSyncStorage.setStorage({ [name]: value });
    }

    static async loadWidevineDevice(name) {
        const result = await AsyncSyncStorage.getStorage([name]);
        return result[name] || "";
    }

    static setWidevineDevice(name, value){
        const wvd_combobox = document.getElementById('wvd-combobox');
        const wvd_element = document.createElement('option');

        wvd_element.text = name;
        wvd_element.value = value;

        wvd_combobox.appendChild(wvd_element);
    }

    static async loadSetAllWidevineDevices() {
        const result = await AsyncSyncStorage.getStorage(['devices']);
        const array = result.devices || [];
        for (const item of array) {
            this.setWidevineDevice(item, await this.loadWidevineDevice(item));
        }
    }

    static async saveSelectedWidevineDevice(name) {
        await AsyncSyncStorage.setStorage({ selected: name });
    }

    static async getSelectedWidevineDevice() {
        const result = await AsyncSyncStorage.getStorage(["selected"]);
        return result["selected"] || "";
    }

    static async selectWidevineDevice(name) {
        document.getElementById('wvd-combobox').value = await this.loadWidevineDevice(name);
    }

    static async removeSelectedWidevineDevice() {
        const selected_device_name = await DeviceManager.getSelectedWidevineDevice();

        const result = await AsyncSyncStorage.getStorage(['devices']);
        const array = result.devices === undefined ? [] : result.devices;

        const index = array.indexOf(selected_device_name);
        if (index > -1) {
            array.splice(index, 1);
        }

        await AsyncSyncStorage.setStorage({ devices: array });
        await AsyncSyncStorage.removeStorage([selected_device_name]);
    }

    static async removeSelectedWidevineDeviceKey() {
        await AsyncSyncStorage.removeStorage(["selected"]);
    }
}

export class RemoteCDMManager {
    static async saveRemoteCDM(name, obj) {
        const result = await AsyncSyncStorage.getStorage(['remote_cdms']);
        const array = result.remote_cdms === undefined ? [] : result.remote_cdms;
        array.push(name);
        await AsyncSyncStorage.setStorage({ remote_cdms: array });
        await AsyncSyncStorage.setStorage({ [name]: obj });
    }

    static async loadRemoteCDM(name) {
        const result = await AsyncSyncStorage.getStorage([name]);
        return JSON.stringify(result[name] || {});
    }

    static setRemoteCDM(name, value){
        const remote_combobox = document.getElementById('remote-combobox');
        const remote_element = document.createElement('option');

        remote_element.text = name;
        remote_element.value = value;

        remote_combobox.appendChild(remote_element);
    }

    static async loadSetAllRemoteCDMs() {
        const result = await AsyncSyncStorage.getStorage(['remote_cdms']);
        const array = result.remote_cdms || [];
        for (const item of array) {
            this.setRemoteCDM(item, await this.loadRemoteCDM(item));
        }
    }

    static async saveSelectedRemoteCDM(name) {
        await AsyncSyncStorage.setStorage({ selected_remote_cdm: name });
    }

    static async getSelectedRemoteCDM() {
        const result = await AsyncSyncStorage.getStorage(["selected_remote_cdm"]);
        return result["selected_remote_cdm"] || "";
    }

    static async selectRemoteCDM(name) {
        document.getElementById('remote-combobox').value = await this.loadRemoteCDM(name);
    }

    static async removeSelectedRemoteCDM() {
        const selected_remote_cdm_name = await RemoteCDMManager.getSelectedRemoteCDM();

        const result = await AsyncSyncStorage.getStorage(['remote_cdms']);
        const array = result.remote_cdms === undefined ? [] : result.remote_cdms;

        const index = array.indexOf(selected_remote_cdm_name);
        if (index > -1) {
            array.splice(index, 1);
        }

        await AsyncSyncStorage.setStorage({ remote_cdms: array });
        await AsyncSyncStorage.removeStorage([selected_remote_cdm_name]);
    }

    static async removeSelectedRemoteCDMKey() {
        await AsyncSyncStorage.removeStorage(["selected_remote_cdm"]);
    }
}

export class SettingsManager {
    static async setEnabled(enabled) {
        await AsyncSyncStorage.setStorage({ enabled: enabled });
    }

    static async getEnabled() {
        const result = await AsyncSyncStorage.getStorage(["enabled"]);
        return result["enabled"] === undefined ? false : result["enabled"];
    }

    static downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    static async importDevice(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (loaded) {
                const result = loaded.target.result;

                const widevine_device = new WidevineDevice(result);
                const b64_device = uint8ArrayToBase64(new Uint8Array(result));
                const device_name = widevine_device.get_name();

                if (!await DeviceManager.loadWidevineDevice(device_name)) {
                    await DeviceManager.saveWidevineDevice(device_name, b64_device);
                }

                await DeviceManager.saveSelectedWidevineDevice(device_name);
                resolve();
            };
            reader.readAsArrayBuffer(file);
        });
    }

    static async saveDarkMode(dark_mode) {
        await AsyncSyncStorage.setStorage({ dark_mode: dark_mode });
    }

    static async getDarkMode() {
        const result = await AsyncSyncStorage.getStorage(["dark_mode"]);
        return result["dark_mode"] || false;
    }

    static setDarkMode(dark_mode) {
        const textImage = document.getElementById("textImage");
        const toggle = document.getElementById('darkModeToggle');
        toggle.checked = dark_mode;
        document.body.classList.toggle('dark-mode', dark_mode);
        textImage.src = dark_mode ? "../images/proxy_text_dark.png" : "../images/proxy_text.png";
    }

    static async loadRemoteCDM(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (loaded) {
                const result = loaded.target.result;

                let json_file = void 0;
                try {
                    json_file = JSON.parse(result);
                } catch {
                    resolve();
                    return;
                }

                console.log("LOADED DEVICE:", json_file);
                const remote_cdm = new RemoteCdm(
                    json_file.device_type,
                    json_file.system_id,
                    json_file.security_level,
                    json_file.host,
                    json_file.secret,
                    json_file.device_name ?? json_file.name,
                );
                const device_name = remote_cdm.get_name();
                console.log("NAME:", device_name);

                if (await RemoteCDMManager.loadRemoteCDM(device_name) === "{}") {
                    await RemoteCDMManager.saveRemoteCDM(device_name, json_file);
                }

                await RemoteCDMManager.saveSelectedRemoteCDM(device_name);
                resolve();
            };
            reader.readAsText(file);
        });
    }

    static async saveSelectedDeviceType(selected_type) {
        await AsyncSyncStorage.setStorage({ device_type: selected_type });
    }

    static async getSelectedDeviceType() {
        const result = await AsyncSyncStorage.getStorage(["device_type"]);
        return result["device_type"] || "WVD";
    }

    static setSelectedDeviceType(device_type) {
        switch (device_type) {
            case "WVD":
                const wvd_select = document.getElementById('wvd_select');
                wvd_select.checked = true;
                break;
            case "REMOTE":
                const remote_select = document.getElementById('remote_select');
                remote_select.checked = true;
                break;
        }
    }

    static async saveUseShakaPackager(use_shaka) {
        await AsyncSyncStorage.setStorage({ use_shaka: use_shaka });
    }

    static async getUseShakaPackager() {
        const result = await AsyncSyncStorage.getStorage(["use_shaka"]);
        return result["use_shaka"] ?? true;
    }

    static async saveExecutableName(exe_name) {
        await AsyncSyncStorage.setStorage({ exe_name: exe_name });
    }

    static async getExecutableName() {
        const result = await AsyncSyncStorage.getStorage(["exe_name"]);
        return result["exe_name"] ?? "N_m3u8DL-RE";
    }

    static async saveAdditionalArguments(additional_args) {
        await AsyncSyncStorage.setStorage({ additional_args: additional_args });
    }

    static async getAdditionalArguments() {
        const result = await AsyncSyncStorage.getStorage(["additional_args"]);
        return result["additional_args"] ?? "";
    }
}

export function intToUint8Array(num) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, num, false);
    return new Uint8Array(buffer);
}

export function compareUint8Arrays(arr1, arr2) {
    if (arr1.length !== arr2.length)
        return false;
    return Array.from(arr1).every((value, index) => value === arr2[index]);
}

export function uint8ArrayToHex(buffer) {
    return Array.prototype.map.call(buffer, x => x.toString(16).padStart(2, '0')).join('');
}

export function uint8ArrayToString(uint8array) {
    return String.fromCharCode.apply(null, uint8array)
}

export function uint8ArrayToBase64(uint8array) {
    return btoa(String.fromCharCode.apply(null, uint8array));
}

export function base64toUint8Array(base64_string){
    return Uint8Array.from(atob(base64_string), c => c.charCodeAt(0))
}

export function stringToUint8Array(string) {
    return Uint8Array.from(string.split("").map(x => x.charCodeAt()))
}

export function stringToHex(string){
    return string.split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
}
