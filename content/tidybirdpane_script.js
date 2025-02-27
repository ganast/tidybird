import * as common from '../tidybird_common.js';

// settings cache, kept up to date using updateSetting
let settingsCache;
getSettings();

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

  // when using the system theme all css, there are no theme colors
  //  so we have to take colors from the interface
  let tidybird_backgroundcolor = await messenger.ex_customui.getInterfaceColor("--layout-background-1");
  // folderPane background: var(--sidebar-background) = var(--sidebar-background-color, var(--foldertree-background))
  // messagepanebox (messageHeader) background: var(--layout-background-1);
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
  //FIXME: broken since 128
  // unread button colors, not available in any theme
  let tidybird_thread_pane_unread_stroke = await messenger.ex_customui.getInterfaceColor("--thread-pane-unread-stroke");
  setCssVariable("--tidybird-thread-pane-unread-stroke", tidybird_thread_pane_unread_stroke);
  let tidybird_thread_pane_unread_fill = await messenger.ex_customui.getInterfaceColor("--thread-pane-unread-fill");
  setCssVariable("--tidybird-thread-pane-unread-fill", tidybird_thread_pane_unread_fill);

  // Themes are better defined now (except for system theme)
  // getInterfaceColor slightly broken on some themes/128, maybe comparable cause as issue we had to get flex rules
  //  but using it, results in a popup color (by getting a background color) & switching colors with system theme & better button colors for dark theme
  if(theme.colors/* && !tidybird_backgroundcolor*/) {
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
 *  this fires when the mouse hovers over the button
 *  if firing when the theme changes or when the first button is added, the info may seem correct, but is not in all cases
 *   for example when changing back to light from dark
 *   even when we are sure a button exists to take the computed color from
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
  tooltipColorUpdated = false;
  /*await */applyThemeColors(themeUpdateInfo.theme);
  // theme colors should be fully applied before we can calculate the hover bg color
  //update_tooltipcolor();
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
      "buttonheight": settings.buttonheight,
      "buttonmargin": settings.buttonmargin,
    };
    // Default are set in css, no need to redo, but this does not cost much
    //  so we don't check and do this anyway
  }
  let height = changedSizes.buttonheight;
  let margin = changedSizes.buttonmargin;
  let stylesheetRules = document.styleSheets[0].rules;
  for (let rule of stylesheetRules) {
    if (rule.selectorText == ".tidybird-folder-move-button" || rule.selectorText == ".tidybird-header") {
      if (height !== undefined && rule.style.height != "") {
        if (height == -1) {
          height = "auto";
        } else {
          height = `${height}px`;
        }
        rule.style.height = height;
      }
      if (margin !== undefined && rule.style['margin-bottom'] != "") {
        rule.style['margin-bottom'] = `${margin}px`;
      }
    }
  }
}
applyButtonSize();

/**
 * Keep track of the width
 *  must be run in this context: access to window
 **/
async function windowRemovedListener() {
  let innerWidth = window.innerWidth;
  if (innerWidth != 0) {
    // as the context is removed in TB78, the width is 0
    //  we don't save this so we don't reset the saved with (from shutdown) when button is clicked
    // this raises "Promise resolved after context unloaded", but it still works
    //  tried: sync/async and list of events see below
    await browser.storage.local.set({ width: innerWidth });
  }
}
/*
for(let eventname of ["beforeunload","suspend","pagehide","unload","cancel","abort","change","close","contextlost","emptied","ended","invalid","storage"]) {
  window.addEventListener(eventname, function() {
    // none of them print something, not even pagehide & unload ("load" does, so the code works)
    console.log(eventname);
  });
}
*/
// onbeforeunload does not work (at least not in TB78-132)
// onunload is executed after the context is removed in TB78 when button is clicked
window.addEventListener("pagehide", windowRemovedListener);
//window.addEventListener("unload", windowRemovedListener);

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
    if (value != -1) {
      value = Math.floor((Date.now() - value * 24 * 60 * 60 * 1000) / 1000); // convert to milliseconds since epoch
    }
  }
  settingsCache[setting] = value;
  switch(true) {
    case setting.startsWith("M"):
      // folder timestamp updated, we handle this with onMoved event
      //  this won't break when we change something to the settings
      return false;
    case setting == "startup":
      return false;
    case setting.startsWith("button"):
      applyButtonSize({[setting]: value});
      return false;
    case setting == "showoptionsbutton":
      if (value) {
        showOptionsButton();
      } else {
        hideOptionsButton();
      }
      return false;
    case setting.startsWith("sortorder"):
      return true;
      //changeOrder(); //FIXME implement: change order without recreating nodes, also used when updating order on move when sorted by date
      //and if cut off is sorted order, then remove also some buttons
  }
  return true;
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

