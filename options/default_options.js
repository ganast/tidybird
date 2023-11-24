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
// also implemented in options.js
export const getFolderMRMSettingsKey = function(folder) {
  return encodeURI(`M${folder.accountId}${folder.path}`);
};
// also implemented in options.js
export const getFolderSettingsKey = function(folder) {
  return encodeURI(`F${folder.accountId}${folder.path}`); // should come alphabetically before MRM
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
  return new Intl.DateTimeFormat(undefined,{dateStyle:'short',timeStyle:'short'}).format(new Date(parseNumber(encodedDate)*1000));
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

