# JaRoet Outliner

This outliner is made from the need for a **Workflowy**, **Dynalist** or **Logseq** alternative that does not 
require any installation to use and that stores the information locally. Without any dependency on cloud or web. 

Google's AIstudio is used for the creation of this software as I myself lack any developer-skills. But I know how 
to define/write-up features and I can test the results. 

I am fairly happy with the way this works. I work on this as a side-project in my evening spare time, 
so I will take small steps. Let me know in the discussions if you want certain features included. 

## Storage

No data is leaving you computer unless you want it to.
You can do that by using the export to JSON option in the topbar and sending that file to where you want it.
The storage is an IndexedDB that is managed by your browser. 

The caveat here is that when you change browsers you have to export your data (in the old browser) and import
it again using your new browser. In the old browser you can then remove/reset your outline so no informationis is
left behind. 

## Online dependencies

The only dependency is when you start JaRoet-Outliner for the first time. It will download a few libraries that
are being used to develop this app. 

The libraries are:
- dexie.js
- react.js
- 