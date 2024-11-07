//import Sortable from './sortablejs'; // does not work
import Sortable from './sortablejs/modular/sortable.core.esm.js';
// remark: sortable needs "open_in_tab": true in the manifest for options_ui
// TODO: find out why

// general options can't start with "F" or "M"
// those are reserved for folder Options and MRMTime
// yes, it is cryptic, but it takes the least space
import * as common from '../tidybird_common.js';

async function save() {
  let value;
  if (this.type == "checkbox") {
    value = this.checked;
  } else if (this.type == "number" && this.value == "") {
    // busy editing and/or an invalid number is given
    return;
  } else {
    value = this.value;
  }
  messenger.storage.local.set({
    [this.name]: value
  });
}
async function setNonDefault(folderEl) {
  folderEl.classList.remove("default");
}
async function setDefault(folderEl) {
  folderEl.classList.add("default");
}
async function getFolderinputName(folderOptionsAttribute, settingname) {
  return settingname+"_"+folderOptionsAttribute;
}
async function getFolderinput(folderOptionsAttribute, settingname, inputValue) {
  const folderinputName = await getFolderinputName(folderOptionsAttribute, settingname);
  return document.querySelector(`[name="${folderinputName}"][value="${inputValue}"]`);
}
let folderElTemplate;
let unpinnedOrder = [];
const addAccount = function (accountName) {
  let accountRow = document.createElement("tr");
  let accountCell = document.createElement("th");
  accountCell.setAttribute("colspan",2);
  accountCell.classList.add("folderviewaccount")
  accountCell.textContent = accountName;
  accountRow.append(accountCell);
  foldergetEl.append(accountRow);
}
/**
 * Calculate default folder settings
 * @param {TidybirdFolder} folder folder to calculate settings for
 * @param {boolean} folderstoshow_default if true, use thunderbird setting whether to show special folders or not
 * @param {number} Fdefault default settings value
 * @returns 
 */
function calculate_simpleSetting(folder, Fdefault) {
  const folderstoshow_default = settings.folderstoshow_default;
  // follow default and simple settings: folders with shortcuts
  if(common.isSpecialFolder(folder) && folderstoshow_default) {
    // internally, special folder detection is done by saving the MRM of these folders elsewhere (as Thunderbird does)
    // folderOptions is undefined here, so we must take Fdefault options
    // folderstoshow_default is true, so we follow Thunderbird defaults: never show special folders
    return common.setFolderSetting("show","never",Fdefault);
  } //else: default behaviour
}
/**
 * Get the settings of a folder
 * @param {Folder} folder
 */
async function getFolderOptions(folder) {
  const folderOptionsAttribute = common.getFolderSettingsKey(folder);
  const folderSettings = (await messenger.storage.local.get([folderOptionsAttribute]));
  return folderSettings[folderOptionsAttribute];
}
/**
 * Add a folder's html settings view to the corresponding html element
 * 
 * @param {TidybirdFolder} folder 
 * @param {number} Fdefault Default settings for all folders without settings
 * @param {boolean} folderstoshow_default "Simple" folder setting: whether to show special folders or not
 */
async function addFolder(folder,Fdefault,folderstoshow_default) {
  let folderEl;
  if (folderElTemplate === undefined) {
    folderElTemplate = document.getElementById("defaultfolder");
  }
  folderEl = folderElTemplate.cloneNode(true);
  folderEl.removeAttribute('id');

  let folderAttribute = common.getFolderAttributename(folder);
  folderEl.setAttribute("data-folder",folderAttribute);
  let col_next = folderEl.firstElementChild; // col_handle
  col_next = col_next.nextElementSibling; // col_name
  col_next.textContent = folder.displayPath;

  let parentEl = foldergetEl;

  let folderOptions = await getFolderOptions(folder);
  if (folderOptions !== undefined) {
    setNonDefault(folderEl);
  } else {
    // if default options, follow default and simple settings: folders with shortcuts
    // default settings are already taken by copying html
    // so there is only the simple setting to take care of
    folderOptions = calculate_simpleSetting(folder, Fdefault);
  }
  // we are out of DOM, so no querySelectorAll here
  // Things done in this loop:
  // * set input names
  // * apply non default folder options
  for (let input of folderEl.getElementsByTagName("input")) {
    if (input.name) {
      let settingname = common.getSettingFromInput(input);
      // the name must be unique per folder for the radio buttons, so we set one here
      input.name = await getFolderinputName(folderAttribute, settingname);
      if (folderOptions !== undefined) {
        if (common.folder_hasSetting(settingname, input.value, folderOptions)) {
          input.checked = true;
          if (settingname == "pin") {
            folderEl.classList.add("movable");
            folderEl.classList.remove("notmovable");
            parentEl = foldersortEl;
          }
        } else {
          input.checked = false; // needed, otherwise the default html checked is taken if it is after a checked element
          if (settingname == "pin") {
            folderEl.classList.remove("movable");
            folderEl.classList.add("notmovable");
            parentEl = foldergetEl;
          }
        }
      }
    }
  }
  for (let span of folderEl.getElementsByTagName("span")) {
    if (span.getAttribute("data-name") == "MRM") {
      if (folder.tidybird_time) {
        span.textContent = common.parseDate(folder.tidybird_time);
        // folderInfo.lastUsed can't be used, this is (or also includes) last time folder was opened
      }
    }
  }
  unpinnedOrder.push(folderAttribute); // order if they would all not be pinned, so if they are inpinned, they are put in the right order
  parentEl.appendChild(folderEl);
}

