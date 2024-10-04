/*
 * messenger is not yet known in TB 68 and make (firefox) linter happy
 */
let messenger = browser;

async function setCssVariable(variablename,value) {
  document.documentElement.style.setProperty(variablename,value);
}
/*
 * Themed TB support: apply theme colors
 */
async function applyThemeColors(theme) {
  if (theme === undefined) {
    theme = await messenger.theme.getCurrent();
  }

  // when using the system theme all css properties are ok only if the system theme is light
  // so we do always our thing, this makes it also more predictable
  // ...we don't change colors when system theme changes, but probably this is not possible

  let tidybird_backgroundcolor = await messenger.ex_customui.getInterfaceColor("--layout-background-1");
  setCssVariable("--tidybird-backgroundcolor", tidybird_backgroundcolor);
  let tidybird_textcolor = await messenger.ex_customui.getInterfaceColor("--layout-color-1");
  setCssVariable("--tidybird-textcolor", tidybird_textcolor);
  let tidybird_button_bordercolor = await messenger.ex_customui.getInterfaceColor("--toolbarbutton-header-bordercolor");
  setCssVariable("--tidybird-button-bordercolor", tidybird_button_bordercolor);
  /*
   * Buttons are transparent
  let tidybird_button_bgcolor = await messenger.ex_customui.getInterfaceColor("--toolbarbutton-background");
  setCssVariable("--tidybird-button-bgcolor", tidybird_button_bgcolor);
  */
  let tidybird_button_hover_bgcolor = await messenger.ex_customui.getInterfaceColor("--toolbarbutton-hover-background");
  setCssVariable("--tidybird-button-hover-bgcolor", tidybird_button_hover_bgcolor);
  let tidybird_button_active_bgcolor = await messenger.ex_customui.getInterfaceColor("--toolbarbutton-active-background");
  setCssVariable("--tidybird-button-active-bgcolor", tidybird_button_active_bgcolor);
  let tidybird_button_hover_bordercolor = await messenger.ex_customui.getInterfaceColor("--toolbarbutton-active-bordercolor"); // the active is not a mistake, that is really the used variable in Thunderbird
  setCssVariable("--tidybird-button-hover-bordercolor", tidybird_button_hover_bordercolor);
  let tidybird_button_active_bordercolor = await messenger.ex_customui.getInterfaceColor("--toolbarbutton-header-bordercolor");
  setCssVariable("--tidybird-button-active-bordercolor", tidybird_button_active_bordercolor);

  if(theme.colors && !tidybird_backgroundcolor) { // this will never happen, but we keep this as failsafe
                                                  // or when above is broken
    if(theme.colors.sidebar) {
      // sidebar background color is used in message header
      setCssVariable("--tidybird-backgroundcolor", theme.colors.sidebar);
    } else if(theme.colors.toolbar) {
      // not sure why this is different
      setCssVariable("--tidybird-backgroundcolor", theme.colors.toolbar);
    }
    if(theme.colors.toolbar_field_text) {
      // this is used in the message header (instead of sidebar_text)
      setCssVariable("--tidybird-textcolor", theme.colors.toolbar_field_text);
    }

    // bordercolor used in message header is just white/black with some transparency
    // it also changes on active...
    let bordercolor = theme.colors.input_border;
    if (bordercolor) {
      setCssVariable("--tidybird-button-header-bordercolor", bordercolor);
    }

    // missing or bad in doc: https://webextension-api.thunderbird.net/en/latest/theme.html#themetype
    if (theme.colors.button) {
      setCssVariable("--tidybird-button-bgcolor", theme.colors.button);
    }

    let hovercolor = theme.colors.button_hover;
    if (!hovercolor) {
      hovercolor = theme.colors.button_background_hover;
    }
    if (hovercolor) {
      setCssVariable("--tidybird-button-hover-bgcolor", hovercolor);
    }

    let activecolor = theme.colors.button_active;
    if (!activecolor) {
      activecolor = theme.colors.button_background_active;
    }
    if (activecolor) {
      setCssVariable("--tidybird-button-active-bgcolor", activecolor);
    }
  }
  tooltipColorUpdated = false;
}

let tooltipColorUpdated = false;
/**
 * calculate new colorcomponent using premultiplied alpha colorcomponents
 **/
function calculate_colorcomponent(color_upper, color_under, alpha_upper) {
  return color_upper + color_under * (1 - alpha_upper);
}

/**
 * Update the tooltip color, if not yet done, because it may be transparent (from the theme) otherwise
 *  this fires when the mouse hovers over the button
 *  because this way, we are sure a button exists to take the _computed_ color from
 **/
