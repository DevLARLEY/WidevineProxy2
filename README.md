# WidevineProxy2
An extension-based proxy for Widevine EME challenges and license messages. \
Modifies the challenge before it reaches the web player and obtains the decryption keys from the response.

## Features
+ User-friendly / GUI-based
+ Bypasses one-time tokens, hashes and license wrapping
+ JavaScript native Widevine implementation
+ Supports Widevine Device files
+ Manifest V3 compliant

## Widevine Devices
This addon requires a Widevine Device file to work, which is not provided by this project.
+ Follow [this](https://forum.videohelp.com/threads/408031) guide if you want to dump your own device.
+ Ready-to-use Widevine Devices can be found on the [VideoHelp forum](https://forum.videohelp.com/forums/48).

## Compatibility
+ Compatible (tested) browsers: Firefox/Chrome on Windows/Linux.
+ Works with any service that accepts challenges from Android devices on the same endpoint.

## Installation
+ Chrome
  1. Download this repository as a ZIP file
  2. Navigate to `chrome://extensions/`
  3. Enable `Developer mode`
  4. Click `Load unpacked` and the select downloaded file
+ Firefox
  + Persistent installation
    1. Download the XPI file from the [releases section](https://github.com/DevLARLEY/WidevineProxy2/releases)
    2. Navigate to `about:addons`
    3. Click the settings icon and choose `Install Add-on From File...`
    4. Select the downloaded file
  + Temporary installation
    1. Download this repository as a ZIP file
    2. Navigate to `about:debugging#/runtime/this-firefox`
    3. Click `Load Temporary Add-on...` and select the downloaded file

## Setup
+ Once installed, open the extension, click `Choose File` and select your Widevine Device file.
+ The files are saved in the extension's `chrome.storage.sync` storage and will be synchronized across any browsers into which the user is signed in with their Google account.
+ Due to the sync storage limit of 100KB, the maximum number of installable devices at the same time is ~30.
+ Check `Enabled` to activate the message interception and you're done.

## Usage
All the user has to do is to play a DRM protected video and the decryption keys should appear in the `Keys` group box (if the service is not unsupported, as stated above). \
Keys are saved:
+ Temporarily until the extension is either refreshed manually (if installed temporarily) or a removal of the keys is manually initiated.
+ Permanently in the extension's `chrome.storage.local` storage until manually wiped or exported via the command line.
> [!NOTE]  
> The video will not play when the interception is active, as the Widevine CDM library isn't able to decrypt the Android CDM license.

+ Click the `+` button to expand the section to reveal the PSSH and keys. 


## Issues
+ DRM playback won't work when the extension is disabled and EME Logger is active. This is caused by my fix for dealing with EME Logger interference (solutions are welcome).

## Demo
[Widevineproxy2.webm](https://github.com/user-attachments/assets/8f51cee3-50e2-4aa4-b244-afa2d0b2987e)

## Disclaimer
+ This program is intended solely for educational purposes.
+ Do not use this program to decrypt or access any content for which you do not have the legal rights or explicit permission.
+ Unauthorized decryption or distribution of copyrighted materials is a violation of applicable laws and intellectual property rights.
+ This tool must not be used for any illegal activities, including but not limited to piracy, circumventing digital rights management (DRM), or unauthorized access to protected content.
+ The developers, contributors, and maintainers of this program are not responsible for any misuse or illegal activities performed using this software.
+ By using this program, you agree to comply with all applicable laws and regulations governing digital rights and copyright protections.

## Credits
+ [node-widevine](https://github.com/Frooastside/node-widevine)
+ [forge](https://github.com/digitalbazaar/forge)
+ [protobuf.js](https://github.com/protobufjs/protobuf.js)