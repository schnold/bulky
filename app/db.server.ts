import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

// Create a single instance for serverless environments
let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  // In production (Netlify), create a new instance each time
  prisma = new PrismaClient({
    log: ['error'],
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
