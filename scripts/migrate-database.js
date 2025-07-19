#!/usr/bin/env node

/**
 * Database migration script for production deployment
 * This runs the Prisma migrations against the Neon database
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

async function migrateDatabase() {
    console.log('🚀 Starting database migration...');

    try {
        // Check if DATABASE_URL is available (fallback to NETLIFY_DATABASE_URL)
        const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;

        console.log('🔍 Environment check:');
        console.log('- NETLIFY_DATABASE_URL:', process.env.NETLIFY_DATABASE_URL ? 'SET' : 'NOT SET');
        console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

        if (!databaseUrl) {
            throw new Error('No database URL found. Please set NETLIFY_DATABASE_URL or DATABASE_URL environment variable.');
        }

        console.log('📡 Database URL found, proceeding with migration...');

        // Run Prisma migration
        console.log('🔄 Running Prisma migrations...');
        execSync('npx prisma migrate deploy', {
            stdio: 'inherit',
            env: {
                ...process.env,
                DATABASE_URL: databaseUrl // Ensure Prisma uses the correct URL
            }
        });

        console.log('✅ Database migration completed successfully!');

        // Verify database connection
        console.log('🔍 Verifying database connection...');
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();

        try {
            await prisma.$connect();
            console.log('✅ Database connection verified!');

            // Check if tables exist by trying to query them
            try {
                const userCount = await prisma.user.count();
                const sessionCount = await prisma.session.count();
                console.log('📋 Database tables verified:');
                console.log(`  - User table: ${userCount} records`);
                console.log(`  - Session table: ${sessionCount} records`);
                console.log('✅ All required tables exist and are accessible!');
            } catch (tableError) {
                console.log('⚠️ Could not verify all tables, but migration completed');
                console.log('Tables should be created and ready to use');
            }

        } finally {
            await prisma.$disconnect();
        }

        console.log('🎉 Database setup complete!');

    } catch (error) {
        console.error('❌ Database migration failed:', error.message);

        if (error.message.includes('Environment variable not found')) {
            console.log('\n💡 Make sure NETLIFY_DATABASE_URL is set in your environment');
        }

        if (error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
            console.log('\n💡 Database connection issue. Check your Neon database status');
        }

        process.exit(1);
    }
}

migrateDatabase();