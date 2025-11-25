# Jaroet-Outliner

It is an outliner in the spirit of Logseq, Workflowy or Dynalist that works completely local 
and without any installation needed. Other then copying a few files into a folder. 

## Features

- An outline with unlimited nested bullets
- Local storage (IndexedDB) with export and import functions
- Keyboard navigation with arrow keys and hotkeys
- Unfold and fold bullets with subbullets
- Zoom in and zoom out on bullets setting it as the outline base (also know as hoisting)
- Support for moving bullets in an outline
- Support for internal links using [[bullettext]] and external links using [linktext](link)
- Automatic recognizing emailaddresses and website URL's 

## Screenshot

![Project Screenshot](outline.png)

## storage

Everything is stored in an local **IndexedDB** database. This support fairly large outlines. 
There is an export to JSON and a Import from JSON function in the topbar that you can use to
backup you outline and import it. On import you can choose where to put it in the outline. 

As the IndexedDB is browser managed you will need to export and import the JSON file when 
you switch between browsers. Using multiple browser is not possible at the same time. 

## Internet usage

The app itself does not directly use the internet or cloud resources. On the first run some 
libararies are being downloaded from CDN url's. This is a onetime action and the libraries will
be cached to prevent new downloads. When you clean your browserdata those libraries will be
downloaded again. 

The libraries loaded are:
- **Tailwind CSS** (cdn.tailwindcss.com) - Used for the application's styling.
- **Babel Standalone** (unpkg.com) - Used to compile the JSX and TypeScript code directly within the browser.
- **Dexie.js** (unpkg.com) - A wrapper for IndexedDB used to store the outline data locally.

- **React** and **React DOM** (aistudiocdn.com) - The JavaScript library used for building the user interface.