async function setCurrentChoiceFoldersetting(key, value, doSetFolderOptions) {
  if(!doSetFolderOptions && !key == "Fdefault") {
    return;
  }
  const folderEl = findFolderElement(key);
  if(key == "Fdefault") {
    // change the inputs of folders with default settings
    await common.foreachAllFolders(async (folder,account) => {
      const folderAttribute = common.getFolderAttributename(folder);
      let folderOptions = await getFolderOptions(folder);
      if(folderOptions === undefined) {
        folderOptions = calculate_simpleSetting(folder, value);
      } //else: specific folder settings set, no need to change with default
      //FIXME copy default options & set input names? => probably better to run over all inputs
      //setCurrentChoiceFoldersettingByAttribute(folderAttribute, ..., true, false);
      //FIXME if default, then set new default value, but don't mark as non default
    });
  } else if(value === undefined) {
    // settings has been removed => mark as default
    // FIXME take value from default
    setDefault(folderEl);
  } else {
    // mark as non default, to add "reset" button
    // remark: when setting with same value as default, we do not remove the "default" status
    //  as it may be desired that the folder's settings to not change with default settings
    setNonDefault(folderEl);
  }
  await displayFolderSettings(key, value, folderEl);
}

function findFolderElement(key) {
  const folderAttribute = common.getFolderFromSettingsKey(key);
  const folderEls = document.querySelectorAll(`[data-folder='${folderAttribute}']`);
  if (!folderEls.length) {
    console.error(`Did not find the textfield to set ${key}`);
  } else {
    for (const thisFolderEl of folderEls) {
      // there should only be 1
      return thisFolderEl;
    }
  }
}

async function displayFolderSettings(key, value, folderEl) {
  for (const folderSettingName in common.folderSettingValues) {
    // calculate for every setting value if it is set
    // can also be done without running over al possible values, but then we need to lookup the value anyway
    if (common.folderSettingValues[folderSettingName].values === undefined) { // checkbox
      const inputField = await getFolderinput(key, folderSettingName, folderSettingName);
      const isChecked = common.folder_hasSetting(folderSettingName, folderSettingName, value);
      inputField.checked = isChecked;
      if (folderSettingName == "pin") {
        let folderParent;
        //TODO also default folders can be given a place: put new pinned folders above this
        if (isChecked) {
          folderEl.classList.add("movable");
          folderEl.classList.remove("notmovable");
          folderParent = foldersortEl;
        } else {
          folderEl.classList.remove("movable");
          folderEl.classList.add("notmovable");
          if (key != "Fdefault") {
            folderParent = foldergetEl;
          }
        }
        if (folderParent && folderParent != folderEl.parentNode) {
          folderParent.appendChild(folderEl);
          //TODO append after default settings (if default pinned)
          //TODO put in original place if unpinned
          //FIXME signal order change to tidybird
        }
        if (foldersortElSortable !== undefined) {
          //FIXME sort according to manual sorted folder list
          //FIXME foldersortElSortable.sort(unpinnedOrder);
        }
        if (foldergetElSortable !== undefined) {
          foldergetElSortable.sort(unpinnedOrder);
        }
      }
    } else {
      for (const folderSettingsValue in common.folderSettingValues[folderSettingName].values) {
        const hasSetting = common.folder_hasSetting(folderSettingName, folderSettingsValue, value);
        if (hasSetting) {
          const inputField = await getFolderinput(key, folderSettingName, folderSettingsValue);
          inputField.checked = true;
        }
      }
    }
  }
}

