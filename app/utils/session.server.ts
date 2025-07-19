import prisma from "../db.server";

export async function ensureSessionExists(shop: string) {
  const normalizedShop = shop.trim().toLowerCase();
  
  // Check if session already exists
  const existingSession = await prisma.session.findFirst({
    where: { shop: normalizedShop }
  });
  
  if (existingSession) {
    console.log(`✅ Session already exists for shop: ${normalizedShop}`);
    return existingSession;
  }
  
  console.log(`🔐 Creating session for shop: ${normalizedShop}`);
  
  // Create a basic session for the shop
  const sessionId = `offline_${normalizedShop}`;
  const session = await prisma.session.create({
    data: {
      id: sessionId,
      shop: normalizedShop,
      state: 'authenticated',
      isOnline: false,
      scope: 'write_products',
      accessToken: `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: BigInt(Math.floor(Math.random() * 1000000)),
      firstName: 'Shop',
      lastName: 'Owner',
      email: `owner@${normalizedShop}`,
      accountOwner: true,
      locale: 'en',
      collaborator: false,
      emailVerified: true,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    }
  });
  
  console.log(`✅ Created session for shop: ${normalizedShop}`);
  return session;
}

export async function ensureUserAndSession(shop: string, includeKeywords = false) {
  const normalizedShop = shop.trim().toLowerCase();
  
  // First ensure session exists
  await ensureSessionExists(normalizedShop);
  
  // Then ensure user exists (this will create user if needed)
  const { ensureUserExists } = await import("./db.server");
  const user = await ensureUserExists(normalizedShop, includeKeywords);
  
  return user;
}