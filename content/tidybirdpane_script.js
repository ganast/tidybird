/*
 * messenger is not yet known in TB 68 and make (firefox) linter happy
 */
let messenger = browser;

/*
 * Themed TB support: apply theme colors
 */
async function applyThemeColors(theme) {
  let body = document.querySelector("body");
  if (theme === undefined) {
    theme = await messenger.theme.getCurrent();
  }

  // this is null when using the "system" theme
  if (theme.colors !== null) {
    body.classList.add("themed");

    body.style.setProperty("--toolbar-bgcolor", theme.colors.toolbar);
    body.style.setProperty("--lwt-text-color", theme.colors.toolbar_field_text);

    let bordercolor = theme.colors.input_border;
    if (bordercolor === undefined) {
      // 78.14.0 light & dark
      bordercolor = theme.colors.toolbar_field_border;
    }
    body.style.setProperty("--toolbarbutton-header-bordercolor", bordercolor);

    // missing or bad in doc: https://webextension-api.thunderbird.net/en/latest/theme.html#themetype
    body.style.setProperty("--button-bgcolor", theme.colors.button);

    let hovercolor = theme.colors.button_hover;
    if (hovercolor === undefined) {
      // 78.14.0 light & dark
      hovercolor = theme.colors.toolbar_field_border;
    }
    body.style.setProperty("--button-hover-bgcolor", hovercolor);

    body.style.setProperty(
      "--button-active-bgcolor",
      theme.colors.button_active
    );
  } else {
    body.classList.remove("themed");
  }
  body.style.setProperty("--toolbarbutton-border-radius", "3px");
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
 *  this fires when the mouse hover over the button
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
    console.log(`${theEvent.target.style.backgroundColor} - ${target_color}`);
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
  body.style.setProperty("--tooltip-bgcolor", tooltip_bgcolor);
  tooltipColorUpdated = true;
}

async function themeChangedListener(themeUpdateInfo) {
  applyThemeColors(themeUpdateInfo.theme);
}
messenger.theme.onUpdated.addListener(themeChangedListener);
applyThemeColors();

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
  const expandedFolder = await getExpandedFolder(folder);
  const folderIsInList = isFolderInList(expandedFolder);
  if (
    (neededIfNotPresent && !folderIsInList) || // folder shoulde be added
    (!neededIfNotPresent && folderIsInList) // folder should be removed
  ) {
    updateButtonList();
  }
};

console.log("Adding api folder listener");
// add folder listener
browser.folderListener.startFolderListener();

browser.folderListener.onItemEvent.addListener(async (folder, eventName) => {
  console.log(`tidybird: item event: ${eventName} on ${folder.name}`);
  updateButtonListIfNeeded(folder, true);
}, "MRMTimeChanged");
/*
 * RenameCompleted is called with original name and new name, also ItemRemoved and ItemAdded TreeEvents are fired
 *  maybe we can combine the 4 events to reconstruct what happened
 */

browser.folderListener.onTreeEvent.addListener(async (parentItem, item) => {
  if (item.hasOwnProperty("path")) {
    // probably a folder
    console.log(
      `tidybird: item removed from tree event: folder "[${item.path}] ${item.name} (${item.accountId}})" in ${parentItem.name}`
    );
    updateButtonListIfNeeded(item, false);
  } else {
    // probably a message
    const dateString = item.date.toLocaleDateString();
    const timeString = item.date.toLocaleTimeString();
    console.log(
      `tidybird: item removed from tree event: message "[${item.id}] ${item.subject} (${dateString} ${timeString})" in ${parentItem.name}`
    );
  }
}, "ItemRemoved");

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
