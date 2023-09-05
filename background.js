(async () => {
  // the first parameter of this function gets tab information when using the button
  function toggleTidybirdBySettings(startupEvent = false) {
    let htmlPage = "content/tidybirdpane.html";

    // default parameter only used at first startup
    async function toggleTidybird(settings) {
      let isShowing = settings.isShowing;
      let width = settings.width;

      let showOnStartup = false;
      if(startupEvent === true) { // startupEvent can also be an event
        let startupSetting = await messenger.storage.sync.get({
          startup: "latest", //TODO only 1 place to define defaults
        });
        if (startupSetting.startup == "shown") {
          showOnStartup = true;
        } else if (startupSetting.startup == "hidden") {
          showOnStartup = false;
        } else {
          showOnStartup = isShowing;
        }
      }
      if ( showOnStartup || (startupEvent !== true && !isShowing) ) {
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

    function onError(error) {
      console.error(`Error in tidybird getting settings: ${error}`);
    }

    let gettingSetting = messenger.storage.local.get({
      isShowing: true,
      width: undefined
    });
    gettingSetting.then(toggleTidybird, onError);
  }

  // initial startup (or not)
  toggleTidybirdBySettings(true);

  // add listener to our button
  messenger.browserAction.onClicked.addListener(toggleTidybirdBySettings);
})();

/* vi: set tabstop=2 shiftwidth=2 softtabstop=2 expandtab: */
