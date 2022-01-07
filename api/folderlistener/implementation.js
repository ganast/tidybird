// Import some things we need.
var { ExtensionCommon } = ChromeUtils.import(
  "resource://gre/modules/ExtensionCommon.jsm"
);

// folderlistener
var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);

// eslint-disable-next-line no-unused-vars
var folderListener = class extends ExtensionCommon.ExtensionAPI {
  onShutdown(isAppShutdown) {
    // otherwise the listener keeps on listening
    // should be called before stop windowslistener
    try {
      if (!isAppShutdown) {
        this.stopFolderListener();
      }
    } catch (error) {
      console.info("Error during unloading folderlistener");
    }
  }

  getAPI(context) {
    let self = this;

    // https://searchfox.org/comm-central/source/mailnews/base/public/nsIFolderListener.idl
    this.folderListener = {
      /**
       * @param nsIMsgFolder parentItem
       * @param nsISupports item
       **/
      OnItemAdded(parentItem, item) {
        self.callCallback.onTreeEvent(parentItem, item, "ItemAdded");
      },
      /**
       * @param nsIMsgFolder parentItem
       * @param nsISupports item
       **/
      OnItemRemoved(parentItem, item) {
        self.callCallback.onTreeEvent(parentItem, item, "ItemRemoved");
      },

      OnItemPropertyChanged(item, property, oldValue, newValue) {
        self.callCallback.onItemPropertyChanged(
          item,
          property,
          oldValue,
          newValue
        );
      },

      OnItemIntPropertyChanged(item, property, oldValue, newValue) {
        self.callCallback.onItemPropertyChanged(
          item,
          property,
          oldValue,
          newValue
        );
      },

      OnItemBoolPropertyChanged(item, property, oldValue, newValue) {
        self.callCallback.onItemPropertyChanged(
          item,
          property,
          oldValue,
          newValue
        );
      },

      OnItemUnicharPropertyChanged(item, property, oldValue, newValue) {
        self.callCallback.onItemPropertyChanged(
          item,
          property,
          oldValue,
          newValue
        );
      },

      OnItemPropertyFlagChanged(item, property, oldFlag, newFlag) {
        self.callCallback.onItemPropertyFlagChanged(
          item,
          property,
          oldFlag,
          newFlag
        );
      },
      /**
       * @param nsIMsgFolder item
       * @param nsIAtom event
       **/
      OnItemEvent(item, event) {
        self.callCallback.onItemEvent(item, event);
      },
    };

    this.callbacks = {
      onTreeEvent: new Set(),
      onItemPropertyChanged: new Set(),
      onItemPropertyFlagChanged: new Set(),
      onItemEvent: {},
    };

    this.callCallback = {};
    this.callCallback.onTreeEvent = function (parentItem, item, eventName) {
      const mailExtParentItem = context.extension.folderManager.convert(
        parentItem
      );
      let mailExtItem = null;
      try {
        item = item.QueryInterface(Ci.nsIMsgDBHdr);
        console.debug(
          `FolderListener: tree event ${eventName} on "${item.subject}" in ${parentItem.name}`
        );
        mailExtItem = context.extension.messageManager.convert(item);
      } catch (e) {
        if (e.name === "NS_NOINTERFACE") {
          try {
            item = item.QueryInterface(Ci.nsIMsgFolder);
            console.debug(
              `FolderListener: tree event ${eventName} on "${item.name}" in ${parentItem.name}`
            );
            mailExtItem = context.extension.folderManager.convert(item);
          } catch (e) {
            if (e.name === "NS_NOINTERFACE") {
              console.error(
                "This item type for tree event is not yet supported"
              );
            } else {
              throw e;
            }
          }
        } else {
          throw e;
        }
      }
      self.callCallback.generic(
        "onTreeEvent",
        eventName,
        mailExtParentItem,
        mailExtItem
      );
    };
    this.callCallback.onItemPropertyChanged = function (
      item,
      property,
      oldValue,
      newValue
    ) {
      console.debug(
        `FolderListener: property ${property} of ${item.name} changed from ${oldValue} to ${newValue}`
      );
      for (let callback of self.callbacks.onItemPropertyChanged) {
        callback(item, property, oldValue, newValue);
      }
    };
    this.callCallback.onItemPropertyFlagChanged = function (
      item,
      property,
      oldValue,
      newValue
    ) {
      console.debug(
        `FolderListener: property flag of ${property} of ${item.messageKey} changed from ${oldValue} to ${newValue}`
      );
      for (let callback of self.callbacks.onItemPropertyFlagChanged) {
        callback(item, property, oldValue, newValue);
      }
    };

    this.callCallback.onItemEvent = function (folder, eventName) {
      console.debug(`FolderListener: event ${eventName} on ${folder.name}`);
      const mailExtFolder = context.extension.folderManager.convert(folder);
      self.callCallback.generic("onItemEvent", eventName, mailExtFolder);
    };

    this.anyItemEventName = "<all>";
    this.callCallback.generic = function (eventType, eventName, ...args) {
      const events = [eventName, self.anyItemEventName];
      for (let eventToCallback of events) {
        if (self.callbacks[eventType][eventToCallback]) {
          for (let callback of self.callbacks[eventType][eventToCallback]) {
            callback(...args, eventName);
          }
        }
      }
    };

    /**
     * if no eventName is given with onItemEvent: add callback on any itemEvent
     **/
    this.addCallback = function (callback, listenerEvent, eventName) {
      let callbackList = self.callbacks[listenerEvent];
      if (!eventName) {
        eventName = self.anyItemEventName; // internal way to store callbacks on any event
      }
      if (!callbackList[eventName]) {
        callbackList[eventName] = new Set();
      }
      callbackList = callbackList[eventName];
      callbackList.add(callback);
    };

    /**
     * if no eventName is given with onItemEvent: remove all callbacks for onItemEvent
     **/
    this.removeCallback = function (callback, listenerEvent, eventName) {
      let callbackList = self.callbacks[listenerEvent];
      if (eventName && callbackList[eventName]) {
        callbackList = callbackList[eventName];
      }
      callbackList.delete(callback);
    };

    this.registerCallback = function (listenerEvent) {
      return function (fire, ...eventArgs) {
        function callback(...args) {
          fire.async(...args);
        }
        self.addCallback(callback, listenerEvent, ...eventArgs);
        return function () {
          self.removeCallback(callback, listenerEvent, ...eventArgs);
        };
      };
    };

    // not only in api to be able to call on this object from stop event
    this.stopFolderListener = function () {
      MailServices.mailSession.RemoveFolderListener(self.folderListener);
    };

    this.startFolderListener = function () {
      // all = 0xFFFFFFFF
      // removed = 0x2
      // event = 0x80
      // let notifyFlags = Ci.nsIFolderListener.removed | Ci.nsIFolderListener.event;
      let notifyFlags = Ci.nsIFolderListener.all;
      MailServices.mailSession.AddFolderListener(
        self.folderListener,
        notifyFlags
      );
    };

    //context.callOnClose(this);
    return {
      folderListener: {
        //TODO: notifyFlags in API
        startFolderListener() {
          self.startFolderListener();
        },
        stopFolderListener() {
          self.stopFolderListener();
        },
        onTreeEvent: new ExtensionCommon.EventManager({
          context,
          register: self.registerCallback("onTreeEvent"),
        }).api(),
        //TODO other events
        onItemEvent: new ExtensionCommon.EventManager({
          context,
          register: self.registerCallback("onItemEvent"),
        }).api(),
      },
    };
  }
};
