import { createRequestHandler } from "@remix-run/netlify";
import * as build from "../../build/server/index.js";

// Ensure Prisma client is properly initialized for serverless
let isInitialized = false;

const initializePrisma = async () => {
  if (!isInitialized) {
    try {
      // Force Prisma to initialize in serverless environment
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      await prisma.$connect();
      await prisma.$disconnect();
      isInitialized = true;
      console.log("Prisma client initialized successfully");
    } catch (error) {
      console.warn("Prisma initialization warning:", error.message);
      // Don't fail the function, just log the warning
    }
  }
};

const baseHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV || "production",
});

export const handler = async (event, context) => {
  // Initialize Prisma on cold start
  await initializePrisma();
  
  // Handle the request
  return baseHandler(event, context);
};