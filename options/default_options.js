export const option_defaults = {
  startup: "latest",
  buttonheight: -1,
  buttonmargin: 3,
  showoptionsbutton: true,
  sortorder_initial: "mostrecent",
  sortorder_fullpath: false,
  sortorder_parentname: false,
  sortorder_accountname: false,
  groupby_account: false,
  nbfolders: 30,
  folderselection: "mostrecent",
  maxage: 30,
  Fdefault: 0,
  width: 224,
  isShowing: true,
  manualorder: [],
};
export const folderSettingValues = {
  "show": {
    "bitindex": 1,
    "bitmask": 0b11,
    "values": {
      "auto": 0,
      "always": 1,
      "never": 2,
    },
  },
  "pin": {
    "bitindex": 0,
    "bitmask": 0b1,
  },
  "markasread": {
    "bitindex": 3,
    "bitmask": 0b11,
    "values": {
      "no": 0,
      "yes": 1,
      "double": 2,
    }
  }
};
export const calculateFolderSingleSettingValue = function(name, textvalue) {
  let value = 1; // if no "values" in the settingValues, then 1 (checkbox is checked)
  let settingValues = folderSettingValues[name];
  if (settingValues.values !== undefined) {
    value = settingValues.values[textvalue];
  }
  if (value > 0) {
    value = value << settingValues.bitindex
  }
  return value;
}
export const folder_hasSetting = function(settingName, valueName, folderSettingValue) {
  const settingConfiguration = folderSettingValues[settingName];
  const calculatedFolderSettingValue = calculateFolderSingleSettingValue(settingName,valueName);
  const maskedSetting = (folderSettingValue & (settingConfiguration.bitmask << settingConfiguration.bitindex));
  return maskedSetting === calculatedFolderSettingValue;
}
export const folder_doAutoShow = function(settings) {
  return folder_hasSetting("show","auto",settings);
}
export const folder_doAlwaysShow = function(settings) {
  return folder_hasSetting("show","always",settings);
}
export const folder_doNeverShow = function(settings) {
  return folder_hasSetting("show","never",settings);
}
export const folder_isPinned = function(settings) {
  return folder_hasSetting("pin",1,settings);
}
export const getFolderAttributename = function(folder) {
  return encodeURI(`${folder.accountId}${folder.path}`);
}
export const getFolderMRMDeleteKey = function(folder) {
  return "D" + getFolderAttributename(folder); // should come alphabetically before Folder setting
}
// also implemented in options.js
export const getFolderSettingsKey = function(folder) {
  return "F" + getFolderAttributename(folder); // should come alphabetically before MRM setting
};
// also implemented in options.js
export const getFolderMRMSettingsKey = function(folder) {
  return "M" + getFolderAttributename(folder);
};
export const getFolderFromSettingsKey = function(setting) {
  return setting.substring(1);
}
export const getSettingFromInput= function(input) {
  let varParts = input.name.split("_",1);
  return varParts[0];
}
/**
 * Calculate the timestamp like Thunderbird does
 **/
export const getTimestamp = function() {
  // Bitwise Or ) with ZERO converts value to integer by discarding any value after decimal point
  // https://stackoverflow.com/a/75235699
  return Date.now()/1000 | 0;
}
/**
 * Parse a number that was encoded for settings
 **/
export const parseNumber = function(string) {
  return parseInt(string,36);
}
/**
 * Encode an integer to put it in settings
 * as an integer is stored as a string, this takes less 
 **/
const encodeNumber = function(date) {
  return date.toString(36);
}
/**
 * Parse a date and return it in readable format
 **/
export const parseDate = function(encodedDate) {
  try {
    return new Intl.DateTimeFormat(undefined,{dateStyle:'short',timeStyle:'short'}).format(new Date(parseNumber(encodedDate)*1000));
  } catch (e) {
    console.log("Tidybird error in parseDate",e);
  }
  return null;
}
/**
 * Encode a unix timestamp to put it in settings
 **/
export const encodeDate = function(date) {
  // we encode the unix timestamp with base 36
  // this is more efficient as the integer is stored as an ascii string
  // the timestamp is reduced from 13 to 8 characters
  return encodeNumber(date);
}

/**
 * Execute callback on folder and its subfolders
 **/
