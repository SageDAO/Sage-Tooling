import { uuid } from 'uuidv4';
import fs from 'fs-extra';
import { NFTStorage, File } from 'nft.storage';
import { packToFs } from 'ipfs-car/pack/fs';
import { unpackStream } from 'ipfs-car/unpack';
import { FsBlockStore } from 'ipfs-car/blockstore/fs';
import { MemoryBlockStore } from 'ipfs-car/blockstore/memory';
import fetch from 'node-fetch';
import { CarReader, CarWriter } from '@ipld/car';
import { packToStream } from 'ipfs-car/pack/stream';
import path from 'path';
import chalk from 'chalk';
import aws from 'aws-sdk';
import dotenv from 'dotenv';
import pinataSDK from '@pinata/sdk';

dotenv.config();
const s3Bucket = process.env.S3_BUCKET;

var args = process.argv.slice(2)
const log = console.log;
var artistFilesPath = args[0]
let artist;
let dropName;
let artistDir;
let dropDir;
let pinata;
let metadata = {};

try {
    log(chalk.blueBright(`Processing contents of ${artistFilesPath}`))
    metadata = JSON.parse(fs.readFileSync(artistFilesPath + '/metadata.json', 'utf8'));
} catch (err) {
    log(chalk.red('Cannot read drop for some reason...'), err);
}

artist = metadata.artistName;
dropName = metadata.dropName;
artistDir = 'artists/' + artist;
dropDir = artistDir + '/' + dropName;

// setup nft storage client
const nftStorageClient = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });

log(chalk.green("Loading AWS credentials."));

aws.config.loadFromPath('./awsConfig.json');

var s3 = new aws.S3({
    params: {
        Bucket: s3Bucket
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
await backupPinFiles(dirCid, dropName + '-images');


log(chalk.green(`Uploading ${dropDir} files to S3.`));
uploadFilesS3(s3Bucket, dirCid, fileWrappers);

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
if (!fs.existsSync(prizeBaseDir)) {
    fs.mkdirSync(prizeBaseDir);
}

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
await backupPinFiles(prizeMetadataCid, dropName + '-metadata');
uploadFilesS3("memex-staging", prizeMetadataCid, prizeFileWrappers);

drop.prizeMetadataCid = prizeMetadataCid;
drop.prizes = prizeIds.length;

fs.writeFile("drops/" + dirCid + ".json", JSON.stringify(drop), (err) => {
    if (err) {
        log(chalk.red(err));
    } else {
        log(chalk.green(`Saved drops/${dirCid}.json.`));
    }
});

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

async function uploadFiles(files) {
    const someResponse = await nftStorageClient.storeDirectory(files);
    return someResponse;
}

async function backupPinFiles(cid, dropName) {
    if (process.env.PINATA_API_KEY != undefined) {
        if (pinata == null) {
            pinata = pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);
        }
        const options = {
            pinataMetadata: {
                name: dropName,
            },
            pinataOptions: {
                customPinPolicy: {
                    regions: [
                        {
                            id: 'NYC1',
                            desiredReplicationCount: 1
                        }
                    ]
                }
            }
        };
        log(chalk.gray(`Pinning CID ${cid} on Pinata`));
        pinata.pinByHash(cid, options).then((result) => {
            log(chalk.green(`Successfully pinned ${dropName} on Pinata.`));
        }).catch((err) => {
            log(chalk.red("Something went wrong while pinning CID on Pinata."), err);
        });
    } else {
        log(chalk.red("Pinata API key not set. Skipping backup pinning."));
    }
}


function getDrop(dirCid, files) {
    log(chalk.gray(`Generating drop for ${dirCid}`));
    const ipfsContentsPath = 'https://' + dirCid + '.ipfs.dweb.link/';
    const s3ContentsPath = process.env.S3_BASE_URL + "/" + dirCid + "/";

    var drop = {
        'nfts': [],
        'uniqueCid': dirCid
    };

    files.forEach(f => {
        const filePathInIpfs = ipfsContentsPath + f.name;
        const filePathInS3 = s3ContentsPath + f.name;
        const fileName = f.name;
        const name = f.name.split('.')[0];

        if (f.name.includes("nft")) {
            drop.nfts.push({
                'ipfsPath': filePathInIpfs,
                's3Path': filePathInS3,
                'fileName': fileName,
                "name": name
            });
        } else if (f.name.includes("banner")) {
            drop.banner = {
                'ipfsPath': filePathInIpfs,
                's3Path': filePathInS3,
                'fileName': fileName,
                'name': name
            };

            drop.bannerImageIpfsPath = filePathInIpfs;
            drop.bannerImageS3Path = filePathInS3;
            drop.bannerImageName = name;
        } else if (f.name.includes(".car")) {
            drop.carIpfsPath = filePathInIpfs;
            drop.carS3Path = filePathInS3;
        } else if (f.name.includes("metadata")) {
            drop.metadataIpfsPath = filePathInIpfs;
            drop.metadataS3Path = filePathInS3;
        } else if (f.name.includes("totem")) {
            drop.totemIpfsPath = filePathInIpfs;
            drop.totemS3Path = filePathInS3;
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
    drop.tags = relevantMetadata.tags;

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
            'ipfsPath': nft.ipfsPath,
            's3Path': nft.s3Path,
            'tags': relevantEntryInMetadata.tags
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
        'file': new File([data], someFileName, { type: 'application/json' })
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

        s3.upload(params, function (err, data) {
            if (err) {
                log(chalk.red(`Unable to upload ${fw.file._name} from ${dropDir} to S3`), err);
            } else {
                log(chalk.blue(`Uploaded ${fw.file._name} from ${dropDir} to S3`));
            }
        });
    });
}