// Import some things we need.
var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);

// get MRMFolders
var { MailServices } = ChromeUtils.importESModule(
  "resource:///modules/MailServices.sys.mjs"
);

var { FolderUtils } = ChromeUtils.importESModule("resource:///modules/FolderUtils.sys.mjs");

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

    this.addCallback = function (callback, listenerEvent, nbFolders) {
      if (listenerEvent !== "GetMRMFolder") {
        return; // not implemented
      }
      /*
       * Trash (del) & Archives (a) don't get a MRMTime
       * Drafts & Sent do
       * TODO -very later- let user choose to show them in list (per account)
       * TODO -later- while we are at it: let user choose the number of folders to display
       */
      let allFolders = MailServices.accounts.allFolders;
      let filteredFolders = allFolders.filter(
        (folder) => folder.canFileMessages
      );
      let mostRecentlyModifiedFolders = FolderUtils.getMostRecentFolders(
        filteredFolders,
        nbFolders,
        "MRMTime"
      );
      mostRecentlyModifiedFolders.sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
      let folderArray = [];
      for (let folder of mostRecentlyModifiedFolders) {
        folderArray.push(context.extension.folderManager.convert(folder));
      }
      //return folderArray;
      callback(folderArray); //immediately call callback
    };

    this.removeCallback = function () {
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
