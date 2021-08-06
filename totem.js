const { uuid } = require('uuidv4');
const fs = require('fs-extra');
const { NFTStorage, File } = require ('nft.storage');
const { packToFs } = require('ipfs-car/pack/fs');
const { unpackStream } = require('ipfs-car/unpack');
const { writeFiles } = require('ipfs-car/unpack/fs');
const { FsBlockStore } = require('ipfs-car/blockstore/fs');
const { MemoryBlockStore } = require('ipfs-car/blockstore/memory');
const { IdbBlockStore } = require('ipfs-car/blockstore/idb');
const got = require('got');
const fetch = require('node-fetch');
const { recursive } = require('ipfs-unixfs-exporter');
const { CarReader, CarWriter } = require('@ipld/car');


var args = process.argv.slice(2)

var artist = args[0]
var artistFilesPath = args[1]
var dropName = args[2]

const nftStorageApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweDZlODI3NGU1RTczNjdFZTIzYjg3NTM2NEFmZmQ2RWZmOTQzOTRiYjMiLCJpc3MiOiJuZnQtc3RvcmFnZSIsImlhdCI6MTYyODIwNTAyMjYzMSwibmFtZSI6Im1lbWV4LWhhY2tmczIwMjEifQ.7Ry5UiHbbRH_nPNhXa--OSgv8yOMYjhZ-kULW7s3OmU';
const nftStorageClient = new NFTStorage({ token: nftStorageApiKey });

var artistDir = 'artists/' + artist + '/';

console.log('creating artist directory...');

fs.mkdir(artistDir, { recursive: true }, (err) => {
    if (err) {
        console.log(err);
    }
});

console.log('creating directory for this specific drop...');

var dropDir = artistDir + dropName;
fs.mkdir(dropDir, { recursive: true }, (err) => {
    if (err) {
        console.log(err);
    }
});

// The totem is some unique information created on the fly.
// The reason is to force reusable test data that can be uploaded
// with a brand new CID due to the data "changing" each time on
// account of the totem.

console.log('creating totem...');

var totem = JSON.stringify({
    'artist': artist,
    'uuid': uuid()
});

var totemPath = dropDir + '/totem.json';

fs.writeFile(totemPath, totem, (err) => {
    if (err) {
        console.log(err);
    }
});

console.log('moving artist files to their drop directory...');
console.log('from: ', artistFilesPath);
console.log('to: ', dropDir);

fs.copy(artistFilesPath, dropDir, err => {
    if (err) {
        console.log(err);
    } else {
        console.log('copy succeeded!');
    }
});

encar(dropDir, dropName);
decar('https://ipfs.io/api/v0/dag/export?arg=bafybeige4lr57upzqktvptaojllcwhjs7tmr4wppi57qjm2p7nreusb2om');

async function encar(dropDir, dropName) {
    console.log('Creating CAR for ease of transport...');

    packToFs({
        input: dropDir,
        output: dropDir + '/' + dropName + '.car',
        blockstore: new FsBlockStore()
    });
}

async function decar(url) {
    const response = await fetch(url, {method: 'POST'});
    const files = [];
    const blockstore = new MemoryBlockStore();

    try {
        for await (const file of unpackStream(response.body, { blockstore })) {
            files.push(file);
        }
    } catch (excp) {
        console.log(excp);
    } 

    var reader = await CarReader.fromBytes(files[1].node);
    var blocks = await reader.blocks();

    for await (let num of blocks) {        
        if (num.bytes) {
            const path = "car-practice/";

            fs.mkdir(path, (err) => {
                console.info('something went wrong making a dir', err);
            });

            if (isPic(num.bytes)) {
                fs.writeFile(path + uuid() + "img.png", num.bytes, (err) => {
                    if (err) {
                        console.log('something went wrong');
                        console.log(err);
                    }
                });
            } else {
                fs.writeFile(path + uuid() + "data.png", num.bytes, (err) => {
                    if (err) {
                        console.log('something went wrong');
                        console.log(err);
                    }
                });
            }
        }
    }
}

function isPic(data) {
    return false;
    //return isJpg(data) || isPng(data);
}

// For each drop directory, we should create a .CAR just in case we go with that approach
// We should also be able to go in each drop directory and upload individual files,
// and save the CIDs in a breadcrumb specific to that drop.

// All breadcrumbs should be returned or accessible via a single .json file or endpoint.

// TODO: implement storing the directory to nft.storage and saving the CID to a file
//const someResponse = await nftStorageClient.storeDirectory()