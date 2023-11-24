import * as common from '../options/default_options.js';

// settings cache, kept up to date using updateSetting
let settingsCache;

/*
 * Themed TB support: apply theme colors
 */
async function setCssVariable(variablename,value) {
  document.documentElement.style.setProperty(variablename,value);
}
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
   * Buttons are transparent, --toolbarbutton-background is not defined
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
  // unread button colors, not available in any theme
  let tidybird_thread_pane_unread_stroke = await messenger.ex_customui.getInterfaceColor("--thread-pane-unread-stroke");
  setCssVariable("--tidybird-thread-pane-unread-stroke", tidybird_thread_pane_unread_stroke);
  let tidybird_thread_pane_unread_fill = await messenger.ex_customui.getInterfaceColor("--thread-pane-unread-fill");
  setCssVariable("--tidybird-thread-pane-unread-fill", tidybird_thread_pane_unread_fill);

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

/**
 * calculate new colorcomponent using premultiplied alpha colorcomponents
 **/
function calculate_colorcomponent(color_upper, color_under, alpha_upper) {
  return color_upper + color_under * (1 - alpha_upper);
}

/**
 * Update the tooltip color, if not yet done, because it may be transparent (from the theme) otherwise
 *  this fires when the theme changes or when the first button is added
 *  (before, we fired everytime a button was mouse entered)
 *  because this way, we are sure a button exists to take the _computed_ color from
 **/
