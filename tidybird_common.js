export const option_defaults = {
  startup: "latest",
  buttonheight: -1,
  buttonmargin: 3,
  showoptionsbutton: true,
  isShowing: true,
  width: 224,

  sortorder_initial: "namecasein",
  sortorder_parentname: false,
  sortorder_accountname: false,
  groupby_account: false,

  nbfolders: 30,
  folderselection: "mostrecent",
  maxage: 30,
  showneverused: false,
  folderstoshow_default: true,

  Fdefault: 0,
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
/**
 * Get a setting's value at the correct index
 * @param {string} settingName Name of the setting
 * @param {number} settingValue Number value of the setting
 * @returns  {number} setting's value at the correct index
 */
export const getSettingIndexedValue = function(settingName, settingValue) {
  return settingValue << folderSettingValues[settingName].bitindex;
}
/**
 * Get a setting's bitmask at the correct index: full set of 1s at the right place
 * @param {string} settingName Name of the setting to verify
 * @returns  {number} setting's bitmask at correct index
 */
export const getSettingBitmask = function(settingName) {
  return getSettingIndexedValue(settingName,folderSettingValues[settingName].bitmask);
}
/**
 * Calculate the setting value of a single setting
 * 
 * @param {string} name Name of the setting
 * @param {number} value Numerical value of this single setting
 * @returns {number}
 */
const calculateFolderSingleSetttingValueBySingleValue = function(name, value) {
  if (value > 0) {
    value = getSettingIndexedValue(name, value);
  }
  return value;
}
/**
 * Calculate the number representation of a certain setting value
 * @param {string} name Name of the setting
 * @param {string} textvalue Value of the setting
 * @returns {number} Bit number representing the setting value
 */
export const calculateFolderSingleSettingValue = function(name, textvalue) {
  let value = 1; // if no "values" in the settingValues, then 1 (checkbox is checked)
  let settingValues = folderSettingValues[name];
  if (settingValues.values !== undefined) {
    value = settingValues.values[textvalue];
  }
  return calculateFolderSingleSetttingValueBySingleValue(name, value);
}
/**
 * Verify if a folder's settings has a certain setting value set
 * @param {string} settingName Name of the setting to verify
 * @param {string} valueName Value of the setting to verify
 * @param {number} folderSettingValue The settings in which we want to verify if the setting value is set
 * @returns  {boolean} Whether the setting value is set in the folderSettingValue
 */
export const folder_hasSetting = function(settingName, valueName, folderSettingValue) {
  const calculatedFolderSettingValue = calculateFolderSingleSettingValue(settingName,valueName);
  const maskedSetting = (folderSettingValue & getSettingBitmask(settingName));
  return maskedSetting === calculatedFolderSettingValue;
}
/**
 * Set a setting in a settings value
 */
export const setFolderSetting = function(settingName, valueName, folderSettingValue) {
  let updatedFolderSettingValue = folderSettingValue;
  let andMask = 0; // mask to get the unchanged values
  for (let name in folderSettingValues) {
    if(name !== settingName) {
      andMask |= getSettingBitmask(name); // and with full bitmask, so this setting does not change value
    }
  }
  updatedFolderSettingValue &= andMask; // the unchanged values
  updatedFolderSettingValue |= calculateFolderSingleSettingValue(settingName, valueName); // set the changed value
  return updatedFolderSettingValue;
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
 * Parse a number that was encoded for settings
 **/
export const parseNumber = function(string) {
  return parseInt(string,36);
}
/**
 * Encode an integer to put it in settings
 * as an integer is stored as a string, this takes less 
 **/
export const encodeNumber = function(date) {
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
  // Calculate the timestamp like Thunderbird does
  // Bitwise Or ) with ZERO converts value to integer by discarding any value after decimal point
  // https://stackoverflow.com/a/75235699
  const timestmap =  date/1000 | 0;

  // we encode the unix timestamp with base 36
  // this is more efficient as the integer is stored as an ascii string
  // the timestamp is reduced from 13 to 8 characters
  return encodeNumber(timestmap);
}

/**
 * Execute callback function on all folders found
 **/
export const foreachAllFolders = async function(callback) {
  let folders = await messenger.folders.query({
    canAddMessages: true,
  });
  for (let folder of folders) {
    await callback(folder);
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
 * Return a folder id usable by the folder webextensions API
 * This can also be done using the folders.query function if folderId would become something more cryptic
 **/
export const constructFolderId = async function(accountId, path) {
  return accountId+":/"+path; // path starts with "/"
};
/**
 * Return a folder id usable by the folder webextensions API
 * from the name used in the settings
 * This can also be done using the folders.query function if folderId would become something more cryptic
 **/
const getFolderIdFromSetting = async function(folderSetting) {
  const folder = decodeURI(getFolderFromSettingsKey(folderSetting));
  const accountSplitIndex = folder.indexOf("/");
  const accountId = folder.substring(0,accountSplitIndex);
  const path = folder.substring(accountSplitIndex);
  return constructFolderId(accountId,path);
}
/**
 * Return a folder object usable by the folder webextensions API
 * from the name used in the settings
 * TODO replace instances of this with above as new API does not require folder object
 **/
const getFolderObjectFromSetting = async function(folderSetting) {
  let folder = decodeURI(getFolderFromSettingsKey(folderSetting));
  let accountSplitIndex = folder.indexOf("/");
  return {
    accountId: folder.substring(0,accountSplitIndex), // for MailFolder "constructor"
    path: folder.substring(accountSplitIndex), // for MailFolder "constructor"
  };
}
/**
 * Get a folder object with tidybird settings, not usable by webextensions API
 **/
export const getTidybirdFolder = function(folderAttributeSetting, MRMTimeSetting, folderSettings) {
  //let time = common.parseNumber(MRMTimeSetting);
  return {
    tidybird_attributename: folderAttributeSetting,
    tidybird_time: MRMTimeSetting,
    tidybird_foldersettings: folderSettings,
  };
}
/**
 * Add tidybird settings to webextensions folder
 **/
export const makeTidybirdFolder = async function(folder) {
  const MRMSettingsKey = getFolderMRMSettingsKey(folder);
  const settings = await messenger.storage.local.get(MRMSettingsKey);
  const tidybirdFolderAttributes = getTidybirdFolder(getFolderSettingsKey(folder),settings[MRMSettingsKey],undefined);
  for (const tidybirdFolderAttribute in tidybirdFolderAttributes) {
    folder[tidybirdFolderAttribute] = tidybirdFolderAttributes[tidybirdFolderAttribute];
  }
  return folder;
}
/**
 * Return an eventual semi-expanded folder object
 * from some object containing necessary folder info
 **/
export const getFolderFromInfo = async function(folderInfo) {
  let folder = folderInfo;
  let folderObject = await getFolderObjectFromSetting(folderInfo.tidybird_attributename);
  folder.path = folderObject.path;
  folder.accountId = folderObject.accountId;
  // add other info
  /*
  for (let attributeName in folderInfo) {
    folderObject[attributeName] = folderInfo[attributeName];
  }
  */
  return folder;
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
export const expandFolder = async function(folder) {
  /*
   * either: copy
  for (let attributeName in folderInfo) {
    folderObject[attributeName] = folderInfo[attributeName];
  }
   * or: create object with known attributes
  let expandedFolder = {
    accountId: folder.accountId, // minimal folder object
    path: folder.path, // minimal folder object
    time: folder.time, // for ordening and rearranging when moved to if sorted on MRMTime
    settings: folder.folderSettings,
  };
   * or: change original and create object usable for API where/when necessary
   */
  let expandedFolder = folder;
  let path = expandedFolder.path;
  // We assume here (and in getRoot) the folder names are also path members
  //  as otherwise it would cost too much to get the folder object
  //  to get the folder name and the folder parent name
  //  TODO check this statement when testing a LOT of folders
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
  expandedFolder.internalPath = getInternalPath(expandedFolder);
  return expandedFolder;
}

export const getInternalPath = function(folder) {
  return encodeURI(folder.accountId + folder.path);
}

/**
 * First expand the folder and then add folder to a list grouped by:
 * 1) account (if needed)
 * 2) "pinned" and "auto" (sorted) folders
 *
 * Used settings: groupby_account & sortorder_accountname
 **/
export const addToGroupedList = async function(expandedFolder, settings) {
  let listType = "auto";
  if (folder_isPinned(expandedFolder.folderSettings)) {
    listType = "pinned";
  }
  // Add the folder according to the settings, so we can sort if needed
  let accountSortValue;
  if (settings.groupby_account || settings.sortorder_accountname) {
    accountSortValue = expandedFolder.accountId;
    if (settings.sortorder_accountname) {
      accountSortValue = expandedFolder.accountName;
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

export const isExpansionNeeded = function(sortorder, alreadyExpanded) {
  if (alreadyExpanded) {
    return false;
  }
  for (const sortby of sortorder) {
    if (!getAttributeSortFunctionNeeds(sortby).startsWith("tidybird_")) {
      return true;
    }
  }
  return false;
}

/*
 * Folder sorting
 */
export const getAttributeSortFunctionNeeds = function(sortby) {
  switch(sortby) {
    case "mostrecent":
      return "tidybird_time";
    case "namecasein":
    case "reversenamecasein":
      return "name";
    case "fullpath":
      // is an encoded fullpath, we use this so an expand is not needed before cutoff
      return "tidybird_attributename";
    case "parentname":
      return "parentName";
    case "accountname":
      return "accountName";
  }
  return null;
}
let collator = new Intl.Collator();
export const getSortFunction = async function(sortby) {
  const attribute = getAttributeSortFunctionNeeds(sortby);
  switch(sortby) {
    case "mostrecent":
      return (a,b) => {
        if  ( a[attribute] === b[attribute] ) {
          return 0;
        }
        // reverse sort
        if (
          ( a[attribute] === undefined && b[attribute] !== undefined )
          ||
          a[attribute] < b[attribute]
        ) {
          return 1;
        }
        return -1;
      };
    case "namecasein":
    case "fullpath":
    case "parentname":
    case "accountname":
      return(a,b) => collator.compare(a[attribute],b[attribute]);
    case "reversenamecasein":
      return(a,b) => collator.compare(b[attribute],a[attribute]);
  }
  return null;
}
/**
 * Returns a sorted array of attributes to sort the folders
 * Occasionally skipping initial sortorder if already done
 **/
export const getFullSortorder = async function(settings,alreadySortedBy) {
  const order = [];
  if (alreadySortedBy === true) {
    // already fully sorted, not doing anything
    return order;
  }
  let changedOrder = false;
  if (settings.sortorder_initial !== "no" && settings.sortorder_initial !== alreadySortedBy) {
    order.push(settings.sortorder_initial);
    changedOrder = true;
  }
  const nextOrders = [ "namecasein", "fullpath", "parentname", "accountname" ];
  for (const nextOrder of nextOrders) {
    if (settings['sortorder_'+nextOrder] && (changedOrder || alreadySortedBy != nextOrder)) {
      order.push(nextOrder);
      changedOrder = true;
    }
  }
  return order;
}
export const sortFoldersBySortorder = async function(folderList,sortorder) {
  for (let sortby of sortorder) {
    folderList.sort(await getSortFunction(sortby));
  }
}
export const arrayEquals = function(array1,array2) {
  if(array1.length != array2.length) {
    return false;
  }
  return array1.every((v,k) => v === array2[k])
}

export const isSpecialFolder = function(folder) {
  const folderSpecialUse = folder.specialUse; // since TB121
  return folderSpecialUse.includes("trash") || folderSpecialUse.includes("archives") || folderSpecialUse.includes("junk");
}

/**
 * Log debug messages with stack trace
 * Implementation based on SMR's debug function
 * @param {string} message The message to log
 */
export const debug = function(message) {
  console.log('[tidybird debug] '+message);
  if(false) { //TODO: setting for debug (with trace?)
    let e = new Error();
    console.log(e.stack);
  }
}
