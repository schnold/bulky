/**
 * Test script to verify one-use-per-account constraint
 *
 * This script tests that:
 * 1. A shop can redeem a code once successfully
 * 2. The same shop cannot redeem the same code again
 * 3. A different shop can still use the same code
 */

import { PrismaClient } from "@prisma/client";
import { redeemDiscountCode } from "../app/models/user.server";

const prisma = new PrismaClient();

async function testOneUsePerAccount() {
  const testShop1 = "test-shop-1.myshopify.com";
  const testShop2 = "test-shop-2.myshopify.com";
  const testCode = "WELCOME50";

  console.log("\n🧪 Testing One-Use-Per-Account Constraint\n");
  console.log("=" .repeat(50));

  // Ensure test shops exist
  console.log("\n1️⃣ Setting up test shops...");

  await prisma.user.upsert({
    where: { shop: testShop1 },
    create: { shop: testShop1, plan: "free", credits: 10 },
    update: {},
  });

  await prisma.user.upsert({
    where: { shop: testShop2 },
    create: { shop: testShop2, plan: "free", credits: 10 },
    update: {},
  });

  console.log("✅ Test shops created");

  // Clean up any existing redemptions for these test shops
  console.log("\n2️⃣ Cleaning up any previous test redemptions...");
  const discountCode = await prisma.discountCode.findUnique({
    where: { code: testCode },
  });

  if (discountCode) {
    await prisma.discountCodeRedemption.deleteMany({
      where: {
        discountCodeId: discountCode.id,
        shop: { in: [testShop1, testShop2] },
      },
    });
    console.log("✅ Previous redemptions cleaned up");
  }

  // Test 1: First redemption should succeed
  console.log("\n3️⃣ Test 1: First redemption (Shop 1)");
  console.log("   Attempting to redeem:", testCode);

  const result1 = await redeemDiscountCode(testCode, testShop1);

  if (result1.success) {
    console.log("   ✅ SUCCESS - Code redeemed successfully");
    console.log(`   Credits granted: ${result1.creditsGranted}`);
    console.log(`   New balance: ${result1.newBalance}`);
  } else {
    console.log("   ❌ FAILED -", result1.error);
  }

  // Test 2: Second redemption by same shop should FAIL
  console.log("\n4️⃣ Test 2: Second redemption attempt (Shop 1 - same shop)");
  console.log("   Attempting to redeem:", testCode);

  const result2 = await redeemDiscountCode(testCode, testShop1);

  if (!result2.success) {
    console.log("   ✅ CORRECTLY REJECTED");
    console.log(`   Error message: "${result2.error}"`);

    if (result2.error === "You have already used this discount code") {
      console.log("   ✅ Correct error message");
    } else {
      console.log("   ⚠️  Unexpected error message");
    }
  } else {
    console.log("   ❌ SECURITY ISSUE - Code was redeemed twice by same shop!");
    console.log("   This should not happen!");
  }

  // Test 3: Different shop should be able to use the same code
  console.log("\n5️⃣ Test 3: Redemption by different shop (Shop 2)");
  console.log("   Attempting to redeem:", testCode);

  const result3 = await redeemDiscountCode(testCode, testShop2);

  if (result3.success) {
    console.log("   ✅ SUCCESS - Different shop can use the code");
    console.log(`   Credits granted: ${result3.creditsGranted}`);
    console.log(`   New balance: ${result3.newBalance}`);
  } else {
    console.log("   ❌ FAILED -", result3.error);
  }

  // Test 4: Shop 2 tries to redeem again
  console.log("\n6️⃣ Test 4: Second redemption attempt (Shop 2 - same shop)");
  console.log("   Attempting to redeem:", testCode);

  const result4 = await redeemDiscountCode(testCode, testShop2);

  if (!result4.success) {
    console.log("   ✅ CORRECTLY REJECTED");
    console.log(`   Error message: "${result4.error}"`);
  } else {
    console.log("   ❌ SECURITY ISSUE - Code was redeemed twice by same shop!");
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("\n📊 Test Summary:");
  console.log("   Test 1 (First redemption):    ", result1.success ? "✅ PASS" : "❌ FAIL");
  console.log("   Test 2 (Duplicate attempt):   ", !result2.success ? "✅ PASS" : "❌ FAIL");
  console.log("   Test 3 (Different shop):      ", result3.success ? "✅ PASS" : "❌ FAIL");
  console.log("   Test 4 (Duplicate attempt):   ", !result4.success ? "✅ PASS" : "❌ FAIL");

  const allPassed = result1.success && !result2.success && result3.success && !result4.success;

  console.log("\n" + "=".repeat(50));
  if (allPassed) {
    console.log("🎉 ALL TESTS PASSED - One-use-per-account is properly enforced!");
  } else {
    console.log("⚠️  SOME TESTS FAILED - Please review the implementation");
  }
  console.log("=".repeat(50) + "\n");

  // Clean up test data
  console.log("Cleaning up test data...");
  if (discountCode) {
    await prisma.discountCodeRedemption.deleteMany({
      where: {
        discountCodeId: discountCode.id,
        shop: { in: [testShop1, testShop2] },
      },
    });
  }

  // Reset credits to original values
  await prisma.user.update({
    where: { shop: testShop1 },
    data: { credits: 10 },
  });

  await prisma.user.update({
    where: { shop: testShop2 },
    data: { credits: 10 },
  });

  console.log("✅ Cleanup complete\n");
}

async function main() {
  try {
    await testOneUsePerAccount();
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