const doOnFolders = async function(account, folder, callback) {
  // get subfolders before possibly changing something in the folder object
  //  adding attribute for examples breaks getting subfolders
  const subfolders = await messenger.folders.getSubFolders(folder,false);
  // FIXME from TB >115: filter on canFileMessages
  await callback(folder, account);
  //TODO check code of getting the subfolders directly
  for (let subfolder of subfolders) {
    await doOnFolders(account, subfolder, callback);
  }
}

/**
 * Execute callback function on all folders found
 **/
export const foreachAllFolders = async function(callback) {
  let accounts = await messenger.accounts.list(true);
  for (let account of accounts) {
    // FIXME from TB >115: filter on canFileMessages
    for (let folder of account.folders) {
      //TODO check code of getting the subfolders directly
      await doOnFolders(account, folder, callback);
    }
  }
}

let accountList, groupedFolderList;
export const resetLists = async function() {
  accountList = {}; // reinitialize every time: account may be renamed FIXME act on account rename, as we also may have to update the button list
  groupedFolderList = {}
}
export const getGroupedFolderList = async function() {
  return groupedFolderList;
}

/**
 * Return a folder object usable by the folder webextensions API
 * from the name used in the settings
 **/
export const getFolderFromSetting = async function(folderSetting) {
  let folder = decodeURI(getFolderFromSettingsKey(folderSetting));
  let accountSplitIndex = folder.indexOf("/");
  return {
    accountId: folder.substring(0,accountSplitIndex), // for MailFolder "constructor"
    path: folder.substring(accountSplitIndex), // for MailFolder "constructor"
  };
}
/**
 * Return the "root" folder to display
 **/
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
 * Add additional attributes to the folder
 **/
async function expandFolder(folder) {
  //FIXME create a copy (?)
  let expandedFolder = {
    accountId: folder.accountId, // minimal folder object
    path: folder.path, // minimal folder object
    time: folder.time, // for ordening and rearranging when moved to if sorted on MRMTime
  };
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
  expandedFolder.accountName = account.name; // to show if grouped by account
  let displayPath = account.name + path;
  expandedFolder.rootName = await getRoot(displayPath);
  expandedFolder.displayPath = displayPath;
  expandedFolder.internalPath = accountId + path;
  expandedFolder.settings = folder.folderSettings;
  return expandedFolder;
}

/**
 * First expand the folder and then add folder to a list grouped by:
 * 1) account (if needed)
 * 2) "pinned" and "auto" (sorted) folders
 *
 * Used settings: groupby_account & sortorder_accountname
 **/
export const addExpandedToGroupedList = async function(folder, settings) {
  let listType = "auto";
  if (folder_isPinned(folder.folderSettings)) {
    listType = "pinned";
  }
  let expandedFolder = await expandFolder(folder, accountList);
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

/*
 * Folder sorting
 */
let collator = new Intl.Collator();
async function getSortFunction(sortby) {
  switch(sortby) {
    case "mostrecent":
      return (a,b) => {
        return ( a.time === undefined && b.time !== undefined ) || a.time < b.time
      };
    case "namecasein":
      return(a,b) => collator.compare(a.name,b.name);
    case "reversenamecasein":
      return(a,b) => collator.compare(b.name,a.name);
    case "fullpath":
      return(a,b) => collator.compare(a.fullpath,b.fullpath);
    case "parentname":
      return(a,b) => collator.compare(a.parentName,b.parentName);
  }
  return null;
}
async function folderSort(folderlist, sortby) {
  folderlist.sort(await getSortFunction(sortby));
}
export const sortFoldersBySortorder = async function(folderList,settings,alreadySortedBy) {
  //FIXME do all ordening
  if (alreadySortedBy === true) {
    // already fully sorted, not doing anything
    return;
  }
  let changedOrder = false;
  if (settings.sortorder_initial !== "no" && settings.sortorder_initial !== alreadySortedBy) {
    await folderSort(folderList, settings.sortorder_initial);
    changedOrder = true;
  }
  if (settings.sortorder_fullpath && (changedOrder || alreadySortedBy != "fullpath")) {
    await folderSort(folderList, "fullpath");
    changedOrder = true;
  }
  if (settings.sortorder_parentname && (changedOrder || alreadySortedBy != "parentname")) {
    await folderSort(folderList, "parentname");
    changedOrder = true;
  }
}
