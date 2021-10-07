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
import ora from 'ora';
import chalk from 'chalk';
import aws from 'aws-sdk';

var args = process.argv.slice(2)
const log = console.log;
var artistFilesPath = args[0]
let artist;
let dropName;
let artistDir;
let dropDir;

let metadata = {};

try {
    metadata = JSON.parse(fs.readFileSync(artistFilesPath + '/metadata.json', 'utf8'));
} catch (err) {
    log(chalk.red('Cannot read drop for some reason...'), err);
}

artist = metadata.artistName;
dropName = metadata.dropName;
artistDir = 'artists/' + artist;
dropDir = artistDir + '/' + dropName;

// setup nft storage client
const nftStorageClient = new NFTStorage({ token: loadApiKey() });

log(chalk.green("Loading AWS credentials."));

aws.config.loadFromPath('./awsConfig.json');

var s3 = new aws.S3({
    params: {
        Bucket: "memex-staging"
    }
});

// make artist dir
mkArtistDir(artistDir);

// make drop dir
mkDropDir(dropDir);

// staging files for subsequent processing
stageDropFiles(artistFilesPath, dropDir);

var fileWrappers = getDirFiles(dropDir, []);
var files = [];
fileWrappers.forEach(fw => files.push(fw.file));

log(chalk.blue(`Uploading ${dropDir} files to nft.storage.`));
const dirCid = await uploadFiles(files);

log(chalk.green(`Uploading ${dropDir} files to S3.`));
uploadFilesS3("memex-staging", dirCid, fileWrappers);

var drop = getDrop(dirCid, files);

try {
    log(chalk.green("Adding metadata to drop..."));
    hydrateDropMetadata(drop, dropDir + '/' + 'metadata.json');
} catch (err) {
    log(chalk.red("Something went wrong while adding metadata to drop..."), err);
}

log(chalk.green(`Creating prize metadata for ${dropDir}`));
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

log(chalk.blue(`Uploading prize metadata for ${dropDir}`));

var prizeFileWrappers = getDirFiles(prizeBaseDir, []);
var prizeFiles = [];
prizeFileWrappers.forEach(pfw => prizeFiles.push(pfw.file));

var prizeMetadataCid = await uploadFiles(prizeFiles);
uploadFilesS3("memex-staging", prizeMetadataCid, prizeFileWrappers);

drop.prizeMetadataCid = prizeMetadataCid;
drop.prizeIds = prizeIds;

fs.writeFile("drops/" + dirCid + ".json", JSON.stringify(drop), (err) => {
    if (err) {
        log(chalk.red(err));
    } else {
        log(chalk.green(`Saved drops/${dirCid}.json.`));
    }
});

function loadApiKey() {
    try {
        return fs.readFileSync('keys.txt', 'utf-8');
    } catch (err) {
        log(chalk.red("Unable to load api key."), err);
        return "";
    }
}

function mkArtistDir(artistDir) {
    log(chalk.gray(`Creating ${artist}/ directory...`))

    fs.mkdir(artistDir, { recursive: true }, (err) => {
        if (err) {
            log(chalk.red(err));
        } else {
            log(chalk.green(`Created ${artist}/ directory.`));
        }
    });
}

function mkDropDir(dropDir) {
    log(chalk.gray(`Creating ${dropDir}/ directory...`));

    fs.mkdir(dropDir, { recursive: true }, (err) => {
        if (err) {
            log(chalk.red(err));
        } else {
            log(chalk.green(`'Created ${dropDir}/ directory.`));
        }
    });
}

// The totem is for forcing uniqueness for uploading repeatedly with a single test drop.
function addTotem(artist) {
    log(chalk.gray("Creating totem..."));

    var totem = {
        'artist': artist,
        'uuid': uuid()
    };

    var totemAsJson = JSON.stringify(totem);
    var totemPath = dropDir + '/totem.json';

    try {
        fs.writeFileSync(totemPath, totemAsJson, { flag: 'w+' });
        log(chalk.green("Created totem."));
    } catch (err) {
        log(chalk.red("Unable to create totem."), err);
    }
}

function stageDropFiles(artistFilesPath, dropDir) {
    log(chalk.gray(`Moving ${artistFilesPath} into ${dropDir}`));
    fs.copySync(artistFilesPath, dropDir);
}

