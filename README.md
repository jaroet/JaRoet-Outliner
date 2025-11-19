<div align="center">
<img width="1200" height="275" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# JaRoet Outliner
I arrived in a situation where I am unable to install any software on my computer. Being a big fan of **outliner software** and **PKM solutions**, I tried to create an outliner that does not need any installation whatsoever and has no dependency on anything online. 

But as I am no software developer the only way forward for me to get a result was using AI. Being somewhat invested in the Google bubble for quite some time, the choise for AI studio was easy to make. 
And the results blew my mind. Within a half an hour I had a working **Workflowy**, **Dynalist**, **Logseq** alternative without the need to install anything!  

## Installation
As mentioned, no installation is needed to run it locally. Just a somewhat up-to-date browser (it is wise to have that up-to-date anyway) and a folder to copy the files to. I have tested this on ChromeOS and Windows 11. 

Unzip the ZIP file in any location you want. Create a folder first as the ZIP file has only 3 files in it. 

Files in the ZiP file:
- index.html
- help-documentation.json
- demo.json

Only the **index.html** file is needed to run. The other 2 files are JSON files that you can import in the application using the import JSON button at the top right.

The **help-documentation.json** file contains a small outline that showcases the use of the application and documents the hotkeys and the way the application works. Might be nice to import it and read it once. It will take you only a few minutes. 

The **demo.json** file contains an example outline to show how the application can be used. 

## Storage
As I did not want anything online or in the cloud, everything you add to the application is stored in a local **IndexedDB** instance. From the application you can export the content of this IndexedDB (being your outline) to JSON as a backup and you can also import an exported JSON file. In the settings menu there is an option to reset the indexedDB and start over. 

## JSON Import and Export
- You can export the outline and import JSON files created with this app. 
- On import you get an option to choose where you want to import the JSON file to. Default is the root but you can choose any bullet in your outline under which the content of the JSOM file will be imported. 
- The export to JSON is always a complete export of the outline. It is more meant as a way to backup your outline. I plan a change to also export a part of your outline.  

## Warnings do apply!!
- I am not a developer, that is why I let google AI do all the coding for me. 
- The resulting app is fine and usable for me personally, your millage me vary and I am quite sure there are errors in the code I haven't found yet. 
- Make sure to backup regularly by exporting to JSON. I will not be accountable for any loss you incur by losing your data.

Happy outlining ... 