async function setCurrentChoiceFolderdate(key, value, doSetFolderOptions) {
  if(!doSetFolderOptions) {
    return;
  }
  let folderAttribute = common.getFolderFromSettingsKey(key);
  let textFields = document.querySelectorAll(`[data-folder='${folderAttribute}'] [data-name='MRM']`);
  if (!textFields.length) {
    console.error(`Did not find the textfield to set ${key}`);
  } else {
    for (let textField of textFields) {
      // there should only be 1
      textField.textContent = common.parseDate(value);
    }
  }
}

/**
 * Set the current options
 * This may be when opening options page or when changing an options
 * When opening the page, the folder options should not be set as they are added and set
 **/
async function setCurrentChoice(result,doSetFolderOptions) {
  for (let [key, value] of Object.entries(result)) {
    console.log(`${key}: ${value}`);
    settings[key] = value; // set value in cache
    if(key[0] === "F") {
      setCurrentChoiceFoldersetting(key, value, doSetFolderOptions);
      continue;
    }
    if(key[0] === "M") {
      setCurrentChoiceFolderdate(key, value, doSetFolderOptions);
      continue;
    } else if(key === "manualorder") {
      if(!doSetFolderOptions) {
        // no inputs to select
        continue;
      }
      if(foldersortElSortable !== undefined) {
        foldersortElSortable.sort(value);
      }
      continue;
    }
    if(key.startsWith("sortorder_") && doSetFolderOptions) {
      const groupedFolderList = await common.getGroupedFolderList();
      const sortorder = await common.getFullSortorder(settings,false);
      await common.sortFoldersBySortorder(groupedFolderList.folderList.auto, sortorder);
      // no folders have been removed, so just move them in the corect order
      const childrenMap = new Map();
      Array.from(foldergetEl.children).forEach((child) => {
        childrenMap.set(child.getAttribute('data-folder'), child);
      });
      for (let expandedFolder of groupedFolderList.folderList.auto) {
        const mapRow = childrenMap.get(expandedFolder.internalPath);
        if (mapRow !== undefined) {
          foldergetEl.appendChild(mapRow);
        } // else: mapRow is in manual sorted list
      }
      // and continue to set checkboxes in other options instances
    }
    let inputNodes = document.querySelectorAll(`[name='${encodeURI(key)}']`);
    if (!inputNodes.length) {
      console.error(`Did not find an input for setting ${key}`);
    } else if (inputNodes.length > 1) { // radio or checkbox group
      for (let inputNode of inputNodes) {
        if (inputNode.value == value) {
          inputNode.checked = true;
        }
      }
    } else {
      let inputNode = inputNodes[0];
      if (inputNode.type == "checkbox") {
        inputNode.checked = value;
      } else {
        inputNode.value = value;
      }
    }
  }
}
async function loadFolders(settings) {
  // FIXME: do this if a setting changing the order has changed or if a folder is added/removed
  foldergetEl.textContent = "";

  common.resetLists();
  await common.foreachAllFolders(async (folder,account) => {
    await common.makeTidybirdFolder(folder); // add MRMTime
    const expandedFolder = await common.expandFolder(folder);
    await common.addToGroupedList(expandedFolder, settings);
  });

  const groupedFolderList = await common.getGroupedFolderList();
  const sortorder = await common.getFullSortorder(settings,false);
  for ( let accountSortValue of Object.keys(groupedFolderList).sort() ) {
    if (settings.groupby_account) {
      let takeAccountFrom = groupedFolderList[accountSortValue].auto;
      if (!takeAccountFrom.length) {
        takeAccountFrom = groupedFolderList[accountSortValue].pinned;
      }
      await addAccount(takeAccountFrom[0].accountName);
    }
    await common.sortFoldersBySortorder(groupedFolderList[accountSortValue].auto, sortorder);
    for (let expandedFolder of groupedFolderList[accountSortValue].auto) {
      await addFolder(expandedFolder, settings.Fdefault, settings.folderstoshow_default);
    }
  }

  let manualorder = (await messenger.storage.local.get({"manualorder":[]})).manualorder;
  document.getElementById('folderinput').addEventListener("click", folderClick);
  document.getElementById('folderinput').addEventListener("change", folderInput);
  foldersortElSortable = Sortable.create(
    foldersortEl,
    {
      group: 'folders',
      handle: '.folderhandle',
      animation: 150,
      //draggable: ".movable", // optional, default: all children
      //filter: ".notmovable", // makes unmovable elements responsive to moving other elements in between
      dataIdAttr: 'data-folder',
      store: {
        get: (sortable) => {
          // only called one single time at startup
          return manualorder;
        },
        set: (sortable) => {
          const order = sortable.toArray();
          messenger.storage.local.set({
            ["manualorder"]: order,
          });
        },
      },
    }
  );
  foldergetElSortable = Sortable.create(
    foldergetEl,
    {
      group: {
        name: 'folders',
        put: false, //TODO: when dragging back: put in default place
      },
      handle: '.folderhandle',
      animation: 150,
      //draggable: ".movable", // optional, default: all children
      //filter: ".notmovable", // makes unmovable elements responsive to moving other elements in between
      sort: false,
      dataIdAttr: 'data-folder', //TODO maybe a tmp id to keep a small ordered list of the original order
    }
  );
}

