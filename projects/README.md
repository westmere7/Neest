# projects/

The shared project folder. When Neest runs from the dev or preview server (`npm run dev` or `start-neest.bat`), every project you open or edit is mirrored here, so teammates get it with `git pull`.

- One file per project: `<name-slug>__<project-id>.json`. This is the same JSON as a `.neest` export, validated against the schema when it is loaded.
- Imported 3D models used by those projects are stored in `assets/<blobId>.glb`.
- A project in this folder that your browser has not seen yet shows up in the launcher under **From the repo folder**. Opening it imports it into your browser.
- If this folder has a newer copy than your browser, the newer copy opens.
- Edits made here while the app is open (by `git pull`, another tool or an agent) appear in the browser within about a second. Each one is a single undoable step named "External change (repo folder)".
- To stop mirroring in a browser, turn off **Sync to repo** in the launcher.
- Deleting a project in the browser keeps its file here. To remove the file, use **Remove from projects/ folder…** in the card menu, or delete it with git.

Only commit the projects you want teammates to see. The built-in samples (apartment, 9 × 4.5 m studio and 100 m² loft) are always available from **Open sample** in the launcher, so they don't need to be committed.
