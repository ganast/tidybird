let messenger = browser; // to prevent errors in linting...

(async () => {
  // the first parameter of this function gets tab information when using the button
  function toggleTidybirdBySettings(startupEvent = false) {
    let htmlPage = "content/tidybirdpane.html";

    async function removeCustomuiWhenDone(changes, area) {
      if (area == "local" && changes.width) {
        messenger.ex_customui.remove(
          messenger.ex_customui.LOCATION_MESSAGING,
          htmlPage
        );
        messenger.storage.onChanged.removeListener(removeCustomuiWhenDone);
      }
    }

    // default parameter only used at first startup
    function toggleTidybird(settings) {
      // if a setting is not set, it will be 'undefined'
      let isShowing = settings.isShowing ?? true;
      let width = settings.width;
      if (
        // startupEvent can also be an event
        (startupEvent === true && isShowing) ||
        (startupEvent !== true && !isShowing)
      ) {
        messenger.ex_customui.add(
          messenger.ex_customui.LOCATION_MESSAGING,
          htmlPage,
          { width } // this is an "object shorthand" = { "width": width }
        );
        messenger.storage.local.set({ ["isShowing"]: true });
      } else {
        // instead of closing immediatly, we listen for a width change in the settings
        // listening on the settings, throws an error in the logs, probably because of
        //  https://bugzilla.mozilla.org/show_bug.cgi?id=1633315
        // this is not caused by the remove we do hereafter
        if (!messenger.storage.onChanged.hasListener(removeCustomuiWhenDone)) {
          messenger.storage.onChanged.addListener(removeCustomuiWhenDone);
        }
        messenger.storage.local.set({ ["isShowing"]: false });
      }
    }

    function onError(error) {
      console.error(`Error in tidybird getting settings: ${error}`);
    }

    let gettingSetting = messenger.storage.local.get(["isShowing", "width"]);
    gettingSetting.then(toggleTidybird, onError);
  }

  // initial startup (or not)
  toggleTidybirdBySettings(true);

  // add listener to our button
  messenger.browserAction.onClicked.addListener(toggleTidybirdBySettings);
})();

/* vi: set tabstop=2 shiftwidth=2 softtabstop=2 expandtab: */