let foldersInList = [];
const getFolderFromExpanded = async function(expandedFolder) {
  return {
    accountId: expandedFolder.accountId,
    path: expandedFolder.path,
  };
}
const isFolderInList = function (internalPath) {
  return foldersInList.includes(internalPath);
};
const getFolderIndexInList = function (internalPath) {
  return foldersInList.indexOf(internalPath);
};

let listParent = document.getElementById("tidybirdFolderButtonList");
let listAccountTitle = null;
const addAccount = async function (accountName,tmpParent) {
  let title;
  if (listAccountTitle == null) {
    title = document.createElement("div");
    title.className = "tidybird-header";
    listAccountTitle = title;
  } else {
    title = listAccountTitle.cloneNode(true);
  }
  title.textContent = accountName;
  tmpParent.appendChild(title);
};

let buttonReadTemplate = null;
let buttonTemplate = null;
const addFolderButtons = async function (expandedFolder,buttonParent) {
  if (isFolderInList(expandedFolder.internalPath)) {
    console.log(
      `not adding ${expandedFolder.name}: already at ${getFolderIndexInList(
        expandedFolder.internalPath
      )}`
    );
    return;
  }

  common.debug(`adding button for folder ${expandedFolder.name}`);

  let button;
  let label1;
  let newTemplate = false;
  if (buttonReadTemplate == null) {
    button = document.createElement("button");
    button.className = "tidybird-folder-move-button tidybird-layout-button tidybird-button";

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

    buttonReadTemplate = button;
  }

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
    button.setAttribute("data-folder", expandedFolder.internalPath);
    button.setAttribute("tooltiptext", expandedFolder.displayPath);

    button.addEventListener("click", function () {
      moveSelectedMessageToFolder(expandedFolder, markAsRead == "yes");
    });
    button.addEventListener("mouseenter", function (theEvent) {
      update_tooltipcolor(theEvent.target);
    });
    console.debug("Appending button to parent");
    buttonParent.appendChild(button);
    // the parent may not be part of the document, so we can't calculate the tooltip color yet
    console.debug("Appended button to parent");
  }
  foldersInList.push(expandedFolder.internalPath);
};

