import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

// Optimized for serverless environments
let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  // In production (Netlify), optimize for serverless
  // Create a new instance each time to avoid connection pool issues
  prisma = new PrismaClient({
    log: ['error'],
    datasources: {
      db: {
        url: process.env.NETLIFY_DATABASE_URL,
      },
    },
  });
  
  // Automatically disconnect after each request in serverless
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
} else {
  // In development, use global to avoid multiple instances
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  prisma = global.prismaGlobal;
}

export default prisma;