let tooltipColorUpdated = false;
async function update_tooltipcolor(aButton) {
  if (tooltipColorUpdated) {
    // do not update if already done once after loading or theme change
    return;
  }

  // no button is given, we got fired because the theme has changed, get the first button with tooltip
  if (aButton === undefined) {
    aButton = document.querySelector("[tooltiptext]");
  }
  // no button was found not given, we should retry another time
  if (!aButton) {
    return;
  }
  tooltipColorUpdated = true; // set this here, so we don't do it twice at the same time; we assume nothing will go wrong

  // calculate the color of the button: https://en.wikipedia.org/wiki/Alpha_compositing
  let color = [0, 0, 0, 0];
  // this starts with the button and then runs over all its parents
  let buttonParent = aButton;
  do {
    let buttonParent_color = window
      .getComputedStyle(buttonParent)
      .getPropertyValue("background-color");
    console.log(`style computed background-color on ${buttonParent.tagName}: ${buttonParent_color}`);
    let color_under = [0, 0, 0, 0];
    if (buttonParent_color != "") {
      color_under = buttonParent_color
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
    console.log(`calculated color: ${color}`);
    buttonParent = buttonParent.parentElement;
  } while (buttonParent !== null && color[3] < 1);
  let tooltip_bgcolor = "rgba(" + color.join(", ") + ")";
  console.log(`result: ${tooltip_bgcolor}`);
  setCssVariable("--tidybird-tooltip-bgcolor", tooltip_bgcolor);
}

async function themeChangedListener(themeUpdateInfo) {
  await applyThemeColors(themeUpdateInfo.theme);
  tooltipColorUpdated = false;
  // theme colors should be fully applied before we can calculate the hover bg color
  update_tooltipcolor();
}
messenger.theme.onUpdated.addListener(themeChangedListener);
applyThemeColors();

/*
 * Set button size
 */
async function applyButtonSize(changedSizes) {
  if (changedSizes === undefined) {
    // initial load size
    let settings = await getSettings();
    changedSizes = {
      "buttonheight": settings["buttonheight"],
      "buttonmargin": settings["buttonmargin"],
    };
    // Default are set in css, no need to redo, but this does not cost much
    //  so we don't check and do this anyway
  }
  let height = changedSizes.buttonheight;
  let margin = changedSizes.buttonmargin;
  let stylesheetRules = document.styleSheets[0].rules;
  for (let rule of stylesheetRules) {
    if (rule.selectorText == ".tidybird-folder-move-button") {
      if (height !== undefined) {
        if (height == -1) {
          height = "auto";
        } else {
          height = `${height}px`;
        }
        rule.style.height = height;
      }
      if (margin !== undefined) {
        rule.style['margin-bottom'] = `${margin}px`;
      }
    }
  }
}
applyButtonSize();

/*
 * Keep track of the width
 *  must be run in this context: access to window
 */
function windowRemovedListener(anEvent) {
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
 * Read settings
 */
function updateSetting(setting, value) {
  if (value === undefined) {
    // if no value is given, take the default value (setting value has been removed)
    value = common.option_defaults[setting];
  }
  if (setting == "nbfolders") {
    value = Number(value); // convert to number
  }
  if (setting == "maxage") {
    value = Math.floor((Date.now() - value * 24 * 60 * 60 * 1000) / 1000); // convert to milliseconds since epoch
  }
  settingsCache[setting] = value;
  switch(true) {
    case setting == "startup":
      break;
    case setting.startsWith("button"):
      applyButtonSize({[setting]: value});
      break;
    case setting == "showoptionsbutton":
      if (value) {
        showOptionsButton();
      } else {
        hideOptionsButton();
      }
      break;
    case setting.startsWith("sortorder"):
      changeOrder(); //FIXME implement: change order without recreating nodes, also used when updating order on move when sorted by date
      break;
  }
}
async function getSettings() {
  // if cache is empty, update the cache
  if (settingsCache === undefined) {
    settingsCache = await messenger.storage.local.get(common.option_defaults);
    // recalculate these settings
    updateSetting("nbfolders",settingsCache.nbfolders);
    updateSetting("maxage",settingsCache.maxage);
  }
  return settingsCache;
}

/*
 * The move functionality
 */
function moveMessages(messageArray, folder, markAsRead) {
  // first mark as read, as messageIds are not retained after moving to another folder
  if (markAsRead) {
    for (const message of messageArray) {
      messenger.messages.update(message.id, { "read": true });
    }
  }
  browser.messages.move(
    messageArray.map((message) => message.id),
    folder
  );
}

const moveSelectedMessageToFolder = async function (expandedFolder, markAsRead) {
  let folder = await getFolderFromExpanded(expandedFolder); //moveMessages does not work on expandedFolder
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
    moveMessages(page.messages, folder, markAsRead);
    while (page.id) {
      page = await browser.messages.continueList(page.id);
      moveMessages(page.messages, folder, markAsRead);
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
    moveMessages(messages, folder, markAsRead);
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

const getRoot = async function(folderFullPath) {
  // ancestor example: [ "<accountname>", "INBOX", "a_folder_in_inbox" ]
  const ancestors = folderFullPath.split("/");
  // TODO make the "2" configurable (?)
  const rootIndex = ancestors.length > 3 ? 2 : ancestors.length - 2;
  // set a "fake" root folder with the account name if there is no folder ancestor
  if (ancestors.length > 2) {
    // The name is not always the same as the path(part)
    //  but we ignore this fact as getting the human readable name
    //  costs just too much TODO do test with many folders
    return ancestors[rootIndex];
  }
  return ancestors[0]; // return account name
}
/**
 * Return a folder object usable by the folder webextensions API
 * from the name used in the settings
 **/
const getFolderFromSetting = async function(folderSetting) {
  let folder = decodeURI(common.getFolderFromSettingsKey(folderSetting));
  let accountSplitIndex = folder.indexOf("/");
  return {
    accountId: folder.substring(0,accountSplitIndex), // for MailFolder "constructor"
    path: folder.substring(accountSplitIndex), // for MailFolder "constructor"
  };
}
const getFolderFromExpanded = async function(expandedFolder) {
  return {
    accountId: expandedFolder.accountId,
    path: expandedFolder.path,
  };
}
const isFolderInList = function (expandedFolder) {
  return foldersInList.includes(expandedFolder.fullPath);
};
const getFolderIndexInList = function (expandedFolder) {
  return foldersInList.indexOf(expandedFolder.fullPath);
};

let listParent = document.getElementById("tidybirdFolderButtonList");
let listAccountTitle = null;
const addAccount = async function (accountName,tmpParent) {
  let title;
  if (listAccountTitle == null) {
    title = document.createElement("h3");
    listAccountTitle = title;
  } else {
    title = listAccountTitle.cloneNode(true);
  }
  title.textContent = accountName;
  tmpParent.appendChild(title);
};

let buttonReadTemplate = null;
let buttonTemplate = null;
const addFolderButtons = async function (expandedFolder,buttonParent,options) {
  let path = expandedFolder.fullPath;

  if (isFolderInList(expandedFolder)) {
    console.log(
      `not adding ${expandedFolder.name}: already at ${getFolderIndexInList(
        expandedFolder
      )}`
    );
    return false;
  }

  console.log(`adding button for folder ${expandedFolder.name}`);

  let button;
  let label1;
  let newTemplate = false;
  if (buttonReadTemplate == null) {
    button = document.createElement("button");
    button.className = "tidybird-folder-move-button tidybird-button";

    label1 = document.createElement("div");
    label1.className = "tidybird-folder-move-button-label-1";
    label1.textContent = expandedFolder.name;
    button.appendChild(label1);

    // we can't use the svg as css content as context-fill and context-stroke
    // are only implemented in the main interface (both FF & TB)
    let response = await fetch(messenger.runtime.getURL("skin/unread-dot.svg"));
    let svg = await response.text();
    let parser = new DOMParser();
    let doc = parser.parseFromString(svg, "image/svg+xml");
    button.appendChild(doc.children[0]);
    // this is interpreted as unsafe, while above is not
    //button.insertAdjacentHTML("beforeend",svg);

    let label2 = document.createElement("div");
    label2.className = "tidybird-folder-move-button-label-2";
    label2.textContent = expandedFolder.rootName;
    button.appendChild(label2);

    button.setAttribute("tooltiptext", path);
    buttonReadTemplate = button;
  }


  console.log(expandedFolder.settings);
  let markAsReads = [];
  let isDoubleMarkAsRead = common.folder_hasSetting("markasread","double",expandedFolder.settings);
  if (isDoubleMarkAsRead || common.folder_hasSetting("markasread","no",expandedFolder.settings)) {
    markAsReads.push("no");
  }
  if (isDoubleMarkAsRead || common.folder_hasSetting("markasread","yes",expandedFolder.settings)) {
    markAsReads.push("yes");
  }
  for (const markAsRead of markAsReads) {
    if(markAsRead == "no") {
      // can't use label1 here
      if (buttonTemplate === null) {
        // use buttonTemplate, so we don't have to load and remove the svg on every clone
        buttonTemplate = buttonReadTemplate.cloneNode(true);
        buttonTemplate.firstElementChild.nextElementSibling.remove(); // remove the "read" circle
        button = buttonTemplate;
      } else {
        button = buttonTemplate.cloneNode(true);
      }
    } else {
      button = buttonReadTemplate.cloneNode(true);
    }
    if (!newTemplate) {
      // may be done twice, but probably less heavy than cloning and removing the svg for every button
      button.firstElementChild.textContent = expandedFolder.name;
      button.lastElementChild.textContent = expandedFolder.rootName;
    }

    button.addEventListener("click", function () {
      moveSelectedMessageToFolder(expandedFolder, markAsRead == "yes");
    });
    console.debug("Appending button to parent");
    buttonParent.appendChild(button);
    // the parent may not be part of the document, so we can't calculate the tooltip color yet
    console.debug("Appended button to parent");
  }
  foldersInList.push(path);
};

let optionsButton;
const addSettingsButton = async function(optionsButtonParent) {
  optionsButton = document.createElement("button");
  optionsButton.className = "tidybird-button hidden";
  optionsButton.textContent = "Options";
  optionsButton.addEventListener("click", function () {
    showOptionsPage();
  });
  optionsButtonParent.appendChild(optionsButton);
  update_tooltipcolor(optionsButton);
  let settings = await getSettings();
  if (settings.showoptionsbutton) {
    showOptionsButton();
  }
}
const showOptionsButton = async function() {
  optionsButton.classList.remove('hidden');
}
const hideOptionsButton = async function() {
  optionsButton.classList.add('hidden');
}
const showOptionsPage = async function() {
  browser.runtime.openOptionsPage();
}

const updateButtonList = async function () {
  console.debug("tidybird: updating button list");
  while (listParent.hasChildNodes()) {
    foldersInList.pop();
    listParent.firstChild.remove();
  }
  showButtons();
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
  //TODO: else if sorted by most recently used: move folder to the top
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
async function addOrderedFolderList(folderList, tmpParent) {
  if (folderList === undefined) {
    return;
  }
  for (let folder of folderList) {
    await addFolderButtons(folder,tmpParent); // this should be executed in order
  }
}
async function addFolderListPinned(folderList, tmpParent) {
  let settings = await getSettings();
  let order = settings.manualorder;
  let orderedList = [];
  for (let folderInternalName of order) {
    if (folderList[folderInternalName] !== undefined) {
      orderedList.push(folderList[folderInternalName]);
    }
  }
  await addOrderedFolderList(orderedList, tmpParent);
}
async function addFolderListAuto(folderList, tmpParent) {
  let settings = await getSettings();
  let collator = new Intl.Collator();
  if (settings.sortorder_initial == "namecasein") {
    // sort by name instead of moved-to-date
    folderList.sort(function (a, b) {
      return collator.compare(a.name,b.name);
    });
  }
  if (settings.sortorder_fullpath) {
    folderList.sort(function (a, b) {
      return collator.compare(a.fullpath,b.fullpath);
    });
  }
  if (settings.sortorder_parentname) {
    folderList.sort(function (a, b) {
      return collator.compare(a.parentName,b.parentName);
    });
  }
  await addOrderedFolderList(folderList, tmpParent);
}
async function addFolderList(folderList, tmpParent) {
  for (let listType in folderList) {
    if (listType === "pinned") {
      await addFolderListPinned(folderList[listType], tmpParent);
    } else {
      await addFolderListAuto(folderList[listType], tmpParent);
    }
  }
}
let recentFolders, alwaysFolders;
let recentFoldersSize; // so we don't have to get the length every time
let oldestTime;
let earliestBirth, nbFolders;
async function addFolderToAutoList(folderAttributeSetting, MRMTimeSetting, folderSettings) {
  let time = common.parseNumber(MRMTimeSetting);
  if (
    // time == 0 should not happen, this folder should not have an MRMTime in settings
    ( earliestBirth != -1 && time < earliestBirth )
    ||
    ( time <= oldestTime && recentFoldersSize >= nbFolders && nbFolders > -1 )
  ) {
    // no need to add this folder, it is older than the oldest and we already have enough
    return false;
  }
  // update oldestTime
  if (time < oldestTime) {
    oldestTime = time;
  }
  recentFolders.push({ folderAttributeSetting, time, folderSettings }); // do not expand yet (costly operation and we may throw away this folder)
  recentFoldersSize++;
}
/**
 * Add the folder given in the settings to the appropriate list
 * This is done for, in worst case, all folders
 *  so it should do as less as possible
 *  and filter out as much folders as possible
 **/
async function addFolderToList(folderAttributeSetting, folderSettings, allSettings) {
  if (common.folder_doAlwaysShow(folderSettings)) {
    alwaysFolders.push({folderAttributeSetting, folderSettings}); //without MRM, we will add it when/if needed
  } else if(common.folder_doAutoShow(folderSettings)) {
    const folderMRMAttribute = "M"+common.getFolderFromSettingsKey(folderAttributeSetting);
    const MRMTimeSetting = allSettings[folderMRMAttribute];
    if (MRMTimeSetting !== undefined) {
      addFolderToAutoList(folderAttributeSetting, MRMTimeSetting, folderSettings);
    } // no auto show, folder never used to move to
  } //else: never show, do nothing
}
async function addToGroupedList(folder, settings) {
  let listType = "auto";
  if (common.folder_isPinned(folder.folderSettings)) {
    listType = "pinned";
  }
  let expandedFolder = await getFolderFromSetting(folder.folderAttributeSetting);
  expandedFolder.time = folder.time; // for rearranging when moved to if sorted on MRMTime
  // We assume here (and in getRoot) the folder names are also path members
  //  as otherwise it would cost too much to get the folder object
  //  to get the folder name and the folder parent name
  //  TODO check this statement when testing a LOT of folders
  let path = expandedFolder.path;
  let splittedPath = path.split("/");
  expandedFolder.name = splittedPath[splittedPath.length-1];
  expandedFolder.parentName = splittedPath[splittedPath.length-2];
  let accountId = expandedFolder.accountId;
  let account = accountList[accountId];
  if (account == undefined) {
    account = await messenger.accounts.get(accountId);
    accountList[accountId] = account;
  }
  if (settings.groupby_account) {
    expandedFolder.accountName = account.name; // to show if grouped by account
  }
  let fullPath = account.name + path;
  expandedFolder.rootName = await getRoot(fullPath);
  expandedFolder.fullPath = fullPath;
  expandedFolder.internalPath = accountId + path;
  expandedFolder.settings = folder.folderSettings;
  // Add the folder according to the settings, so we can sort if needed
  let accountSortValue;
  if (settings.groupby_account || settings.sortorder_accountname) {
    accountSortValue = accountId;
    if (settings.sortorder_accountname) {
      accountSortValue = account.name;
    }
  } else {
    accountSortValue = "folderList";
  }
  if (groupedFolderList[accountSortValue] === undefined) {
    groupedFolderList[accountSortValue] = {
      "pinned": [],
      "auto": [],
    };
  }
  if (listType == "pinned") {
    groupedFolderList[accountSortValue][listType][expandedFolder.internalPath] = expandedFolder;
  } else {
    groupedFolderList[accountSortValue][listType].push(expandedFolder);
  }
}
/**
 * Get the most recently changed folders
 **/
let othersParent = document.getElementById("otherButtonList");
//let start = true;
let accountList, groupedFolderList;
async function showButtons() {
  //TODO: keep settings synchronized, so we don't have to get them here
  //FIXME: these are old cached settings, so statement above must be done!
  let settings = await getSettings();
  earliestBirth = settings.maxage;
  nbFolders = settings.nbfolders;

  recentFolders = [];
  alwaysFolders = [];
  recentFoldersSize = 0;
  oldestTime = common.getTimestamp(); // initialize, so we don't have to check for undefined every loop

  // First get folders, then loop over accounts, so we can honour nb of days and max nb of folders
  //TODO: button to purge old MRMs (for performance)
  // based on own implementation of getMostRecentFolders, probably more efficient in cpu (not in memory)
  let allSettings = await messenger.storage.local.get(); // get ALL SET settings
  let defaultSettings = allSettings.Fdefault;
  if (common.folder_doAlwaysShow(defaultSettings)) {
    // Run over ALL folders while checking if they have specific settings
    // least efficient, but may be desired to always show new folders
    //FIXME filter on folder.canFileMessages is not done as we do not have that info (also needed in settings), it is available in the newest >115 TB release (yippie)
  } else if (common.folder_doNeverShow(defaultSettings)) {
    // Run only over folders that have settings
    // most efficient, run only over folders with specific settings
    for (let setting in allSettings) {
      if (setting.startsWith("F")) {
        addFolderToList(setting, allSettings[setting], allSettings);
      }
    }
  } else { // folder_doAutoShow(defaultSettings))
    // First run over folders that have settings
    // Then run over folder that have timestamps
    for (const setting in allSettings) {
      if (setting.startsWith("F")) {
        // minority should be handled here
        // these are always handled first
        addFolderToList(setting, allSettings[setting], allSettings);
      } else if (setting.startsWith("M")) {
        //TODO only if there is still space, set total nb of folders, not auto
        //TODO show number of auto folders where we select total nb of folders
        let folderAttributeSetting = "F"+common.getFolderFromSettingsKey(setting);
        if (allSettings[folderAttributeSetting] === undefined) {
          addFolderToAutoList(setting, allSettings[setting], allSettings.Fdefault);
        } //else: already handled above
      }
    }
  }

  //TODO and no settings and/or always folders
  if (recentFoldersSize == 0 && ( nbFolders == -1 || nbFolders > 0) ) {
    listParent.innerHTML = "<p>Buttons to move mails will appear (and this message will disappear) once you move a message to a folder that will also appear in Thunderbird's recent folders list.</p><p>You can also select the folders you want in the Options.<br/>Options can be opened using the \"Options\" button or using the Add-ons Manager</p>";
    return;
  }

  // now limit to the number we asked for
  //TODO if needed
  //TODO reorder while ordening later, if needed (if there are alwaysFolders that are not manually ordened)
  //TODO limit by folderselection setting
  if (nbFolders > 1 || settings.sortorder_initial == "mostrecent") {
    recentFolders.sort((a, b) => a.time < b.time);
    if (nbFolders > 0) {
      // at index <first argument>, delete <second argument> elements
      recentFolders.splice(nbFolders, recentFoldersSize - nbFolders);
    }
  }

  // - Expand folders with extra information: account, parent
  // - Group folders if needed
  accountList = {}; // reinitialize every time: account may be renamed TODO act on account rename, as we also may have to update the button list
  groupedFolderList = {};
  if (!(settings.groupby_account || settings.sortorder_accountname)) {
    for (let folderType in groupedFolderList) {
      groupedFolderList[folderType].folderList = [];
    }
  }
  // Should be done in order: may already be ordered
  for (let folder of alwaysFolders) {
    await addToGroupedList(folder, settings);
  }
  for (let folder of recentFolders) {
    await addToGroupedList(folder, settings);
  }

  let tmpListParent = document.createDocumentFragment();
  // sorted by account id, account name or just a single value, depending on the settings
  // FIXME CREATE LIST OF ACCOUNTS
  for ( let accountSortValue of Object.keys(groupedFolderList).sort() ) {
    if (settings.groupby_account) {
      let takeAccountFrom = groupedFolderList.auto;
      if (!groupedFolderList[accountSortValue] === undefined) {
        takeAccountFrom = groupedFolderList.pinned;
      }
      await addAccount(takeAccountFrom[accountSortValue][0].accountName,tmpListParent);
    }
    await addFolderList(groupedFolderList[accountSortValue],tmpListParent);
  }

  // folderlists should be added before the tmp parent is added to the real parent
  listParent.appendChild(tmpListParent);
  update_tooltipcolor();
}
showButtons();
addSettingsButton(othersParent);

/*
 * Support live changing settings
 */
async function settingsChangedListener(settingsUpdateInfo) {
  let changedSettings = Object.keys(settingsUpdateInfo).reduce((attrs, key) => ({...attrs, [key]: settingsUpdateInfo[key].newValue}), {});
  let needUpdateList = false;
  for (let setting in changedSettings) {
    needUpdateList = needUpdateList || updateSetting(setting, changedSettings[setting]);
  }
  if (needUpdateList) {
    updateButtonList();
  }
}
messenger.storage.local.onChanged.addListener(settingsChangedListener);

/* vi: set tabstop=2 shiftwidth=2 softtabstop=2 expandtab: */
