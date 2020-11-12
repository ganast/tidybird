// based on https://github.com/thundernest/addon-developer-support/wiki/WindowListener-API:-Getting-Started

(async () => {
    function showTidybird() {
        // runs in extensions private context => no access to the window
        messenger.tidybird_api.toggleWindowListener();
    }
    messenger.browserAction.onClicked.addListener(showTidybird);

    // initialize the window listener
    messenger.tidybird_api.startWindowListener();

    //TODO -later- separate the windowListener & folderListener API and join them in a separate layer (here,content,...)
})()
