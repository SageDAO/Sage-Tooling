# MemeX Tooling

These are utilities needed to operate on the MemeX data layer. 

## Dependencies

To use, you will need an nft.storage api key. Ask for mine or feel free to create your own if you prefer! 
Once you have an api key, paste it into the first line of a file named keys.txt in the same directory as
totem.js.

You will also want to do ```npm install``` to install the dependencies in the package.json.

## totem.js

totem.js takes in the path to an artist's drop directory, creates a .CAR, uploads the directory to nft.storage,
and creates a breadcrumb.json representing the results. The artist's drop directory should be in the format
shown in the dtoc-art directory which has been included as an example.

Metadata about the drop, like the artist's name and the name of their drop, gets pulled from the metadata.json. 

## breadcrumbs

A breadcrumb is a .json file that contains information about a drop that is being added to our data layer. 
A breadcrumb contains links to the images, as well as metadata and a link to the metadata file. 

Each breadcrumb file is named {CID}.json, where the CID value is the CID we get back from nft.storage when uploading
the directory.

Example:

```
node totem.js dtoc-art
```

## crumbler.js

You can use crumbler.js to create breadcrumbtrail.json. A breadcrumbtrail is an array of breadcrumb objects. The idea
is to make this file available to the UI code, either at app-load or via an endpoint from another servie, so that it
can use the data to load images and display drop metadata.

To create breadcrumbtrail: 

```
node crumbler.js trail
```

To delete the contents of breadcrumbs/ and to delete the breadcrumtrail.json:

```
node crumbler.js clean
```

## megazord.js

If you have a directory of drops and you want to process them via a single command, you can run:

```node megazord.js pathToDirectoryOfDirectories```

This will run crumbler to delete any existing breadcrumbs, then it will run totem.js on each of the folders in your directory.
And finally, it will use crumbler to create breadcrumbstrail.json.