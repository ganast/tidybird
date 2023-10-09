//import Sortable from './sortablejs'; // does not work
import Sortable from './sortablejs/modular/sortable.core.esm.js';
// remark: sortable needs "open_in_tab": true in the manifest for options_ui
// TODO: find out why
import option_defaults from './default_options.js';

let folderSettingValues = {
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

async function save() {
  console.log("save");
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
let folderElTemplate;
async function addFolder(account, folder) {
  let folderEl;
  if (folderElTemplate === undefined) {
    folderElTemplate = document.getElementById("newfolder");
  }
  folderEl = folderElTemplate.cloneNode(true);
  folderEl.removeAttribute('id');

  let folderName = `${account.name}${folder.path}`;
  let folderAttribute = encodeURI(folderName);
  // use this attribute to get folder, not the displayed name, if we once decide to show something else
  // foldername needs to be there for the new folder
  // and we need access to all settings of a certain folder
  folderEl.setAttribute("data-folder",folderAttribute);
  let col_next = folderEl.firstElementChild; // col_handle
  col_next = col_next.nextElementSibling; // col_name
  col_next.textContent = folderName;

  let parentEl = foldergetEl;

  let settings = (await messenger.storage.local.get(folderAttribute))[folderAttribute]
  // we are out of DOM, so no querySelectorAll here
  for (let input of folderEl.getElementsByTagName("input")) {
    if (input.name) {
      let settingname = input.name
      // the name must be unique per folder for the radio buttons
      input.name = settingname+"_"+folderAttribute;
      if (settings !== undefined) {
        let settingConfiguration = folderSettingValues[settingname];
        let inputSettingValue = calculateFolderSingleSettingValue(settingname,input.value);
        let maskedSetting = (settings & (settingConfiguration.bitmask << settingConfiguration.bitindex));
        if ( maskedSetting === inputSettingValue ) {
          input.checked = true;
          if (settingname == "pin") {
            folderEl.classList.add("movable");
            folderEl.classList.remove("notmovable");
            parentEl = foldersortEl;
          }
        } else {
          // needed, otherwise the default html checked is taken if it is after the checked element
          input.checked = false;
          if (settingname == "pin") {
            folderEl.classList.remove("movable");
            folderEl.classList.add("notmovable");
            parentEl = foldergetEl;
          }
        }
      }
    }
  };
  parentEl.appendChild(folderEl);

  for (let subfolder of await messenger.folders.getSubFolders(folder,false)) {
    await addFolder(account, subfolder);
  }
}
async function setCurrentChoice(result) {
  for (let [key, value] of Object.entries(result)) {
    console.log(`${key}: ${value}`);
    if(key.includes("/")) {
      // changed a folder setting, no loading desired as the list may take some time
      continue;
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

  // FIXME: remove existing list
  // FIXME: do this as less as possible, only if a setting changing the order has changed
  // FIXME: get settings for folders
  foldergetEl.textContent = "";
  let accounts = await messenger.accounts.list(true);
  for (let account of accounts) {
    for (let folder of account.folders) {
      await addFolder(account, folder);
    }
  }
}
function onError(error) {
  console.log(`Error: ${error}`);
}
function restoreOptions() {
  let getting = messenger.storage.local.get(option_defaults);
  getting.then(setCurrentChoice, onError);
}

let weAreSetting = [];
async function settingsChangedListener(settingsUpdateInfo) {
  let changedSettings = (Object.keys(settingsUpdateInfo)).reduce(
    function(attrs, key) {
      let settingIndex = weAreSetting.indexOf(key);
      if (settingIndex === -1) {
        // only add the setting if we are not the one changing it
        return {
            ...attrs,
            [key]: settingsUpdateInfo[key].newValue
          };
      }
      weAreSetting.splice(key,1);
      return attrs;
    },
    {},
  );
  if (Object.keys(changedSettings).length) {
    setCurrentChoice(changedSettings);
  }
}
function calculateFolderSingleSettingValue(name, textvalue) {
  let value = 1; // checkbox is checked
  let settingValues = folderSettingValues[name];
  if (settingValues.values !== undefined) {
    value = settingValues.values[textvalue];
  }
  if (value > 0) {
    value = value << settingValues.bitindex
  }
  return value;
}
function calculateFolderSetting(theRow) {
  let checkedInputs = theRow.querySelectorAll("input:checked");
  let folderSettings = 0;
  for (let checkedInput of checkedInputs) {
    let varParts = checkedInput.name.split("_",1);
    let inputname = varParts[0];
    console.log(`Getting values for ${inputname}`);
    folderSettings += calculateFolderSingleSettingValue(inputname,checkedInput.value);
  }
  return folderSettings;
}
function folderInput(theEvent) {
  console.log(this);
  console.log(theEvent);

  let theInput = theEvent.target;
  let theRow = theInput.parentNode.parentNode;
  let splitterIndex = theInput.name.indexOf("_"); // split splits always, max is just the nb of parts to return
  let inputname = theInput.name.substring(0,splitterIndex);
  let foldername = theRow.getAttribute("data-folder"); // or theInput.name.substring(splitterIndex+1)
  // a number, as it takes less place and we want to support many folders
  // note: numbers are probably stored in ascii (according to the byte usage: 1 byte per character)
  if(inputname == "pin") {
    if(theInput.checked) {
      theRow.classList.add("movable");
      theRow.classList.remove("notmovable");
      foldersortEl.appendChild(theRow);
    } else {
      theRow.classList.remove("movable");
      theRow.classList.add("notmovable");
      foldergetEl.appendChild(theRow);
    }
  }
  let folderSettings = calculateFolderSetting(theRow);
  // do with save button, so we can cancel?
  weAreSetting.push(foldername);
  // Limits for sync storage:
  // - max 512 items => we can't store folders in separate items
  // - max item size: 8192 byte => on 2000 folders, only about 4 byte per folder...
  // also, sync storage is not really used in Thunderbird
  // so we don't use sync storage for tidybird, because mixing may lead to confusion
  //TODO we should however throw an error when we can't save a setting
  messenger.storage.local.set({
    [foldername]: folderSettings,
  });
  console.log(`folderSave on ${foldername}: ${folderSettings}`);
}

let foldersortEl;
let foldergetEl;
document.addEventListener("DOMContentLoaded", domReady);
function domReady() {
  foldersortEl = document.getElementById('foldersort');
  foldergetEl = document.getElementById('folderget');

  // must be done before adding folders
  for (const input of document.querySelectorAll("#basicsettings input")) {
    // input event fires also when focus does not change, but does not work for select
    input.addEventListener("input", save);
  }

  restoreOptions();

  document.getElementById('folderinput').addEventListener("input", folderInput);
  Sortable.create(
    foldersortEl,
    {
      group: 'folders',
      handle: '.folderhandle',
      animation: 150,
      //draggable: ".movable", // optional, default: all children
      //filter: ".notmovable", // makes unmovable elements responsive to moving other elements in between
    }
  );
  Sortable.create(
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
    }
  );
  // update the settings shown in this window as they may have been changed in another window
  messenger.storage.local.onChanged.addListener(settingsChangedListener);
}
