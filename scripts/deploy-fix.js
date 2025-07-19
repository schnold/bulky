#!/usr/bin/env node

console.log("🔧 Fixing database configuration and redeploying...");

const { execSync } = require('child_process');

try {
  console.log("📦 Regenerating Prisma client...");
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log("🏗️ Building application...");
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log("✅ Build complete! Now deploy to Netlify:");
  console.log("   1. Commit your changes: git add . && git commit -m 'Fix database configuration'");
  console.log("   2. Push to trigger deployment: git push");
  console.log("   3. Or manually deploy via Netlify dashboard");
  
} catch (error) {
  console.error("❌ Error during build:", error.message);
  process.exit(1);
}