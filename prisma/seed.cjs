const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.rewardType.upsert({
    where: { type: 'ETH_MEMEINU' },
    update: {},
    create: {
      type: 'ETH_MEMEINU',
      chainId: 1,
      rewardRate: 1.1574074074074073e-28,
      contract: '0x74b988156925937bd4e082f0ed7429da8eaea8db',
      startingBlock: 13649693,
      lastBlockInspected: 13649692,
      positionSizeLimit: "100000000000000000000000"
    }
  });

  await prisma.rewardType.upsert({
    where: { type: 'FTM_MEMEINU' },
    update: {},
    create: {
      type: 'FTM_MEMEINU',
      chainId: 250,
      rewardRate: 1.1574074074074073e-28,
      contract: '0xd1790c5435b9fb7c9444c749cefe53d40d751eac',
      startingBlock: 22976955,
      lastBlockInspected: 22976954,
      positionSizeLimit: "100000000000000000000000"
    }
  });

  await prisma.rewardType.upsert({
    where: { type: 'FTM_LIQUIDITY' },
    update: {},
    create: {
      type: 'FTM_LIQUIDITY',
      chainId: 250,
      rewardRate: 5.32301549069e-27,
      contract: '0x230319cbd36fd911c5537254c99613b447b8a178',
      startingBlock: 25732987,
      lastBlockInspected: 25732986,
      positionSizeLimit: "100000000000000000000000"
    }
  });

  await prisma.user.upsert({
    where: { walletAddress: '0x58a26F4048CdFd3785aD2139AeD336595af22fF5' },
    update: {},
    create: {
      walletAddress: '0x58a26F4048CdFd3785aD2139AeD336595af22fF5',
      createdAt: new Date(),
      role: 'ADMIN',
      bio: 'MemeX Dev',

    }
  })

  await prisma.$queryRaw`CREATE UNIQUE INDEX wallet_unique_idx ON public."User" (LOWER("walletAddress"));`;
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
