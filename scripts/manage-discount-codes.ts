/**
 * Admin utility script for managing discount codes
 *
 * Usage:
 * 1. Create a discount code:
 *    npx tsx scripts/manage-discount-codes.ts create WELCOME50 50 --maxUses 100 --description "Welcome bonus"
 *
 * 2. View a discount code:
 *    npx tsx scripts/manage-discount-codes.ts view WELCOME50
 *
 * 3. Deactivate a discount code:
 *    npx tsx scripts/manage-discount-codes.ts deactivate WELCOME50
 *
 * 4. List all discount codes:
 *    npx tsx scripts/manage-discount-codes.ts list
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createDiscountCode(
  code: string,
  credits: number,
  options: {
    maxUses?: number;
    expiresAt?: Date;
    description?: string;
  } = {}
) {
  try {
    const normalizedCode = code.toUpperCase().trim();

    const discountCode = await prisma.discountCode.create({
      data: {
        code: normalizedCode,
        creditsToGrant: credits,
        maxUses: options.maxUses,
        expiresAt: options.expiresAt,
        description: options.description,
      },
    });

    console.log("✅ Discount code created successfully!");
    console.log(JSON.stringify(discountCode, null, 2));
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      console.error("❌ Error: A discount code with this name already exists");
    } else {
      console.error("❌ Error creating discount code:", error);
    }
  }
}

async function viewDiscountCode(code: string) {
  try {
    const normalizedCode = code.toUpperCase().trim();

    const discountCode = await prisma.discountCode.findUnique({
      where: { code: normalizedCode },
      include: {
        redemptions: {
          select: {
            shop: true,
            creditsGranted: true,
            redeemedAt: true,
          },
        },
      },
    });

    if (!discountCode) {
      console.error("❌ Discount code not found");
      return;
    }

    console.log("📋 Discount Code Details:");
    console.log(JSON.stringify(discountCode, null, 2));
  } catch (error) {
    console.error("❌ Error viewing discount code:", error);
  }
}

async function deactivateDiscountCode(code: string) {
  try {
    const normalizedCode = code.toUpperCase().trim();

    const discountCode = await prisma.discountCode.update({
      where: { code: normalizedCode },
      data: { isActive: false },
    });

    console.log("✅ Discount code deactivated successfully!");
    console.log(JSON.stringify(discountCode, null, 2));
  } catch (error) {
    console.error("❌ Error deactivating discount code:", error);
  }
}

async function listDiscountCodes() {
  try {
    const discountCodes = await prisma.discountCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
    });

    console.log(`📋 Found ${discountCodes.length} discount codes:\n`);

    discountCodes.forEach((code) => {
      const status = code.isActive ? "✅ Active" : "❌ Inactive";
      const expired = code.expiresAt && new Date() > code.expiresAt ? " (EXPIRED)" : "";
      const uses = code.maxUses
        ? `${code.currentUses}/${code.maxUses} uses`
        : `${code.currentUses} uses`;

      console.log(`${status} ${code.code}${expired}`);
      console.log(`  Credits: ${code.creditsToGrant}`);
      console.log(`  Usage: ${uses}`);
      console.log(`  Redemptions: ${code._count.redemptions}`);
      if (code.description) {
        console.log(`  Description: ${code.description}`);
      }
      if (code.expiresAt) {
        console.log(`  Expires: ${code.expiresAt.toISOString()}`);
      }
      console.log();
    });
  } catch (error) {
    console.error("❌ Error listing discount codes:", error);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (!command) {
    console.log("Usage: npx tsx scripts/manage-discount-codes.ts <command> [args]");
    console.log("\nCommands:");
    console.log("  create <code> <credits> [--maxUses <n>] [--expiresAt <date>] [--description <text>]");
    console.log("  view <code>");
    console.log("  deactivate <code>");
    console.log("  list");
    process.exit(1);
  }

  switch (command) {
    case "create": {
      const code = args[1];
      const credits = parseInt(args[2], 10);

      if (!code || isNaN(credits)) {
        console.error("❌ Usage: create <code> <credits> [options]");
        process.exit(1);
      }

      // Parse options
      const options: {
        maxUses?: number;
        expiresAt?: Date;
        description?: string;
      } = {};

      for (let i = 3; i < args.length; i++) {
        if (args[i] === "--maxUses" && args[i + 1]) {
          options.maxUses = parseInt(args[i + 1], 10);
          i++;
        } else if (args[i] === "--expiresAt" && args[i + 1]) {
          options.expiresAt = new Date(args[i + 1]);
          i++;
        } else if (args[i] === "--description" && args[i + 1]) {
          options.description = args[i + 1];
          i++;
        }
      }

      await createDiscountCode(code, credits, options);
      break;
    }

    case "view": {
      const code = args[1];
      if (!code) {
        console.error("❌ Usage: view <code>");
        process.exit(1);
      }
      await viewDiscountCode(code);
      break;
    }

    case "deactivate": {
      const code = args[1];
      if (!code) {
        console.error("❌ Usage: deactivate <code>");
        process.exit(1);
      }
      await deactivateDiscountCode(code);
      break;
    }

    case "list": {
      await listDiscountCodes();
      break;
    }

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log("\nAvailable commands: create, view, deactivate, list");
      process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
