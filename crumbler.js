import fs from 'fs-extra';
import chalk from 'chalk';
import pkg from '@prisma/client';

const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const log = console.log;
const action = args[0];

if (action === 'crumbs') {
    createDrops();
} else if (action === 'crumb') {
    appendDrop();
} else if (action === 'clean') {
    cleanDrops();
} else {
    log(chalk.red("Parameter not recognized. Currently supported actions are: "));
    log(chalk.gray("crumbs"));
    log(chalk.gray("clean"));
}

function createDrops() {
    log(chalk.gray("Creating drops.json"));
    let drops = [];

    fs.readdirSync("drops").forEach(file => {
        if (file.includes(".json")) {
            try {
                var drop = JSON.parse(fs.readFileSync('drops/' + file, 'utf8'));
            } catch (err) {
                log(chalk.red("Cannot read drops/ for some reason."), err);
            }

            drops.push(drop);
        }
    });

    var asJson = JSON.stringify(drops);

    fs.writeFileSync("drops.json", asJson);

    log(chalk.green("Created drops.json"));

    saveDrops(drops);
}

function saveDrops(drops) {
    log(chalk.blue("Saving drops to database."));

    for (const drop of drops) {
        saveDrop(drop);
    }
}

function saveDrop(drop) {
    let nftsAsData = [];

    drop.nfts.forEach(nft => {
        nftsAsData.push({
          name: nft.name,
          description: nft.description,
          rarity: nft.rarity,
          ipfsPath: nft.ipfsPath,
          s3Path: nft.s3Path,
          tags: nft.tags
        });
    });

    const createDropRequest = prisma.drop.create({
        data: {
            lotteryId: drop.lotteryId,
            bannerImageIpfsPath: drop.banner.ipfsPath,
            bannerImageS3Path: drop.banner.s3Path,
            bannerImageName: drop.banner.name,
            metadataIpfsPath: drop.metadataIpfsPath,
            metadataS3Path: drop.metadataS3Path,
            costPerTicket: drop.costPerTicket,
            prizes: drop.prizes,
            prizeMetadataCid: drop.prizeMetadataCid,
            startTime: drop.startTime,
            endTime: drop.endTime,
            artistName: drop.artistName,
            dropName: drop.dropName,
            dropDescription: drop.dropDescription,
            tags: drop.tags,
            Nft: {
                createMany: {
                    data: nftsAsData
                }
            }
        }
    });

    createDropRequest.then(savedDrop => {
        log(chalk.green("Saved drop :", JSON.stringify(savedDrop)));
    }, err => {
        log(chalk.red("Unable to save drop..."), err);
    });
}

function appendDrop() {
    log(chalk.gray("Appending drop to drops.json"));

    let drops = JSON.parse(fs.readFileSync('drops.json', 'utf8'));
    let existingDropDirCids = [];
    let stagedDropDirCids = [];

    drops.forEach(drop => existingDropDirCids.push(drop.uniqueCid));

    fs.readdirSync("drops/").forEach(file => {
        stagedDropDirCids.push(file.split('.')[0]);
    });

    let deltaCid = stagedDropDirCids.filter(cid => !existingDropDirCids.includes(cid));

    if (deltaCid.length > 1) {
        log(chalk.red("There appears to be more than one drop waiting to be appended. Please provide manual review."));
    } else if (deltaCid.length === 0) {
        log(chalk.red("There is no drop waiting to be appended."));
    } else {
        var drop = JSON.parse(fs.readFileSync('drops/' + deltaCid[0] + '.json', 'utf8'));
        saveDrop(drop);

        log(chalk.green("Refreshing drops.json with the appended drop."));

        drops.push(drop);
        fs.rm('drops.json');
        fs.writeFileSync("drops.json", JSON.stringify(drops));
    }
}

function cleanDrops() {
    fs.emptyDir("drops", (err) => {
        if (err) {
            log(chalk.red("Couldn't delete drops/"), err);
        } else {
            log(chalk.magenta("Deleted drops/"));
        }
    });

    fs.emptyDir("artists", (err) => {
        if (err) {
            log(chalk.red("Couldn't delete artists/"), err);
        } else {
            log(chalk.magenta("Deleted artists/"));
        }
    });

    fs.emptyDir("prizes", (err) => {
        if (err) {
            log(chalk.red("Couldn't delete prizes/"), err);
        } else {
            log(chalk.magenta("Deleted prizes/"));
        }
    });

     try {
         if (fs.existsSync("drops.json")) {
            fs.rmSync("drops.json");
            log(chalk.magenta("Deleted drops.json"));
         }
     } catch (err) {
         if (err) {
             log(chalk.red("Couldn't delete drops.json"), err);
         }
     }
}