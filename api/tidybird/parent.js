// Import some things we need.
var { ExtensionCommon } = ChromeUtils.import(
  "resource://gre/modules/ExtensionCommon.jsm"
);

// get MRMFolders
var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);

// var tidybird_api is used by TB: defined in manifest.json
// eslint-disable-next-line no-unused-vars
var tidybird_api = class extends ExtensionCommon.ExtensionAPI {
  onShutdown(isAppShutdown) {
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

    this.addCallback = function (callback, listenerEvent) {
      if (listenerEvent !== "GetMRMFolder") {
        return; // not implemented
      }
      let allFolders = MailServices.accounts.allFolders;
      let folderArray = [];
      for (let folder of allFolders) {
        let folderObject = context.extension.folderManager.convert(folder);
        folderObject.MRMTime = folder.getStringProperty("MRMTime");
        folderArray.push(folderObject);
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

