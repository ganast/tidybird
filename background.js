import option_defaults from '../options/default_options.js';
(async () => {
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
      startup: option_defaults.startup,
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
})();

/* vi: set tabstop=2 shiftwidth=2 softtabstop=2 expandtab: */
