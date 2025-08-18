import "../protobuf.min.js";
import "../license_protocol.js";
import {
  AsyncLocalStorage,
  base64toUint8Array,
  stringToUint8Array,
  DeviceManager,
  RemoteCDMManager,
  SettingsManager,
} from "../util.js";

const key_container = document.getElementById("key-container");

function updateThemeVisuals(isDarkMode) {
  document.body.classList.toggle("dark-mode", isDarkMode);
  const textImage = document.getElementById("textImage");
  if (textImage) {
    textImage.src = isDarkMode
      ? "../images/proxy_text_dark.png"
      : "../images/proxy_text.png";
  }
}

function updateDeviceFieldsetVisibility() {
  const wvd_select = document.getElementById("wvd_select");
  document.getElementById("wvd").style.display = wvd_select.checked
    ? "block"
    : "none";
  document.getElementById("remote").style.display = wvd_select.checked
    ? "none"
    : "block";
}

const enabled = document.getElementById("enabled");
enabled.addEventListener("change", async function () {
  await SettingsManager.setEnabled(enabled.checked);
});

const toggle = document.getElementById("darkModeToggle");
toggle.addEventListener("change", async () => {
  await SettingsManager.saveDarkMode(toggle.checked);
  updateThemeVisuals(toggle.checked);
});

const wvd_select = document.getElementById("wvd_select");
wvd_select.addEventListener("change", async function () {
  if (wvd_select.checked) {
    await SettingsManager.saveSelectedDeviceType("WVD");
    updateDeviceFieldsetVisibility();
  }
});

const remote_select = document.getElementById("remote_select");
remote_select.addEventListener("change", async function () {
  if (remote_select.checked) {
    await SettingsManager.saveSelectedDeviceType("REMOTE");
    updateDeviceFieldsetVisibility();
  }
});

const export_button = document.getElementById("export");
export_button.addEventListener("click", async function () {
  const logs = await AsyncLocalStorage.getStorage(null);
  SettingsManager.downloadFile(
    stringToUint8Array(JSON.stringify(logs)),
    "logs.json"
  );
});

document.getElementById("fileInput").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_PICKER_WVD" });
  window.close();
});

const remove = document.getElementById("remove");
remove.addEventListener("click", async function () {
  await DeviceManager.removeSelectedWidevineDevice();
  wvd_combobox.innerHTML = "";
  await DeviceManager.loadSetAllWidevineDevices();
  const selected_option = wvd_combobox.options[wvd_combobox.selectedIndex];
  if (selected_option) {
    await DeviceManager.saveSelectedWidevineDevice(selected_option.text);
  } else {
    await DeviceManager.removeSelectedWidevineDeviceKey();
  }
});

const download = document.getElementById("download");
download.addEventListener("click", async function () {
  const widevine_device = await DeviceManager.getSelectedWidevineDevice();
  SettingsManager.downloadFile(
    base64toUint8Array(await DeviceManager.loadWidevineDevice(widevine_device)),
    widevine_device + ".wvd"
  );
});

const wvd_combobox = document.getElementById("wvd-combobox");
wvd_combobox.addEventListener("change", async function () {
  await DeviceManager.saveSelectedWidevineDevice(
    wvd_combobox.options[wvd_combobox.selectedIndex].text
  );
});

document.getElementById("remoteInput").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_PICKER_REMOTE" });
  window.close();
});

const remote_remove = document.getElementById("remoteRemove");
remote_remove.addEventListener("click", async function () {
  await RemoteCDMManager.removeSelectedRemoteCDM();
  remote_combobox.innerHTML = "";
  await RemoteCDMManager.loadSetAllRemoteCDMs();
  const selected_option =
    remote_combobox.options[remote_combobox.selectedIndex];
  if (selected_option) {
    await RemoteCDMManager.saveSelectedRemoteCDM(selected_option.text);
  } else {
    await RemoteCDMManager.removeSelectedRemoteCDMKey();
  }
});

const remote_download = document.getElementById("remoteDownload");
remote_download.addEventListener("click", async function () {
  const remote_cdm = await RemoteCDMManager.getSelectedRemoteCDM();
  SettingsManager.downloadFile(
    await RemoteCDMManager.loadRemoteCDM(remote_cdm),
    remote_cdm + ".json"
  );
});

const remote_combobox = document.getElementById("remote-combobox");
remote_combobox.addEventListener("change", async function () {
  await RemoteCDMManager.saveSelectedRemoteCDM(
    remote_combobox.options[remote_combobox.selectedIndex].text
  );
});

const use_shaka = document.getElementById("use-shaka");
use_shaka.addEventListener("change", async function () {
  await SettingsManager.saveUseShakaPackager(use_shaka.checked);
});

