// Import some things we need.
var { ExtensionCommon } = ChromeUtils.import(
  "resource://gre/modules/ExtensionCommon.jsm"
);

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

// get MRMFolders
var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);

var FolderUtils;
try {
  FolderUtils = ChromeUtils.import(
    "resource:///modules/FolderUtils.jsm"
  ).FolderUtils;
} catch (e) {
  // TB <= 96
  FolderUtils = ChromeUtils.import("resource:///modules/folderUtils.jsm");
}

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
      let filteredFolders;
      if (Array.isArray(allFolders)) {
        // TB >=78
        filteredFolders = allFolders.filter((folder) => folder.canFileMessages);
      } else {
        // TB 68
        filteredFolders = [];
        let enumerator = allFolders.enumerate();
        let folder;
        while (enumerator.hasMoreElements()) {
          folder = enumerator.getNext(Ci.nsIMsgFolder);
          if (folder.canFileMessages) {
            filteredFolders.push(folder);
          }
        }
      }
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
      callback(folderArray); //immediatly call callback
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