let optionsButton;
const addSettingsButton = async function(optionsButtonParent) {
  optionsButton = document.createElement("button");
  optionsButton.className = "tidybird-layout-button hidden tidybird-button";
  optionsButton.textContent = "Options";
  optionsButton.addEventListener("click", function () {
    showOptionsPage();
  });
  optionsButtonParent.appendChild(optionsButton);
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

let redrawalPaused = false;
let redrawalAsked = false;
const pauseRedrawal = function() {
  console.log("Redrawal paused");
  redrawalPaused = true;
}
const resumeRedrawal = function() {
  console.log("Redrawal resumed");
  redrawalPaused = false;
  if(redrawalAsked) {
    updateButtonList();
  }
}

const updateButtonList = async function () {
  redrawalAsked = true; // as soon as possible to avoid race conditions
  if(redrawalPaused) {
    return;
  }
  redrawalAsked = false;
  //FIXME do not recreate buttons
  console.debug("tidybird: updating button list");
  while (listParent.hasChildNodes()) {
    foldersInList.pop();
    //FIXME6 only remove and update automatic buttons (manual buttons: add them directly in correct place)
    listParent.firstChild.remove();
  }
  showButtons();
};

const updateButtonListIfNeeded = async function (folder, neededIfNotPresent) {
  const internalPath = common.getInternalPath(folder);
  const folderIsInList = isFolderInList(internalPath);
  if (
    (neededIfNotPresent && !folderIsInList) || // folder should be added
    (!neededIfNotPresent && folderIsInList) // folder should be removed
  ) {
    //TODO5.+ more efficient: just add button; if never: do nothing, ...
    updateButtonList();
  } else {
    // buttonlist already complete, but may need to be reordered
    const settings = await getSettings();
    // only need to reorder if list is ordered by most recently used date
    const sortOrder = await common.getFullSortorder(settings);
    if(sortOrder.includes("mostrecent")) {
      /*
      if(common.arrayEquals(sortOrder,["mostrecent"])) {
        //TODO5.+ too complex and too small use case for now, just update the list
        //TODO6? check if the folder is auto-ordered and put on top of correct list
        const folderButtons = document.querySelectorAll(`[data-folder='${internalPath}']`); // this should always return something
        const firstButton = listParent.firstElementChild; //FIXME may return account header if grouped by account!
        if(folderButtons[0] != firstButton) {
          // loop over buttons: mark as read and non mark as read
          //TODO6 order by button usage, not by folder usage, so these 2 buttons are not always together (events!)
          for(const folderButton in folderButtons) {
            listParent.insertBefore(folderButton,firstButton);
          }
        } //else: this is already the first button
      } else {
      }
      */
      updateButtonList();
    } //else: nothing needed
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
  if (alreadySorted !== true) {
    const sortorder = await common.getFullSortorder(settings,alreadySorted);
    await common.sortFoldersBySortorder(folderList,sortorder);
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
let firstFolder = undefined;
let earliestBirth;
/**
 * needsExpansion is given, as this is the same for all auto folders
 **/
async function addFolderToAutoList(folder,cutoffFunction,needsExpansion,nbFolders) {
  let time = folder.tidybird_time;
  if ( time < earliestBirth ) { // && earliestBirth != -1, but this is always true if condition is true
    return;
  }

  if (needsExpansion) {
    await common.expandFolder(await common.getFolderFromInfo(folder));
  }
  let folderComesBeforeCurrentFirst = true;
  if ( firstFolder !== undefined ) {
    const cutoffResult = cutoffFunction(folder,firstFolder);
    folderComesBeforeCurrentFirst = (cutoffResult === 1)
  } // else this is the first folder
  if (
    folderComesBeforeCurrentFirst
    && recentFoldersSize >= nbFolders && nbFolders > -1
  ) {
    // no need to add this folder, it is older than the oldest and we already have enough
    return;
  }
  // update oldestTime
  if (folderComesBeforeCurrentFirst) {
    firstFolder = folder;
  }
  recentFolders.push(folder); // do not expand yet (costly operation and we may throw away this folder)
  recentFoldersSize++;
}

async function addMRMandType(folderAttributeSetting) {
  //FIXME implement and use in addFolderToList
  mljqdf
}
/**
 * Add the folder given in the settings to the appropriate list
 * This is done for, in worst case, all folders
 *  so it should do as less as possible
 *  and filter out as much folders as possible
 **/
async function addFolderToList(folderAttributeSetting, folderSettings, allSettings, showneverused, cutoffFunction, needsExpansion, nbFolders) {
  if (common.folder_doAlwaysShow(folderSettings)) {
    //FIXME if has normal MRMtime or (special type MRMtime and showspecials) or showneverused
    //FIXME also change it this way in the per folder settings if the global settings are like this
    if(showneverused || true) {
      alwaysFolders.push(common.getTidybirdFolder(folderAttributeSetting, undefined, folderSettings)); //without MRM, we will add it when/if needed
    }
  } else if(common.folder_doAutoShow(folderSettings)) {
    // always get MRM for these, as either they will be expanded or MRM is needed
    const folderMRMAttribute = "M"+common.getFolderFromSettingsKey(folderAttributeSetting);
    const MRMTimeSetting = allSettings[folderMRMAttribute];
    if (MRMTimeSetting !== undefined || showneverused) {
      await addFolderToAutoList(
        common.getTidybirdFolder(folderAttributeSetting, MRMTimeSetting, folderSettings),
        cutoffFunction,
        needsExpansion,
        nbFolders,
      );
    } // else: no auto show, folder never used to move to and we don't want to show it
  } //else: never show, do nothing
}

/**
 * Get the most recently changed folders
 **/
const othersParent = document.getElementById("otherButtonList");
const buttonList = document.getElementById('tidybirdMessage');
let alreadySorted;
//let start = true;
async function showButtons() {
  let settings = await getSettings();
  earliestBirth = common.encodeNumber(settings.maxage);
  let nbFolders = settings.nbfolders;

  recentFolders = [];
  alwaysFolders = [];
  recentFoldersSize = 0;

  common.resetLists();
  let cutoffby = settings.folderselection;
  let cutoffFunction;
  if ( cutoffby == "sortorder" ) {
    //TODO get sortorder and check if single attribute; if so, do normal cutoff
    cutoffFunction = (a,b) => 0; // cutoff can only be done in later stage
    cutoffby = await common.getFullSortorder(settings, false);
  } else {
    cutoffFunction = await common.getSortFunction(cutoffby);
    cutoffby = [cutoffby];
  }
  // If folders in auto list will already be expanded before creating the button
  let alreadyExpanded = common.isExpansionNeeded(cutoffby, false);

  // First get folders, then loop over accounts, so we can honour nb of days and max nb of folders
  //TODO: button to purge old MRMs (for performance)
  // based on own implementation of getMostRecentFolders, probably more efficient in cpu (not in memory)
  // also handle delete queue of MRM manager here as we run over all settings in most cases
  let allSettings = await messenger.storage.local.get(); // get ALL SET settings
  let defaultSettings = allSettings.Fdefault;
  if (common.folder_doAlwaysShow(defaultSettings) || settings.showneverused) {
    console.log("Tidybird using least efficient method, you may experience slowliness and you may want to change settings");
    //TODO6 change with neverused if default alwaysshow follow neverused, if per folder also show those that are never used
    //TODO6 test for alwaysshow
    // least efficient, but may be desired to always show new folders
    await common.foreachAllFolders(async (folder,account) => {
      let setting = await common.getFolderSettingsKey(folder);
      let folderSettings = allSettings[setting];
      if (folderSettings === undefined) {
        folderSettings = defaultSettings;
      }
      addFolderToList(setting, folderSettings, allSettings, settings.showneverused, cutoffFunction, alreadyExpanded, nbFolders);
    });
  } else if (common.folder_doNeverShow(defaultSettings)) {
    //TODO6 test for nevershow
    // Run only over folders that have settings
    // most efficient, run only over folders with specific settings
    for (let setting in allSettings) {
      if (setting.startsWith("F")) {
        addFolderToList(setting, allSettings[setting], allSettings, settings.showneverused, cutoffFunction, alreadyExpanded, nbFolders);
      }
    }
  } else { // folder_doAutoShow(defaultSettings))
    // First run over folders that have settings
    // Then run over folders that have timestamps
    for (const setting in allSettings) {
      if (setting.startsWith("F")) {
        // minority should be handled here
        // these are always handled first
        addFolderToList(setting, allSettings[setting], allSettings, settings.showneverused, cutoffFunction, alreadyExpanded, nbFolders);
      } else if (setting.startsWith("M")) {
        //TODO6 only if there is still space
        //TODO6 set total nb of folders, not just total nb of automatically shown folders
        //TODO6 show number of auto folders where we select total nb of folders
        let folderAttributeSetting = "F"+common.getFolderFromSettingsKey(setting);
        if (allSettings[folderAttributeSetting] === undefined) {
          let folder = common.getTidybirdFolder(folderAttributeSetting, allSettings[setting], allSettings.Fdefault);
          // this folder is autoshow and is used, so we don't have to check setting nor showneverused
          // also, for showneverused, the do_alwaysShow case is used
          await addFolderToAutoList(folder, cutoffFunction, alreadyExpanded, nbFolders);
        } //else: already handled by running over the folder settings first
      }
    }
  }

  //TODO and only if no settings and/or always folders
  if (recentFoldersSize == 0 && ( nbFolders == -1 || nbFolders > 0) ) {
    buttonList.classList.remove('hidden');
    return;
  }
  buttonList.classList.add("hidden");

  // now limit to the number we asked for
  alreadySorted = false;
  if (nbFolders >= 0 && recentFoldersSize > nbFolders) {
    let sortby = settings.folderselection;
    let sortorder = [];
    if (sortby == "sortorder") {
      sortorder = await common.getFullSortorder(settings,false);
      alreadySorted = true;
    } else {
      sortorder = [ sortby ];
      alreadySorted = sortby;
    }
    // expand if needed for cutoff: is already done as we check the cutoff when adding folders
    //alreadyExpanded = await expandRecentFoldersIfNeeded(sortorder, alreadyExpanded);
    // sort for cutoff
    await common.sortFoldersBySortorder(recentFolders,sortorder);
    // cutoff: at index <first argument>, delete <second argument> elements
    recentFolders.splice(nbFolders, recentFoldersSize - nbFolders);
  } // else no cutoff needed

  // - Group folders if needed
  // Should be done in order: may already be ordered
  for (let folderInfo of alwaysFolders) {
    const folder = await common.getFolderFromInfo(folderInfo);
    const expandedFolder = await common.expandFolder(folder);
    await common.addToGroupedList(expandedFolder, settings);
  }
  for (let folderInfo of recentFolders) {
    let expandedFolder;
    if (!alreadyExpanded) {
      const folder = await common.getFolderFromInfo(folderInfo);
      expandedFolder = await common.expandFolder(folder);
    } else {
      expandedFolder = folderInfo;
    }
    await common.addToGroupedList(expandedFolder, settings);
  }

  let tmpListParent = document.createDocumentFragment();
  // sorted by account id, account name or just a single value, depending on the settings
  // FIXME6 CREATE LIST OF ACCOUNTS to loop over (for special cases where it may be necessary)
  const groupedFolderList = await common.getGroupedFolderList();
  for ( let accountSortValue of Object.keys(groupedFolderList).sort() ) {
    if (settings.groupby_account) {
      let takeAccountFrom = groupedFolderList[accountSortValue].auto;
      if (!takeAccountFrom.length) {
        takeAccountFrom = groupedFolderList[accountSortValue].pinned;
      }
      await addAccount(takeAccountFrom[0].accountName,tmpListParent);
    }
    await addFolderList(groupedFolderList[accountSortValue],tmpListParent);
  }

  // folderlists should be added before the tmp parent is added to the real parent
  listParent.appendChild(tmpListParent);

  //update_tooltipcolor(); // we do this when we are sure the button is added and the whole document and css is loaded => on hover
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
    common.debug("Updating list by setting change");
    updateButtonList();
  } //else: no update needed
}
messenger.storage.local.onChanged.addListener(settingsChangedListener);

/*
 * Do not change button list while it is "in use"
 */
document.addEventListener("DOMContentLoaded", domReady);
function domReady() {
  const buttonList = document.getElementById('tidybirdFolderButtonList');
  buttonList.addEventListener("pointerleave", function () {
    resumeRedrawal();
  });
  buttonList.addEventListener("pointerenter", function () {
    pauseRedrawal();
  });
}


/* vi: set tabstop=2 shiftwidth=2 softtabstop=2 expandtab: */
