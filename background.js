let messenger = browser; // to prevent errors in linting...

(async () => {
  // the first parameter of this function gets tab information when using the button
  function toggleTidybirdBySettings(startupEvent = false) {
    let htmlPage = "content/tidybirdpane.html";

    // default parameter only used at first startup
    function toggleTidybird(settings) {
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
        messenger.storage.local.set({ ["isShowing"]: false });
        messenger.ex_customui.remove(
          messenger.ex_customui.LOCATION_MESSAGING,
          htmlPage
        );
      }
    }

    function onGet(settings) {
      toggleTidybird(settings); // if not set => undefined => default parameter value
    }

    function onError(error) {
      console.log(`Error in tidybird getting settings: ${error}`);
    }

    let gettingSetting = messenger.storage.local.get(["isShowing", "width"]);
    gettingSetting.then(onGet, onError);
  }

  // initial startup (or not)
  toggleTidybirdBySettings(true);

  // add listener to our button
  messenger.browserAction.onClicked.addListener(toggleTidybirdBySettings);
})();

/* vi: set tabstop=2 shiftwidth=2 softtabstop=2 expandtab: */