async function update_tooltipcolor(theEvent) {
  if (tooltipColorUpdated) {
    // do not update if already done once after loading or theme change
    return;
  }
  let body = document.querySelector("body");
  let target = theEvent.target;
  // calculate the color of the button: https://en.wikipedia.org/wiki/Alpha_compositing
  let color = [0, 0, 0, 0];
  do {
    // theEvent.target or document.querySelector("[tooltiptext]")
    let target_color = window
      .getComputedStyle(target)
      .getPropertyValue("background-color");
    console.log(`${target.tagName}: ${target_color}`);
    let color_under = [0, 0, 0, 0];
    if (target_color != "") {
      color_under = target_color
        .replace(/.*\((.*)\)/, "$1")
        .split(", ")
        .map((x) => parseFloat(x));
    }
    if (color_under.length == 3) {
      color_under.push(1); // rgb color without alpha layer
    }
    let alpha = calculate_colorcomponent(color[3], color_under[3], color[3]);
    // if alpha == 0; then the color is fully transparent and the values make no difference
    if (alpha != 0) {
      for (let i = 0; i < color.length - 1; i++) {
        color[i] =
          calculate_colorcomponent(
            color[i] * color[3],
            color_under[i] * color_under[3],
            color[3]
          ) / alpha;
      }
    }
    color[3] = alpha;
    console.log(`color: ${color}`);
    target = target.parentElement;
  } while (target !== null && color[3] < 1);
  let tooltip_bgcolor = "rgba(" + color.join(", ") + ")";
  console.log(`result: ${tooltip_bgcolor}`);
  body.style.setProperty("--tidybird-tooltip-bgcolor", tooltip_bgcolor);
  tooltipColorUpdated = true;
}

async function themeChangedListener(themeUpdateInfo) {
  applyThemeColors(themeUpdateInfo.theme);
}
messenger.theme.onUpdated.addListener(themeChangedListener);
applyThemeColors();

/**
 * Keep track of the width
 *  must be run in this context: access to window
 **/
async function windowRemovedListener() {
  let innerWidth = window.innerWidth;
  if (innerWidth != 0) {
    // as the context is removed in TB78, the width is 0
    //  we don't save this so we don't reset the saved with (from shutdown) when button is clicked
    browser.storage.local.set({ width: innerWidth });
  }
}
// onbeforeunload does not work (at least not in TB78)
// onunload is executed after the context is removed in TB78 when button is clicked
window.addEventListener("unload", windowRemovedListener);

/*
 * The move functionality
 */

function moveMessages(messageArray, folder) {
  browser.messages.move(
    messageArray.map((message) => message.id),
    folder
  );
}

const moveSelectedMessageToFolder = async function (folder) {
  /*
  A message can be displayed in either a 3-pane tab, a tab of its own, or in a window of its own. All
  are referenced by tabId in this API. Display windows are considered to have exactly one tab,
  which has limited functionality compared to tabs from the main window.
  */
  // hopefully getCurrent always returns the window where we clicked
  // tabs.getCurrent does return undefined
  const currentWindow = await browser.windows.getCurrent();
  //windowTypes: ["messageDisplay"], // windowtypes is ignored in getCurrent

  /* find the current tab, there should only be 1, I guess */
  let [theCurrentTab] = await browser.tabs.query({
    active: true,
    windowId: currentWindow.id,
  });
  if (!theCurrentTab) {
    return;
  }

  let messages = [];
  if (theCurrentTab.mailTab) {
    // Use selected messages if this tab is a mailTab (tab with a list of messages)
    /*
     * this defaults to the current tab, but throws an error if the current tab is not a mailTab
     *  so we first detect the type
     */
    let page = await browser.mailTabs.getSelectedMessages();
    moveMessages(page.messages, folder);
    while (page.id) {
      page = await browser.messages.continueList(page.id);
      moveMessages(page.messages, folder);
    }
  } else {
    // Use displayed messages if this tab is not a mailTab (we get a result if the tab is showing a message)
    /*
     * we don't use getDisplayedMessages as I don't know a way to display multiple images in a tab
     *  without having them selected in the same tab
     * this method is preferred as getDisplayedMessages is only supported from 78.4.0
     */
    messages = [
      await browser.messageDisplay.getDisplayedMessage(theCurrentTab.id),
    ];
    if (messages[0] === null) {
      // in that tab, there are no at this very moment(!) displayed messages found
      return;
    }
    moveMessages(messages, folder);
  }
};

/**
 * Get the MailFolder object defined by the account and the path (splitted in an array)
 **/
const getFolder = function (account, pathArray) {
  let subFolders = account.folders;
  let constructedPath = "";
  let nextFolder = null;
  for (let pathPart of pathArray) {
    constructedPath = `${constructedPath}/${pathPart}`;
    nextFolder = subFolders.find(function (obj) {
      return obj.path === constructedPath;
    });
    subFolders = nextFolder.subFolders;
  }
  return nextFolder;
};

let foldersInList = [];

const getExpandedFolder = async function (folder) {
  let expandedFolder = { ...folder };
  expandedFolder.account = await browser.accounts.get(folder.accountId);
  expandedFolder.fullPath = expandedFolder.account.name + expandedFolder.path;
  return expandedFolder;
};
const isFolderInList = function (expandedFolder) {
  return foldersInList.includes(expandedFolder.fullPath);
};
const getFolderIndexInList = function (expandedFolder) {
  return foldersInList.indexOf(expandedFolder.fullPath);
};

