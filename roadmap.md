
1. 5.0 Test thoroughly if everything works and release (without expert settings)
    1. move default_options.js to elsewhere with different name
    1. change "initial sorting" description based on real initial order by cutoff
    1. simple settings: use in tidybird folderlist (without changing per folder settings)
    1. resort after moving only after losing focus, so order does not change while using the buttons
    1. Check if we handled remarks in ATN reviews & github issues
    1. Moved folders not removed from MRM => remove folders in buttons that do not longer exist if we don't run over the folders but over the settings
    1. add debug messages including timing & export (see tbsync)
    1. TODOs & FIXMEs
    1. Store release procedure
        1. List of tests to run
            1. test with a LOT of folders (#56) and maybe do some stuff we thought too costly, like getting account name and path from folder setting name to add to list
            1. test with different themes
            1. test with different layouts
            1. test with UTF8 folders
        1. Check code quality with linter
        1. ...
1. 5.1: Use new api: do when merged to master, so changes can be done only once. But those will simplify life!
    1. last used date -> not the same as last moved to date, it's the time folder is last opened
    1. get folders using query (even only folders that can hold messages?)
    1. deprecated: folder.type
    1. test other folder types (search, ...)
    1. deprecated: getSubFolders(folder) -> uses now folderId => no folder object needed anymore, check functions using it and supporting functions to get folder object
1. 5.2 Other optimisations
    1. once we have our own MRM: shorcut for our own undo (#74)
    1. once we have our own MRM: check for reset, show info in iterface (#40)
    1. themed options: check other addons
1. 6 Expert settings
    1. keep last status of expert settings: expand or not
    1. combine with simple settings (keep in mind reset to "default")
    1. expert settings: implement immediate effect
    1. expert settings: (return to) automatic ordered folders in correct order
    1. checkbox to also apply on subfolders?
    1. right click on folder to add folder to tidybird
    1. move folder to sidepane to add to tidybird
    1. right click on button to persist|pinontop button in tidybird list
    1. separator yes/no between fixed & auto buttons
    1. update options folder list on creation/deletion