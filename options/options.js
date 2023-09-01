let messenger = browser; // to prevent errors in linting...

async function save() {
  console.log(this);
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

function restoreOptions() {

  function setCurrentChoice(result) {
    console.log("set:");
    console.log(result);
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

  let defaults = {
    // TODO: use these values
    startup: "latest",
    // TODO: check these defaults
    sortorder: false,
    buttonheight: 30,
    nbfolders: 30,
    fixedfolders: {},
    mixfixed: "fixedfirst",
  };
  let getting = messenger.storage.sync.get(defaults);
  getting.then(setCurrentChoice, onError);
}


document.addEventListener("DOMContentLoaded", restoreOptions);
for (const input of document.querySelectorAll("input")) {
  // input event fires also when focus does not change, but does not work for select
  input.addEventListener("input", save);
}
