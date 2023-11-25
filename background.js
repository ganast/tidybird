import * as common from '../options/default_options.js';

//(async () => {
async function run() {
  // the first parameter of this function gets tab information when using the button
  async function toggleTidybirdBySettings(startupEvent = false) {
    let htmlPage = "content/tidybirdpane.html";

    // upgrade from 4 to 5: get settings from sync
    let displaySettings = await messenger.storage.sync.get({
      isShowing: true, // we want the default on startup to be "restore showing"
      width: undefined, // undefined is also returned when no default asked
    });

    displaySettings = await messenger.storage.local.get({
      isShowing: displaySettings.isShowing,
      width: displaySettings.width,
      startup: common.option_defaults.startup,
    });

    let showOnStartup = false;
    if(startupEvent === true) { // startupEvent can also be an event
      if (displaySettings.startup == "shown") {
        showOnStartup = true;
      } else if (displaySettings.startup == "hidden") {
        showOnStartup = false;
      } else { // displaySettings.startup == "auto"
        showOnStartup = displaySettings.isShowing; // last known state
      }
    }
    if (
      ( startupEvent === true && showOnStartup ) // startup
      ||
      ( startupEvent !== true && !displaySettings.isShowing ) // toggle
    ) {
      messenger.ex_customui.add(
        messenger.ex_customui.LOCATION_MESSAGING,
        htmlPage,
        { "width": displaySettings.width }
      );
      messenger.storage.local.set({ ["isShowing"]: true });
    } else {
      messenger.storage.local.set({ ["isShowing"]: false });
      messenger.ex_customui.remove(
        messenger.ex_customui.LOCATION_MESSAGING,
        htmlPage
      );
    }

    // remove old version 4 settings
    messenger.storage.sync.clear();
  }

  // initial startup (or not)
  toggleTidybirdBySettings(true);

  // add listener to our button
  messenger.browserAction.onClicked.addListener(toggleTidybirdBySettings);


  // MRM manager
  async function actOnMessageEvent(newMessages) {
    let firstMessage = newMessages.messages[0];
    let folder = firstMessage.folder;
    // To save settings space, this can be the same as the options
    // although first getting the current value before doing an update is unwanted
    // so we should then load and keep track of the other folder options
    let folderMRMAttribute = common.getFolderMRMSettingsKey(folder);
    messenger.storage.local.set({[folderMRMAttribute]:common.encodeDate(common.getTimestamp())});
  }
  // add the MRM registrator
  messenger.messages.onMoved.addListener(
    // also fires on deletion on the Trash folder, which is good
    // also fires on archiving on the Archive folder, which is good
    async (originalMessages, movedMessages) => {
      actOnMessageEvent(movedMessages);
    }
  );
  messenger.messages.onCopied.addListener(
    async (originalMessages, copiedMessages) => {
      actOnMessageEvent(copiedMessages);
    }
  );
  //TODO act on folder events
}

function install() {
  console.debug("Initialization of Tidybird MRMFolders");
  // Get MRMFolders only first time the extension is run, afterwards we rely on our own implementation
  //  which also registers MRM for special folders and does not rely on an experiment
  // TODO add buttons to settings to
  // 1) reset MRMTime to none
  // 2) reset MRMTime to TB settings
  // 3) set more recent TB settings
  async function gotMRMFolders(mostRecentlyModifiedFolders) {
    messenger.tidybird_api.getMRMFolders.removeListener(gotMRMFolders);
    let foldersMRMSettings = {};
    for (let folder of mostRecentlyModifiedFolders) {
      if (folder.MRMTime > 0) {
        foldersMRMSettings[common.getFolderMRMSettingsKey(folder)] = common.encodeDate(Number(folder.MRMTime));
      }
    }
    messenger.storage.local.set(foldersMRMSettings);
  }
  messenger.tidybird_api.getMRMFolders.addListener(gotMRMFolders);

  run();
}

messenger.runtime.onStartup.addListener(run);
messenger.runtime.onInstalled.addListener(install);

/* vi: set tabstop=2 shiftwidth=2 softtabstop=2 expandtab: */
