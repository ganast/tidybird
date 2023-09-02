// Import some things we need.
var { ExtensionCommon } = ChromeUtils.import(
  "resource://gre/modules/ExtensionCommon.jsm"
);

// get MRMFolders
var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);

var { FolderUtils } = ChromeUtils.import("resource:///modules/FolderUtils.jsm");

// var tidybird_api is used by TB: defined in manifest.json
// eslint-disable-next-line no-unused-vars
var tidybird_api = class extends ExtensionCommon.ExtensionAPI {
  onShutdown(isAppShutdown) {
    console.debug("Tidybird shutdown");
    if (isAppShutdown) {
      return; // the application gets unloaded anyway
    }

    // Unload JSMs of this add-on
    const rootURI = this.extension.rootURI.spec;
    for (let module of Cu.loadedModules) {
      if (module.startsWith(rootURI)) {
        Cu.unload(module);
      }
    }

    // Clear caches that could prevent upgrades from working properly
    // https://developer.thunderbird.net/add-ons/mailextensions/experiments
    Services.obs.notifyObservers(null, "startupcache-invalidate");
  }

  getAPI(context) {
    let self = this;

    this.addCallback = function (callback, listenerEvent, nbFolders, earliestBirth) {
      if (listenerEvent !== "GetMRMFolder") {
        return; // not implemented
      }
      /*
       * Trash (del) & Archives (a) don't get a MRMTime
       * Drafts & Sent do
       * TODO -very later- let user choose to show them in list (per account)
       */
      let allFolders = MailServices.accounts.allFolders;
      let filteredFolders = allFolders.filter(
        (folder) => folder.canFileMessages
      );

      // own implementation of getMostRecentFolders, probably more efficient in cpu (not in memory)
      let recentFolders = [];
      let oldestTime;
      for (let folder of filteredFolders) {
        let time = Number(folder.getStringProperty("MRMTime")) || 0;
        if (
          time == 0 // folder has no MRMTime (like Drafts, or never moved to)
          ||
          ( earliestBirth !== undefined && earliestBirth != -1 && time < earliestBirth )
          ||
          ( oldestTime !== undefined && time <= oldestTime && recentFolders.length >= nbFolders && nbFolders > 0 )
        ){
          // no need to add this folder, it is older than the oldest and we already have enough
          continue;
        }
        // update oldestTime
        if (time < oldestTime || oldestTime === undefined) {
          oldestTime = time;
        }
        recentFolders.push({ folder, time });
      }
      // now limit to the number we asked for
      if (nbFolders > 0) {
        recentFolders.sort((a, b) => a.time < b.time);
        // at index <first argument>, delete <second argument> elements
        recentFolders.splice(nbFolders, recentFolders.length-nbFolders);
      }
      let mostRecentlyModifiedFolders = recentFolders.map(f => f.folder);

      let folderArray = [];
      for (let folder of mostRecentlyModifiedFolders) {
        folderArray.push(context.extension.folderManager.convert(folder));
      }
      //return folderArray;
      callback(folderArray); //immediately call callback
    };

    this.removeCallback = function (callback, listenerEvent, ...args) {
      // do nothing
    };

    this.registerCallback = function (listenerEvent) {
      return function (fire, ...eventArgs) {
        function callback(...args) {
          fire.async(...args);
        }
        self.addCallback(callback, listenerEvent, ...eventArgs);
        return function () {
          return self.removeCallback(callback, listenerEvent, ...eventArgs);
        };
      };
    };

    //context.callOnClose(this);
    return {
      tidybird_api: {
        getMRMFolders: new ExtensionCommon.EventManager({
          context,
          register: self.registerCallback("GetMRMFolder"),
        }).api(),
      },
    };
  }
};

/*
 * TODO -later- When ready, check this again: https://developer.thunderbird.net/add-ons/mailextensions/experiments
 */
