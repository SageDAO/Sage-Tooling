import {uuid} from 'uuidv4';
import fs from 'fs-extra';
import {NFTStorage, File} from 'nft.storage';
import {packToFs} from 'ipfs-car/pack/fs';
import {unpackStream} from 'ipfs-car/unpack';
import {FsBlockStore} from 'ipfs-car/blockstore/fs';
import {MemoryBlockStore} from 'ipfs-car/blockstore/memory';
import fetch from 'node-fetch';
import {CarReader, CarWriter} from '@ipld/car';
import {packToStream} from 'ipfs-car/pack/stream';
import path from 'path';
import magic from 'mmmagic';


var args = process.argv.slice(2)

var artist = args[0]
var artistFilesPath = args[1]
var dropName = args[2]

let apiKey;

try {
  apiKey = fs.readFileSync('keys.txt', 'utf-8');
} catch (err) {
  console.log(err);
}

console.log('apiKey', apiKey);

const nftStorageClient = new NFTStorage({ token: apiKey });

var artistDir = 'artists/' + artist;

console.log('creating artist directory...');

fs.mkdir(artistDir, { recursive: true }, (err) => {
    if (err) {
        console.log(err);
    } else {
        console.log('created dir: ', artistDir);
    }
});

console.log('creating directory for this specific drop...');

var dropDir = artistDir + '/' + dropName;
fs.mkdir(dropDir, { recursive: true }, (err) => {
    if (err) {
        console.log(err);
    } else {
        console.log('created dir: ', dropDir);
    }
});

// The totem is for forcing uniqueness for uploading repeatedly with a single test drop.
console.log('creating totem...');

var totem = {
    'artist': artist,
    'uuid': uuid()
};

var totemAsJson = JSON.stringify(totem);
var totemPath = dropDir + '/totem.json';

fs.writeFile(totemPath, totemAsJson, (err) => {
    if (err) {
        console.log(err);
    }
});

console.log('Copying files into the artist drop directory...');

fs.copySync(artistFilesPath, dropDir);

const carPath = encar(dropDir, dropName);

generateBreadcrumbs(dropDir);
var files = getDirFiles(dropDir, []);
console.log(files.length);
await uploadFiles(files);

//uploadCar(carPath).then(() => console.log('upload complete')).catch(e => console.log(e));

function encar(dropDir, dropName) {
    console.log('Creating CAR for ease of transport...');
    const pathToCar = dropDir + '/' + dropName + '.car';

    packToFs({
        input: dropDir,
        output: pathToCar,
        blockstore: new FsBlockStore()
    });

    return pathToCar;
}

async function uploadCar(carPath) {
    const writable = fs.createWriteStream(carPath);

    await packToStream({
        input: dropDir,
        writable,
        blockstore: new FsBlockStore()
    });

    writable.end();

    const readable = fs.createReadStream(carPath);
    let buffer = [];

    readable.on('end', () => {
        buffer = readable.read();
    });

    console.log('size of buffer ', buffer.length);

    nftStorageClient.storeCar(buffer).catch(e => console.log(e));
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

async function uploadFiles(files) {
    const someResponse = await nftStorageClient.storeDirectory(files);
    console.log(someResponse);
}

function generateBreadcrumbs(dropDir) {
    let breadcrumb = {};
    let files = [];

    fs.readdirSync(dropDir).forEach(file => {
        if (file.name !== '.DS_Store') {
            if (fs.lstatSync(path.resolve(dropDir, file)).isDirectory()) {
                console.log('directory: ', file);
            } else {
                var file = getFile(dropDir, file);
                files.push(file);
            }
        }
    });

    console.log('breadcrumbs');
    console.log(files.length);
}

function getDirFiles(someDir, files) {
    console.log('getting files in ', someDir);
    fs.readdirSync(someDir).forEach(file => {
        console.log('looking at ', file);
        if (fs.lstatSync(path.resolve(someDir, file)).isDirectory()) {
            getDirFiles(someDir + '/' + file, files);
        } else {
            files.push(getFile(someDir, file));
        }
    });

    return files;
}

function getFile(somePath, someFileName) {
    const filePath = somePath + '/' + someFileName;
    console.log('getting file for ', filePath);
    var data = fs.readFileSync(filePath);
    return new File([data], someFileName, {type: 'application/json'});
}

function isPic(data) {
    return false;
    //return isJpg(data) || isPng(data);
}