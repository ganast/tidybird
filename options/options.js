//import Sortable from './sortablejs'; // does not work
import Sortable from './sortablejs/modular/sortable.core.esm.js';
// remark: sortable needs "open_in_tab": true in the manifest for options_ui
// TODO: find out why
import option_defaults from './default_options.js';

async function save() {
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

function setCurrentChoice(result) {
  for (let [key, value] of Object.entries(result)) {
    console.log(`${key}: ${value}`);
    let inputNodes = document.querySelectorAll(`[name=${key}]`);
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


document.addEventListener("DOMContentLoaded", restoreOptions);
for (const input of document.querySelectorAll("input")) {
  // input event fires also when focus does not change, but does not work for select
  input.addEventListener("input", save);
}

Sortable.create(
  document.getElementById('foldersort'),
  {
    handle: '.handle',
    animation: 150,
    draggable: ".movable",
  }
);

// update the settings shown in this window as they may have been changed in another window
messenger.storage.sync.onChanged.addListener(settingsChangedListener);
