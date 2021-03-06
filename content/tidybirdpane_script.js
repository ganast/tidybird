const moveSelectedMessageToFolder = async function (folder) {
  /*
  A message can be displayed in either a 3-pane tab, a tab of its own, or in a window of its own. All
  are referenced by tabId in this API. Display windows are considered to have exactly one tab,
  which has limited functionality compared to tabs from the main window.
  */
  // hopefully getCurrent always returns the window where we clicked
  const currentWindow = await browser.windows.getCurrent({
    populate: true,
    windowTypes: ["messageDisplay"],
  });

  /* find the current tab, there should only be 1, I guess */
  let theCurrentTab = null;
  for (let tab of currentWindow.tabs) {
    if (tab.highlighted) {
      theCurrentTab = tab;
      break;
    }
  }

  const messages = await browser.messageDisplay.getDisplayedMessages(
    theCurrentTab.id
  );
  /*
  for (let message of messages) {
    console.log(`Moving message ${message.subject} to ${folder.name}`);
  }
  */
  browser.messages.move(
    messages.map((message) => message.id),
    folder
  );
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
    button.title = expandedFolder.fullPath; //FIXME tooltiptext

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

//browser.ex_customui.setLocalOptions({ width: "1000px" });
