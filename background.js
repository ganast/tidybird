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

  /////////////////
  // MRM manager //
  /////////////////
  /**
   * debug log for MRM manager
   **/
  async function logEvent(eventname, ...toLog) {
    //TODO add check if debug: expert settings for MRM debug & Tidybird debug
    console.debug("[Tidybird MRM] "+eventname,...toLog)
  }
  /**
   * Store a value in the settings
   **/
  async function getAttribute(key) {
    return messenger.storage.local.get(key);
  }
  async function setAttribute(key, value) {
    messenger.storage.local.set({[key]: value});
  }
  async function deleteAttribute(key) {
    messenger.storage.local.remove(key);
  }
  /**
   * Schedule for deletion on next startup
   * Folder is not immediately removed from MRM as this may be part of a rename
   * Disadvantage: this is not a transparent process, this has to be taken into account
   *  while showing buttons: existing MRM times may belong to folders queued for deletion
    //FIXME take this queue into account while running over MRM times
   **/
  async function addToDeleteQueue(folder) {
    let folderMRMDeleteAttribute = common.getFolderMRMDeleteKey(folder);
    setAttribute(folderMRMDeleteAttribute,true);
  }
  // delete the MRM times of the queued folders and empty the queue
  logEvent("emptying deletion queue")
  for (let settingsKey in await getAttribute()) {
    if (settingsKey.startsWith("D")) {
      deleteAttribute(settingsKey);
      deleteAttribute("F" + common.getFolderFromSettingsKey(settingsKey));
      logEvent("removed from queue and deleted MRM time for: "+settingsKey);
    }
  }
  //FIXME cleanup registered MRM times for folders that no longer exist (remove with other client)
  /**
   * Remove folder from delete queue
   *  It may have been recreated
   **/
  async function removeFromDeleteQueue(folder) {
    let folderMRMDeleteAttribute = common.getFolderMRMDeleteKey(folder);
    deleteAttribute(folderMRMDeleteAttribute);
  }

  ////////////////////
  // Message events //
  ////////////////////
  async function actOnMessageEvent(newMessages) {
    let firstMessage = newMessages.messages[0];
    let folder = firstMessage.folder; // move and copy always to 1 folder
    // To save settings space, this can be the same as the options
    // although first getting the current value before doing an update is unwanted
    //  we should then load and keep track of the other folder options to make changes atomiccy
    let folderMRMAttribute = common.getFolderMRMSettingsKey(folder);
    setAttribute(folderMRMAttribute, common.encodeDate(common.getTimestamp()));
  }
  messenger.messages.onMoved.addListener(
    // also fires on deletion on the Trash folder, which is good (onDeleted is for permanent delete)
    // also fires on archiving on the Archive folder, which is good
    async (originalMessages, movedMessages) => {
      logEvent("messages moved");
      actOnMessageEvent(movedMessages);
    }
  );
  messenger.messages.onCopied.addListener(
    async (originalMessages, copiedMessages) => {
      logEvent("messages copied");
      actOnMessageEvent(copiedMessages);
    }
  );

  ///////////////////
  // Folder events //
  // TODO check if it also acts this way on POP: only 1 move for parent folders; delete for parent & sub folders
  ///////////////////
  async function actOnFolderMove(originalFolder, newFolder) {
    // Would the newFolder have been removed before and added to the queue to delete, remove it from the queue
    // The previous MRM time will be overwritten
    removeFromDeleteQueue(newFolder);
    // move MRM time to the new folder setting
    let oldAttributeName = common.getFolderMRMSettingsKey(originalFolder);
    let originalMRMTime = (await getAttribute(oldAttributeName)).oldAttributeName;
    if (originalMRMTime !== undefined) {
      setAttribute(common.getFolderMRMSettingsKey(newFolder), originalMRMTime);
      deleteAttribute(oldAttributeName); // now we can remove the old folder setting
      removeFromDeleteQueue(originalFolder); // and even remove it from the delete queue, if it was already added
    }

    // also do above actions for the subfolders
    let newSubFolders = newFolder.subFolders;
    if (!newSubFolders) {
      newSubFolders = await messenger.folders.getSubFolders(newFolder,true);
    }
    for (let newSubFolder of newSubFolders) {
      // we don't have access to originalFolder's subfolders here
      let originalSubFolder = null;
      if (newSubFolder.path.startsWith(newFolder.path)) {
        // known case: parent folder path is part of subfolder path
        originalSubFolder = {
          "accountId": originalFolder.accountId,
          "path": originalFolder.path + newSubFolder.path.substring(newFolder.path.length),
          // we don't know the name
        };
      } else {
        console.error("Tidybird MRM error: don't know how to handle subfolders while moving", newFolder, newSubFolder);
      }
      actOnFolderMove(originalSubFolder, newSubFolder);
    }
  }
  messenger.folders.onCopied.addListener(
    //TODO test on other IMAP&POP: check for / file bug: copy to does simply not work for me, it moves
    async (originalFolder, newFolder) => {
      logEvent("folder copied", originalFolder, newFolder);
      // copy has not been used to move to, so don't copy MRM date
      // ...although it may be seen otherwise...
      removeFromDeleteQueue(newFolder);
    }
  );
  messenger.folders.onCreated.addListener(
    // in contrary to onDeleted, this luckily does not fire on folder moving
    async (newFolder) => {
      logEvent("folder created", newFolder);
      removeFromDeleteQueue(newFolder);
    }
  );
  messenger.folders.onDeleted.addListener(
    // also fires on folder and subfolders while moving a folder, which is unfortunate
    async (deletedFolder) => {
      logEvent("folder deleted", deletedFolder);
      addToDeleteQueue(deletedFolder);
    }
  );
  messenger.folders.onMoved.addListener(
    async (originalFolder, newFolder) => {
      // does not fire, fires onRenamed instead, does not matter, result is the same, can be deprecated
      logEvent("folder moved", originalFolder, newFolder);
      actOnFolderMove(originalFolder, newFolder);
    }
  );
  messenger.folders.onRenamed.addListener(
    // does not fire on subfolders
    async (originalFolder, newFolder) => {
      logEvent("folder renamed", originalFolder, newFolder);
      actOnFolderMove(originalFolder, newFolder);
    }
  );
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
