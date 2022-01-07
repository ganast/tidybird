// messenger is not yet known in TB 68
let messenger = browser;

(async () => {
  // the first parameter of this function gets tab information when using the button
  function toggleTidybirdBySettings(startupEvent = false) {
    let htmlPage = "content/tidybirdpane.html";
    let isShowingSetting = "isShowing";

    function toggleTidybird(isShowing = false) {
      //TODO: latest status
      if (startupEvent === true || !isShowing) {
        messenger.ex_customui.add(
          messenger.ex_customui.LOCATION_MESSAGING,
          htmlPage,
          {}
        );
        messenger.storage.local.set({ [isShowingSetting]: true });
      } else {
        messenger.ex_customui.remove(
          messenger.ex_customui.LOCATION_MESSAGING,
          htmlPage
        );
        messenger.storage.local.set({ [isShowingSetting]: false });
      }
    }

    function onGet(settings) {
      toggleTidybird(settings[isShowingSetting]); // if not set => undefined => default parameter value
    }

    function onError(error) {
      console.log(
        `Error in tidybird getting setting ${isShowingSetting}: ${error}`
      );
    }

    let gettingSetting = messenger.storage.local.get(isShowingSetting);
    gettingSetting.then(onGet, onError);
  }

  // initial startup (or not)
  toggleTidybirdBySettings(true);

  // add listener to our button
  messenger.browserAction.onClicked.addListener(toggleTidybirdBySettings);
})();

/* vi: set tabstop=2 shiftwidth=2 softtabstop=2 expandtab: */
