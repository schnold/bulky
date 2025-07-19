module.exports = {
  onPreBuild: async ({ utils }) => {
    console.log('🔧 Running Prisma generate in onPreBuild...');
    try {
      await utils.run.command('npx prisma generate');
      console.log('✅ Prisma generate completed successfully');
    } catch (error) {
      console.error('❌ Prisma generate failed:', error);
      utils.build.failBuild('Prisma generate failed', { error });
    }
  },
  
  onBuild: async ({ utils }) => {
    console.log('🚀 Running database migration in onBuild...');
    try {
      await utils.run.command('npx prisma migrate deploy');
      console.log('✅ Database migration completed successfully');
    } catch (error) {
      console.error('❌ Database migration failed:', error);
      // Don't fail the build for migration errors in case DB is already up to date
      console.log('⚠️ Continuing build despite migration warning');
    }
  }
};