function encar(dropDir, dropName) {
    log(chalk.gray(`Archiving ${dropDir} as a .CAR...`));
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

    nftStorageClient.storeCar(buffer).catch(e => log(chalk.red(e)));
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
        log(chalk.red(excp));
    } 

    var reader = await CarReader.fromBytes(files[1].node);
    var blocks = await reader.blocks();

    for await (let num of blocks) {        
        if (num.bytes) {
            const path = "car-practice/";

            fs.mkdir(path, (err) => {
                log(chalk.red("Something went wrong while making a directory to decar into."), err);
            });

            if (isPic(num.bytes)) {
                fs.writeFile(path + uuid() + "img.png", num.bytes, (err) => {
                    if (err) {
                        log(chalk.red(err));
                    }
                });
            } else {
                fs.writeFile(path + uuid() + "data.png", num.bytes, (err) => {
                    if (err) {
                        log(chalk.red(err));
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
    log(chalk.gray(`Generating drop for ${dirCid}`));
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
                'ipfsPath': filePathInIpfs,
                'fileName': fileName,
                "name": name
            });
        } else if (f.name.includes("banner")) {
            drop.banner = {
                'path': filePathInIpfs,
                'fileName': fileName,
                'name': name
            };

            drop.bannerImagePath = filePathInIpfs;
            drop.bannerImageName = name;
        } else if (f.name.includes(".car")) {
            drop.car = filePathInIpfs;
        } else if (f.name.includes("metadata")) {
            drop.metaDataPath = filePathInIpfs;
        } else if (f.name.includes("totem")) {
            drop.totem = filePathInIpfs;
        }
    });
    
    return drop;
}

function hydrateDropMetadata(drop, pathToMetadata) {
    const relevantMetadata = JSON.parse(fs.readFileSync(pathToMetadata, 'utf8'));
    drop.metadata = relevantMetadata;

    drop.lotteryId = relevantMetadata.lotteryId; // this will come from Dante's script, setting to this for testing purposes
    drop.costPerTicket = relevantMetadata.costPerTicket;
    drop.startTime = relevantMetadata.startTime;
    drop.endTime = relevantMetadata.endTime;
    drop.artistName = relevantMetadata.artistName;
    drop.dropName = relevantMetadata.dropName;
    drop.dropDescription = relevantMetadata.dropDescription;
    drop.numberOfNftsInDrop = relevantMetadata.numberOfNftsInDrop;

    // add rarities 
    log(chalk.gray("Adding rarities."));
    let mintsPerDrop = 0;

    drop.nfts.forEach(nft => {
        var nftName = nft.name.split('.')[0];
        var relevantEntryInMetadata = drop.metadata[nftName];

        mintsPerDrop += relevantEntryInMetadata.numberOfMints;
    });

    let nftsWithRarity = [];

    drop.nfts.forEach(nft => {
        var nftName = nft.name.split('.')[0];

        var relevantEntryInMetadata = drop.metadata[nftName];

        const numberOfMints = relevantEntryInMetadata.numberOfMints;
        const probabilityOfPull = Number(((numberOfMints / mintsPerDrop) * 100).toFixed(2));
        const editionsCopy = numberOfMints > 1 ? 'Editions' : 'Edition';
        const rarity = `${numberOfMints} ${editionsCopy} | ${probabilityOfPull}% Chance`;

        nftsWithRarity.push({
            'name': nftName,
            'description': relevantEntryInMetadata.description,
            'numberOfMints': numberOfMints,
            'rarity': rarity,
            'ipfsPath': nft.ipfsPath
        });
    });

    log(chalk.green("Added rarities."));

    drop.nfts = nftsWithRarity;
}

function createPrizes(drop) {
    let prizes = [];
    log(chalk.gray(`Creating prizes for drop ${JSON.stringify(drop)}`));

    drop.nfts.forEach(nft => {
        var nftName = nft.name.split('.')[0];

        var relevantMetadata = drop.metadata[nftName];

        prizes.push({
            'name': relevantMetadata.name,
            'description': relevantMetadata.description,
            'image': nft.path
        });
    });

    log(chalk.green(`Created prizes for ${dropDir}.`));

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

    var fileWrapper = {
        'data': data,
        'file': new File([data], someFileName, {type: 'application/json'})
    };

    return fileWrapper;
}

function isPic(data) {
    return false;
    //return isJpg(data) || isPng(data);
}

function uploadFilesS3(bucketName, albumName, fileWrappers) {
    log(chalk.blue(`Uploading ${dropDir} files to S3.`));
    var albumFileKey = encodeURIComponent(albumName) + "/";

    fileWrappers.forEach((fw) => {
        var fileKey = albumFileKey + fw.file._name;
        
        var params = {
            Bucket: bucketName,
            Key: fileKey,
            Body: fw.data
        };

        s3.upload(params, function(err, data) {
            if (err) {
                log(chalk.red(`Unable to upload ${fw.file._name} from ${dropDir} to S3`), err);
            } else {
                log(chalk.blue(`Uploaded ${fw.file._name} from ${dropDir} to S3`));
            }
        });
    });
}