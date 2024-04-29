//import Sortable from './sortablejs'; // does not work
import Sortable from './sortablejs/modular/sortable.core.esm.js';
// remark: sortable needs "open_in_tab": true in the manifest for options_ui
// TODO: find out why

// general options can't start with "F" or "M"
// those are reserved for folder Options and MRMTime
// yes, it is cryptic, but it takes the least space
import * as common from './default_options.js';

async function save() {
  let value;
  if (this.type == "checkbox") {
    value = this.checked;
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
async function addFolder(folder) {
  let folderEl;
  if (folderElTemplate === undefined) {
    folderElTemplate = document.getElementById("defaultfolder");
  }
  folderEl = folderElTemplate.cloneNode(true);
  folderEl.removeAttribute('id');

  let folderAttribute = folder.internalPath;
  let folderOptionsAttribute = "F"+folderAttribute;

  folderEl.setAttribute("data-folder",folderAttribute);
  let col_next = folderEl.firstElementChild; // col_handle
  col_next = col_next.nextElementSibling; // col_name
  col_next.textContent = folder.displayPath;

  let parentEl = foldergetEl;

  let settings = (await messenger.storage.local.get([folderOptionsAttribute]));
  let folderOptions = settings[folderOptionsAttribute];
  if (folderOptions !== undefined) {
    setNonDefault(folderEl);
  }
  // we are out of DOM, so no querySelectorAll here
  for (let input of folderEl.getElementsByTagName("input")) {
    if (input.name) {
      let settingname = common.getSettingFromInput(input);
      // the name must be unique per folder for the radio buttons, so we set one here
      input.name = await getFolderinputName(folderOptionsAttribute, settingname);
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
  let folderEl;
  const folderAttribute = common.getFolderFromSettingsKey(key);
  const folderEls = document.querySelectorAll(`[data-folder='${folderAttribute}']`);
  if (!folderEls.length) {
    console.error(`Did not find the textfield to set ${key}`);
  } else {
    for (const thisFolderEl of folderEls) {
      // there should only be 1
      folderEl = thisFolderEl;
    }
  }
  if(key == "Fdefault") {
    // change the inputs of folders with default settings
    //FIXME
  } else if(value === undefined) {
    // settings has been removed => mark as default
    setDefault(folderEl);
  } else {
    // mark as non default, to add "reset" button
    // remark: when setting with same value as default, we do not remove the "default" status
    //  as it may be wanted that the folder's settings to not change with default settings
    setNonDefault(folderEl);
  }
  for (const folderSettingName in common.folderSettingValues) {
    // calculate for every setting value if it is set
    // can also be done without running over al possible values, but then we need to lookup the value anyway
    if(common.folderSettingValues[folderSettingName].values === undefined) { // checkbox
      const inputField = await getFolderinput(key, folderSettingName, folderSettingName);
      const isChecked = common.folder_hasSetting(folderSettingName, folderSettingName, value);
      inputField.checked = isChecked;
      if(folderSettingName == "pin") {
        let folderParent;
        //TODO also default folders can be given a place: put new pinned folders above this
        if(isChecked) {
          folderEl.classList.add("movable");
          folderEl.classList.remove("notmovable");
          folderParent = foldersortEl;
        } else {
          folderEl.classList.remove("movable");
          folderEl.classList.add("notmovable");
          if(key != "Fdefault") {
            folderParent = foldergetEl;
          }
        }
        if(folderParent && folderParent != folderEl.parentNode) {
          folderParent.appendChild(folderEl);
          //TODO append after default settings (if default pinned)
          //TODO put in original place if unpinned
          //FIXME signal order change to tidybird
        }
        if(foldersortElSortable !== undefined) {
          //FIXME sort according to manual sorted folder list
          //FIXME foldersortElSortable.sort(unpinnedOrder);
        }
        if(foldergetElSortable !== undefined) {
          foldergetElSortable.sort(unpinnedOrder);
        }
      }
    } else {
      for (const folderSettingsValue in common.folderSettingValues[folderSettingName].values) {
        const hasSetting = common.folder_hasSetting(folderSettingName, folderSettingsValue, value);
        if (hasSetting) {
          const inputField = await getFolderinput(key, folderSettingName, folderSettingsValue);
          inputField.checked = true;
        } // else: not checked, uncheck not needed: radio
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
      const settings = await messenger.storage.local.get(common.option_defaults);
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
      await addFolder(expandedFolder);
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
    folderSettings += common.calculateFolderSingleSettingValue(inputname,checkedInput.value);
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
  console.log(this);
  console.log(theEvent);

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

  let settingsPromise = messenger.storage.local.get(common.option_defaults);
  settingsPromise.then((settings) => setCurrentChoice(settings,false));
  settingsPromise.then((settings) => loadFolders(settings))
  .then(() => {
    // update the settings shown in this window as:
    // * they may have been changed in another window
    // * it may be needed to act upon, to show updated order for example
    messenger.storage.local.onChanged.addListener(settingsChangedListener);
  });
}
