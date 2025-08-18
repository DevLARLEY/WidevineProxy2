import "../../protobuf.min.js";
import "../../license_protocol.js";
import { SettingsManager } from "../../util.js";

document
  .getElementById("fileInput")
  .addEventListener("change", async (event) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      console.log("No file selected.");
      return;
    }

    const file = files[0];

    try {
      console.log(`Importing: ${file.name}`);
      await SettingsManager.importDevice(file);

      console.log("File imported successfully. Closing window.");
      window.close();
    } catch (error) {
      console.error("An error occurred during file import:", error);
      alert(
        `Failed to import "${file.name}". Please check the console for details.`
      );
    }
  });
