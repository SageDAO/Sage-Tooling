const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.rewardType.upsert({
    where: { type: 'ETH_MEMEINU' },
    update: {},
    create: {
      type: 'ETH_MEMEINU',
      chainId: 1,
      rewardRate: 0.00000000000000000001157407407407407407,
      contract: '0x74b988156925937bd4e082f0ed7429da8eaea8db',
      startingBlock: 13649693,
      lastBlockInspected: 13942339,
      positionSizeLimit: "100000000000000000000000"
    }
  });

  await prisma.rewardType.upsert({
    where: { type: 'FTM_MEMEINU' },
    update: {},
    create: {
      type: 'FTM_MEMEINU',
      chainId: 250,
      rewardRate: 0.00000000000000000001157407407407407407,
      contract: '0xd1790c5435b9fb7c9444c749cefe53d40d751eac',
      startingBlock: 22976955,
      lastBlockInspected: 27015508,
      positionSizeLimit: "100000000000000000000000"
    }
  });

  await prisma.rewardType.upsert({
    where: { type: 'FTM_LIQUIDITY' },
    update: {},
    create: {
      type: 'FTM_LIQUIDITY',
      chainId: 250,
      rewardRate: 0.0, // waiting for a response from the team
      contract: '0x230319cbd36fd911c5537254c99613b447b8a178',
      startingBlock: 25732987,
      lastBlockInspected: 27015508,
      positionSizeLimit: "100000000000000000000000"
    }
  });
  
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
