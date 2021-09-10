import pkg from '@prisma/client';
import fs from 'fs-extra';

const { PrismaClient } = pkg;

const prisma = new PrismaClient()

async function save(drop) {
  let nftsAsData = [];

    drop.nfts.forEach(nft => {
      nftsAsData.push({
        name: nft.name,
        description: nft.description,
        rarity: nft.rarity,
        ipfsPath: nft.ipfsPath
      });
    });

    const someDrop = await prisma.drop.create({
      data: {
        lotteryId: drop.lotteryId,
        bannerImagePath: drop.banner.path,
        bannerImageName: drop.banner.name,
        metadataPath: drop.metaDataPath,
        costPerTicket: drop.costPerTicket,
        prizeIds: drop.prizeIds,
        prizeMetadataCid: drop.prizeMetadataCid,
        startTime: drop.startTime,
        endTime: drop.endTime,
        artistName: drop.artistName,
        dropName: drop.dropName,
        dropDescription: drop.dropDescription,
        nfts: {
          createMany: {
            data: nftsAsData
          }
        }
      }
    });

    return someDrop;
}

async function main() {
  const dropsJson = JSON.parse(fs.readFileSync('drops.json', 'utf8'));
  const dropsAsData = [];

  for (const drop of dropsJson) {
    let nftsAsData = [];

    drop.nfts.forEach(nft => {
      nftsAsData.push({
        name: nft.name,
        IpfsPath: nft.path
      });
    });

    let dropData = {
      lotteryId: drop.lotteryId,
      bannerImagePath: drop.banner.path,
      bannerImageName: drop.banner.name,
      metadataPath: drop.metaDataPath,
      costPerTicket: drop.costPerTicket,
      prizeIds: drop.prizeIds,
      prizeMetadataCid: drop.prizeMetadataCid,
      startTime: drop.startTime,
      endTime: drop.endTime,
      artistName: drop.artistName,
      dropName: drop.dropName,
      dropDescription: drop.dropDescription,
      nfts: {
        createMany: {
          data: nftsAsData
        }
      }
    };

    dropsAsData.push(dropData);

    const someDrop = await save(drop);

    console.log('someDrop was saved: ', someDrop);
  }

  console.log('done saving drops to db...');

  const drops = await prisma.drop.findMany({
    include: {
      nfts: true
    }
  });
  console.log('drops: ', drops);

  prisma.$disconnect();
}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })