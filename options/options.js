const browser = window.browser.extension.getBackgroundPage().browser;

async function save() {
  console.log(this);
  browser.storage.sync.set({
    [this.name]: this.value
  });
}

function restoreOptions() {

  function setCurrentChoice(result) {
    console.log("set:");
    console.log(result);
    document.querySelector("#nbfolders").value = result.nbfolders;
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  let getting = browser.storage.sync.get();
  getting.then(setCurrentChoice, onError);
}


document.addEventListener("DOMContentLoaded", restoreOptions);
for (const input of document.querySelectorAll("input")) {
  // input event fires also when focus does not change, but does not work for select
  input.addEventListener("input", save);
}