const downloader_name = document.getElementById("downloader-name");
downloader_name.addEventListener("input", async function (event) {
  await SettingsManager.saveExecutableName(downloader_name.value);
});

const clear = document.getElementById("clear");
clear.addEventListener("click", async function () {
  chrome.runtime.sendMessage({ type: "CLEAR" });
  key_container.innerHTML = "";
});

async function createCommand(json, key_string) {
  const metadata = JSON.parse(json);
  const header_string = Object.entries(metadata.headers)
    .map(([key, value]) => `-H "${key}: ${value.replace(/"/g, "'")}"`)
    .join(" ");
  return `${await SettingsManager.getExecutableName()} "${
    metadata.url
  }" ${header_string} ${key_string} ${
    (await SettingsManager.getUseShakaPackager()) ? "--use-shaka-packager " : ""
  }-M format=mkv`;
}

async function appendLog(result) {
  const key_string = result.keys
    .map((key) => `--key ${key.kid}:${key.k}`)
    .join(" ");
  const date = new Date(result.timestamp * 1000);
  const date_string = date.toLocaleString();

  const logContainer = document.createElement("div");
  logContainer.classList.add("log-container");
  logContainer.innerHTML = `
        <button class="toggleButton">+</button>
        <div class="expandableDiv collapsed">
            <label class="always-visible">
                <span>URL:</span><input type="text" class="text-box" readonly value="${
                  result.url
                }">
            </label>
            <div class="expanded-only">
                <label>
                    <span>PSSH:</span><input type="text" class="text-box" readonly value="${
                      result.pssh_data
                    }">
                </label>
                <label class="key-copy">
                    <a href="#" title="Click to copy">Keys:</a><input type="text" class="text-box" readonly value="${key_string}">
                </label>
                <label>
                    <span>Date:</span><input type="text" class="text-box" readonly value="${date_string}">
                </label>
                ${
                  result.manifests.length > 0
                    ? `<label class="manifest-copy">
                    <a href="#" title="Click to copy">Manifest:</a><select class="text-box"></select>
                </label>
                <label class="command-copy">
                    <a href="#" title="Click to copy">Cmd:</a><input type="text" class="text-box" readonly>
                </label>`
                    : ""
                }
            </div>
        </div>`;

  logContainer.querySelector(".key-copy > a").addEventListener("click", (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(key_string);
  });

  if (result.manifests.length > 0) {
    const commandInput = logContainer.querySelector(".command-copy input");
    const select = logContainer.querySelector(".manifest-copy select");
    const updateCommand = async () => {
      commandInput.value = await createCommand(select.value, key_string);
    };
    select.addEventListener("change", updateCommand);
    result.manifests.forEach((manifest) => {
      const option = new Option(
        `[${manifest.type}] ${manifest.url}`,
        JSON.stringify(manifest)
      );
      select.add(option);
    });
    updateCommand();
    logContainer
      .querySelector(".manifest-copy > a")
      .addEventListener("click", (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(JSON.parse(select.value).url);
      });
    logContainer
      .querySelector(".command-copy > a")
      .addEventListener("click", (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(commandInput.value);
      });
  }

  const toggleButtons = logContainer.querySelector(".toggleButton");
  toggleButtons.addEventListener("click", function () {
    const expandableDiv = this.nextElementSibling;
    if (expandableDiv.classList.contains("collapsed")) {
      this.innerHTML = "-";
      expandableDiv.classList.remove("collapsed");
    } else {
      this.innerHTML = "+";
      expandableDiv.classList.add("collapsed");
    }
  });
  key_container.appendChild(logContainer);
}

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "local") {
    for (const [key, values] of Object.entries(changes)) {
      await appendLog(values.newValue);
    }
  }
});

function checkLogs() {
  chrome.runtime.sendMessage({ type: "GET_LOGS" }, (response) => {
    if (response) {
      response.forEach(async (result) => {
        await appendLog(result);
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  enabled.checked = await SettingsManager.getEnabled();
  const isDarkMode = await SettingsManager.getDarkMode();
  toggle.checked = isDarkMode;
  use_shaka.checked = await SettingsManager.getUseShakaPackager();
  downloader_name.value = await SettingsManager.getExecutableName();

  updateThemeVisuals(isDarkMode);
  await SettingsManager.setSelectedDeviceType(
    await SettingsManager.getSelectedDeviceType()
  );
  updateDeviceFieldsetVisibility();

  await DeviceManager.loadSetAllWidevineDevices();
  await DeviceManager.selectWidevineDevice(
    await DeviceManager.getSelectedWidevineDevice()
  );
  await RemoteCDMManager.loadSetAllRemoteCDMs();
  await RemoteCDMManager.selectRemoteCDM(
    await RemoteCDMManager.getSelectedRemoteCDM()
  );

  checkLogs();
});
