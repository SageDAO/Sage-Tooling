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

var args = process.argv.slice(2)
var artistFilesPath = args[0]
let artist;
let dropName;
let artistDir;
let dropDir;

let metadata = {};

try {
    metadata = JSON.parse(fs.readFileSync(artistFilesPath + '/metadata.json', 'utf8'));
} catch (err) {
    console.log('cannot read drop for some reason...', err);
}

artist = metadata.artistName;
dropName = metadata.dropName;
artistDir = 'artists/' + artist;
dropDir = artistDir + '/' + dropName;

// setup nft storage client
const nftStorageClient = new NFTStorage({ token: loadApiKey() });

// make artist dir
mkArtistDir(artistDir);

// make drop dir
mkDropDir(dropDir);

// create totem
//addTotem(artist);

// staging files for subsequent processing
stageDropFiles(artistFilesPath, dropDir);

// create .CAR 
encar(dropDir, dropName);

var files = getDirFiles(dropDir, []);
const dirCid = await uploadFiles(files);

var drop = getDrop(dirCid, files);

try {
    console.log("Adding metadata to drop...");
    hydrateDropMetadata(drop, dropDir + '/' + 'metadata.json');
} catch (err) {
    console.log("Something went wrong while adding metadata to drop ", err);
}

console.log('generating prize metadata...');
var prizes = createPrizes(drop);

const prizeBaseDir = "prizes/" + dirCid + "/";
fs.mkdirSync(prizeBaseDir);

var counter = 0;
var prizeIds = [];

prizes.forEach(prize => {
    prizeIds.push(counter);
    fs.writeFileSync(prizeBaseDir + counter + ".json", JSON.stringify(prize));
    counter++;
});

console.log('uploading prize metadata...');
var prizeFiles = getDirFiles(prizeBaseDir, []); 
var prizeMetadataCid = await uploadFiles(prizeFiles);

console.log('prize metadata can be found at cid ', prizeMetadataCid);

drop.prizeMetadataCid = prizeMetadataCid;
drop.prizeIds = prizeIds;

fs.writeFile("drops/" + dirCid + ".json", JSON.stringify(drop), (err) => {
    if (err) {
        console.log(err);
    } else {
        console.log('Saved drop.');
    }
});

function loadApiKey() {
    try {
        return fs.readFileSync('keys.txt', 'utf-8');
    } catch (err) {
        console.log('Unable to load api key', err);
        return "";
    }
}

function mkArtistDir(artistDir) {
    console.log(`Creating ${artist}/ directory...`);

    fs.mkdir(artistDir, { recursive: true }, (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log(`Created ${artist}/ directory.`);
        }
    });
}

function mkDropDir(dropDir) {
    console.log(`Creating ${dropDir}/ directory...`);

    fs.mkdir(dropDir, { recursive: true }, (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log(`'Created ${dropDir}/ directory.`);
        }
    });
}

// The totem is for forcing uniqueness for uploading repeatedly with a single test drop.
function addTotem(artist) {
    console.log('Creating totem...');

    var totem = {
        'artist': artist,
        'uuid': uuid()
    };

    var totemAsJson = JSON.stringify(totem);
    var totemPath = dropDir + '/totem.json';
    console.log('totem path , ', totemPath);

    try {
        fs.writeFileSync(totemPath, totemAsJson, { flag: 'w+' });
        console.log('wrote totem...');
    } catch (err) {
        console.log('unable to write totem ', err);
    }
}

function stageDropFiles(artistFilesPath, dropDir) {
    console.log(`Moving ${artistFilesPath} into ${dropDir}`);
    fs.copySync(artistFilesPath, dropDir);
}

function encar(dropDir, dropName) {
    console.log(`Archiving ${dropDir} as a .CAR...`);
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
    return someResponse;
}

function getDrop(dirCid, files) {
    console.log(`Generating drop for ${dirCid}`);
    const contentsPath = 'https://' + dirCid + '.ipfs.dweb.link/';

    var drop = {
        'nfts': []
    };

    files.forEach(f => {
        const filePathInIpfs = contentsPath + f.name;
        const fileName = f.name;
        const name = f.name.split('.')[0];

        if (f.name.includes("nft")) {
            drop.nfts.push({
                'path': filePathInIpfs,
                'fileName': fileName,
                "name": name
            });
        } else if (f.name.includes("banner")) {
            drop.banner = {
                'path': filePathInIpfs,
                'fileName': fileName,
                'name': name
            };
        } else if (f.name.includes(".car")) {
            drop.car = filePathInIpfs;
        } else if (f.name.includes("metadata")) {
            drop.metaDataPath = filePathInIpfs;
        } else if (f.name.includes("totem")) {
            drop.totem = filePathInIpfs;
        }
    });

    console.log('# of nfts in drop: ', drop.nfts.length);
    return drop;
}

function hydrateDropMetadata(drop, pathToMetadata) {
    const relevantMetadata = JSON.parse(fs.readFileSync(pathToMetadata, 'utf8'));
    drop.metadata = relevantMetadata;

    drop.lotteryId = 123; // temporary hard-code for testing purposes
    drop.costPerTicket = relevantMetadata.costPerTicket;
    drop.startTime = relevantMetadata.startTime;
    drop.endTime = relevantMetadata.endTime;
    drop.artistName = relevantMetadata.artistName;
    drop.dropName = relevantMetadata.dropName;
    drop.dropDescription = relevantMetadata.dropDescription;

    // add rarities 
    console.log("Adding rarities");
    drop.nfts.forEach(nft => {
        var nftName = nft.name.split('.')[0];

        var relevantEntryInMetadata = drop.metadata[nftName];
        nft.rarity = relevantEntryInMetadata.rarity;
        nft.description = relevantEntryInMetadata.description;
    });
}

function createPrizes(drop) {
    let prizes = [];
    console.log("Creating prizes for drop " + JSON.stringify(drop));

    drop.nfts.forEach(nft => {
        var nftName = nft.name.split('.')[0];

        console.log('nftName', nftName);
        console.log('metadata', drop.metadata);
        var relevantMetadata = drop.metadata[nftName];

        prizes.push({
            'name': relevantMetadata.name,
            'description': relevantMetadata.description,
            'image': nft.path
        });
    });

    return prizes;
}

function getDirFiles(someDir, files) {
    fs.readdirSync(someDir).forEach(file => {
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
    var data = fs.readFileSync(filePath);
    return new File([data], someFileName, {type: 'application/json'});
}

function isPic(data) {
    return false;
    //return isJpg(data) || isPng(data);
}