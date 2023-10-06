//import Sortable from './sortablejs'; // does not work
import Sortable from './sortablejs/modular/sortable.core.esm.js';
// remark: sortable needs "open_in_tab": true in the manifest for options_ui
// TODO: find out why
import option_defaults from './default_options.js';

async function save() {
  console.log("save");
  let value;
  if (this.type == "checkbox") {
    value = this.checked;
  } else {
    value = this.value;
  }
  messenger.storage.sync.set({
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

  let folderName = `${account.name}${folder.path}`;
  let folderAttribute = encodeURI(folderName);
  folderEl.setAttribute("data-folder",folderAttribute); // use this attribute to get folder, not the displayed name, if we once decide to show something else
  let col_next = folderEl.firstElementChild; // col_handle
  col_next = col_next.nextElementSibling; // col_name
  col_next.textContent = folderName;
  foldergetEl.appendChild(folderEl);

  for (let subfolder of await messenger.folders.getSubFolders(folder,false)) {
    await addFolder(account, subfolder);
  }
}
async function setCurrentChoice(result) {
  for (let [key, value] of Object.entries(result)) {
    console.log(`${key}: ${value}`);
    if(key.startsWith("F_")) {
      // changed a folder setting, no loading desired as the list may take some time
      continue;
    }
    let inputNodes = document.querySelectorAll(`[name='${encodeURI(key)}']`);
    // if inputNode is radio
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
  let getting = messenger.storage.sync.get(option_defaults);
  getting.then(setCurrentChoice, onError);
}

async function settingsChangedListener(settingsUpdateInfo) {
  let changedSettings = Object.keys(settingsUpdateInfo).reduce((attrs, key) => ({...attrs, [key]: settingsUpdateInfo[key].newValue}), {});
  setCurrentChoice(changedSettings);
}

let folderSettingValues = {
  "show": {
    "base": 2,
    "values": {
      "auto": 0,
      "always": 1,
      "never": 2,
    },
  },
  "pin": {
    "base": 1,
  },
  "markasread": {
    "base": 4,
    "values": {
      "no": 0,
      "yes": 1,
      "double": 2,
    }
  }
};
function calculateFolderSetting(theRow) {
  let checkedInputs = theRow.querySelectorAll("input:checked");
  let folderSettings = 0;
  for (let checkedInput in checkedInputs) {

    folderSettings += folderSettingValues[checkedInput.name][checkedInput.value];
  }
}

function folderInput(theEvent) {
  let theInput = theEvent.target;
  let theRow = theInput.parentNode.parentNode;
  let foldername = theRow.getAttribute("data-folder");
  // a number, as it takes less place and we want to support many folders
  // note: numbers are probably stored in ascii (according to the byte usage: 1 byte per character)
  let folderSettings = 0;
  if(theInput.value == "pin") {
    if(theInput.checked) {
      theRow.classList.add("movable");
      theRow.classList.remove("notmovable");
      foldersortEl.appendChild(theRow);
      folderSettings++;
    } else {
      theRow.classList.remove("movable");
      theRow.classList.add("notmovable");
      foldergetEl.appendChild(theRow);
    }
  }
  // do with save button, so we can cancel?
  /*
  messenger.storage.sync.set({
    [`F_${foldername}`]: folderSettings,
  });
  */
  console.log("folderSave");
  console.log(this);
  console.log(theEvent);
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
  messenger.storage.sync.onChanged.addListener(settingsChangedListener);
}