const addButton = async function (folder) {
  let expandedFolder = await getExpandedFolder(folder);
  let path = expandedFolder.fullPath;
  let account = expandedFolder.account;

  if (!isFolderInList(expandedFolder)) {
    console.log(`adding button for folder ${expandedFolder.name}`);

    // ancestor example: [ "<accountname>", "INBOX", "a_folder_in_inbox" ]
    const ancestors = path.split("/");
    // TODO make the "2" configurable (?)
    const rootIndex = ancestors.length > 3 ? 2 : ancestors.length - 2;
    // set a "fake" root folder with the account name if there is no folder ancestor
    let root = { name: ancestors[0] };
    if (ancestors.length > 2) {
      // The name is not always the same as the path(part)
      root = getFolder(account, ancestors.slice(1, rootIndex + 1));
    }

    const button = document.createElement("button");
    button.className = "tidybird-folder-move-button";

    let label1 = document.createElement("div");
    label1.className = "tidybird-folder-move-button-label-1";
    label1.textContent = expandedFolder.name;
    button.appendChild(label1);

    let label2 = document.createElement("div");
    label2.className = "tidybird-folder-move-button-label-2";
    label2.textContent = root.name;
    button.appendChild(label2);

    button.setAttribute("tooltiptext", path);

    button.addEventListener("click", function () {
      moveSelectedMessageToFolder(folder);
    });
    button.addEventListener("mouseenter", function (theEvent) {
      update_tooltipcolor(theEvent);
    });

    document.querySelector("#tidybirdButtonList").appendChild(button);

    foldersInList.push(path);
  } else {
    console.log(
      `not adding ${expandedFolder.name}: already at ${getFolderIndexInList(
        expandedFolder
      )}`
    );
  }
};

const updateButtonList = async function () {
  console.debug("tidybird: updating button list");
  var buttonList = document.getElementById("tidybirdButtonList");
  if (buttonList == null) {
    console.warn(
      "No tidybird buttonlist found, while it should have been created."
    );
    return;
  }
  while (buttonList.hasChildNodes()) {
    foldersInList.pop();
    buttonList.firstChild.remove();
  }
  browser.tidybird_api.getMRMFolders.addListener(gotMRMFolders, 30);
};

const updateButtonListIfNeeded = async function (folder, neededIfNotPresent) {
  if (folder.type == "archives") {
    // As there is already an "Archive"-button
    // and this folder is set as the Archive-folder
    // we don't add it in our list.
    // (MRMTime does not change using the Archive button)
    return;
  }
  const expandedFolder = await getExpandedFolder(folder);
  const folderIsInList = isFolderInList(expandedFolder);
  if (
    (neededIfNotPresent && !folderIsInList) || // folder should be added
    (!neededIfNotPresent && folderIsInList) // folder should be removed
  ) {
    updateButtonList();
  }
};

/**
 * React on events on messages and folders
 **/
async function onMessageEvent(originalMessages, newMessages, eventName) {
  let firstMessage = newMessages.messages[0];
  console.log(
    `tidybird: message ${eventName} event to ${firstMessage.folder.name}`
  );
  // Event (copying/moving) is always done from 1 folder to 1 other folder, so it's enough to read the folder of the first message in the list
  updateButtonListIfNeeded(firstMessage.folder, true);
}
messenger.messages.onMoved.addListener(
  async (originalMessages, movedMessages) => {
    onMessageEvent(originalMessages, movedMessages, "onMoved");
  }
);
messenger.messages.onCopied.addListener(
  async (originalMessages, copiedMessages) => {
    onMessageEvent(originalMessages, copiedMessages, "onCopied");
  }
);

async function onFolderEvent(originalFolder, newFolder, eventName) {
  console.log(
    `tidybird: folder ${eventName} event: on "[${originalFolder.path}] ${originalFolder.name} (${originalFolder.accountId}})"`
  );
  updateButtonListIfNeeded(originalFolder, false);
}
// Rename also fires delete. For now we don't use the event information, so we can just act on delete
//messenger.folders.onRenamed.addListener(async (originalFolder, renamedFolder) => {
//  onFolderEvent(originalFolder, renamedFolder, "onRenamed");
//});
messenger.folders.onMoved.addListener(async (originalFolder, movedFolder) => {
  onFolderEvent(originalFolder, movedFolder, "onMoved");
});
messenger.folders.onDeleted.addListener(async (deletedFolder) => {
  onFolderEvent(deletedFolder, null, "onDeleted");
});

/**
 * Get the most recently changed folders
 **/
async function gotMRMFolders(mostRecentlyModifiedFolders) {
  for (let folder of mostRecentlyModifiedFolders) {
    addButton(folder);
  }
  browser.tidybird_api.getMRMFolders.removeListener(gotMRMFolders, 30);
}
// do with events, as direct return raises an exception
browser.tidybird_api.getMRMFolders.addListener(gotMRMFolders, 30);
//TODO: idea: keep our own list of MRM folders, so we can include or exclude any folder. Before of subfolders of removed/renamed folders (with MRM they are no longer in the list)

/* vi: set tabstop=2 shiftwidth=2 softtabstop=2 expandtab: */