async function settingsChangedListener(settingsUpdateInfo) {
  let changedSettings = (Object.keys(settingsUpdateInfo)).reduce(
    function(attrs, key) {
      /*
      let settingIndex = weAreSetting.indexOf(key);
      if (settingIndex === -1) {
        // only add the setting if we are not the one changing it
      */
        return {
            ...attrs,
            [key]: settingsUpdateInfo[key].newValue
          };
      /*
      }
      weAreSetting.splice(key,1);
      return attrs;
      */
    },
    {},
  );
  if (Object.keys(changedSettings).length) {
    setCurrentChoice(changedSettings,true);
  }
}
function calculateFolderSetting(theRow) {
  let checkedInputs = theRow.querySelectorAll("input:checked");
  let folderSettings = 0;
  for (let checkedInput of checkedInputs) {
    const inputname = common.getSettingFromInput(checkedInput);
    console.log(`Getting values for ${inputname}`);
    //TODO OR together, so we are safe and do not count same twice?
    folderSettings |= common.calculateFolderSingleSettingValue(inputname,checkedInput.value);
  }
  return folderSettings;
}
async function setFolderSettings(foldername, folderSettings) {
  // Limits for sync storage:
  // - max 512 items => we can't store folders in separate items
  // - max item size: 8192 byte => on 2000 folders, only about 4 byte per folder...
  // also, sync storage is not really used in Thunderbird
  // so we don't use sync storage for tidybird, because mixing may lead to confusion
  //TODO we should however throw an error when we can't save a setting
  messenger.storage.local.set({
    ["F"+foldername]: folderSettings,
  });
  console.log(`folderSave on ${foldername}: ${folderSettings}`);
}
async function resetFolderSettings(foldername) {
  messenger.storage.local.remove("F"+foldername);
}
async function folderClick(theEvent) {
  let theInput = theEvent.target;
  if(theInput.className == "resetbutton") {
    const theRow = theInput.parentNode.parentNode;
    const foldername = theRow.getAttribute("data-folder");
    resetFolderSettings(foldername);
  }
}
async function folderInput(theEvent) {
  let theInput = theEvent.target;
  if(theInput.name === undefined) {
    // input without a name, event not thrown by an input of ours (probably sortable)
    return;
  }
  let theRow = theInput.parentNode.parentNode;
  let foldername = theRow.getAttribute("data-folder"); // or theInput.name.substring(splitterIndex+1)
  // a number, as it takes less place and we want to support many folders
  // note: numbers are probably stored in ascii (according to the byte usage: 1 byte per character)

  let folderSettings = calculateFolderSetting(theRow);
  setFolderSettings(foldername, folderSettings);
}

let settings;
async function setCache(newSettings) {
  settings = newSettings;
  return settings;
}

let foldersortEl, foldergetEl, foldersortElSortable, foldergetElSortable;
document.addEventListener("DOMContentLoaded", domReady);
function domReady() {
  foldersortEl = document.getElementById('foldersort');
  foldergetEl = document.getElementById('folderget');

  // must be done before adding folders
  for (const input of document.querySelectorAll("#basicsettings input")) {
    // input event fires also when focus does not change, but does not work for select
    input.addEventListener("input", save);
  }

  const settingsPromise = messenger.storage.local.get(common.option_defaults);
  // save whole cache at once, to immediatly have all settings available
  const settingsCachePromise = settingsPromise.then((settings) => setCache(settings));
  settingsCachePromise.then((settings) => setCurrentChoice(settings,false));
  settingsCachePromise.then((settings) => loadFolders(settings))
  .then(() => {
    // update the settings shown in this window as:
    // * they may have been changed in another window
    // * it may be needed to act upon, to show updated order for example
    messenger.storage.local.onChanged.addListener(settingsChangedListener);
  });
}
