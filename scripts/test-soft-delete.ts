import mongoose, { Schema } from 'mongoose';
import fs from 'fs';
import path from 'path';

// Try to load .env.local if it exists, otherwise rely on MONGODB_URI already in the environment
const envPath = path.join(__dirname, '../main-app/.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...values] = trimmed.split('=');
            if (key) process.env[key.trim()] = values.join('=').trim().replace(/^"|"$/g, '');
        }
    }
}

// Import the plugin directly (bypasses Next.js @/ aliases used in actual models)
import { basePlugin } from '../main-app/lib/db/plugins/basePlugin';

// Create a mock schema specifically to test the plugin without relying on the app's complex file tree
const DummyUserSchema = new Schema({
    email: String,
    firstName: String,
});
DummyUserSchema.plugin(basePlugin);
const DummyUserModel = mongoose.models.DummyUser || mongoose.model('DummyUser', DummyUserSchema);

async function runTest() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log('✅ Connected.');

        // 1. Create a dummy user
        console.log('\n👤 Creating a dummy user...');
        const user = await DummyUserModel.create({
            email: `test-delete-${Date.now()}@example.com`,
            firstName: 'Delete Context',
        });
        console.log(`✅ Created test user ${user.email} (ID: ${user._id})`);

        // 2. Soft delete the user
        console.log('\n🗑️  Soft deleting the user...');
        // @ts-ignore
        await user.softDelete();
        console.log('✅ User isDeleted flag set to true via softDelete()');

        // 3. Test standard query (should hide the user)
        console.log('\n🔍 Running: await DummyUserModel.find({ email: user.email })');
        const standardQuery = await DummyUserModel.find({ email: user.email }).lean();
        console.log(`Results found: ${standardQuery.length}`);
        if (standardQuery.length === 0) {
            console.log('✅ SUCCESS: Deleted user was NOT returned (plugin works!).');
        } else {
            console.log('❌ FAILURE: Deleted user was returned.');
        }

        // 4. Test escape hatch query (should reveal the user)
        console.log('\n🔍 Running: await DummyUserModel.find({ email: user.email, includeDeleted: true })');
        const bypassQuery = await DummyUserModel.find({ email: user.email, includeDeleted: true } as any).lean();
        console.log(`Results found: ${bypassQuery.length}`);
        if (bypassQuery.length > 0) {
            console.log('✅ SUCCESS: Deleted user WAS returned using escape hatch.');
            if (('includeDeleted' in bypassQuery[0])) {
                console.log('❌ FAILURE: includeDeleted flag leaked into the returned query.');
            } else {
                console.log('✅ SUCCESS: includeDeleted flag was successfully stripped from the database query.');
            }
        } else {
            console.log('❌ FAILURE: Deleted user was NOT returned despite escape hatch.');
        }

    } catch (err) {
        console.error('Error during test:', err);
    } finally {
        await DummyUserModel.deleteMany({ email: { $regex: /^test-delete-/ } });
        await mongoose.disconnect();
        console.log('\nCleanup complete. Exiting.');
    }
}

runTest();
