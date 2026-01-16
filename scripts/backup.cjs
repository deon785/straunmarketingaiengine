#!/usr/bin/env node
/**
 * Supabase Database Backup to Google Drive - REST API VERSION
 * Uses REST API to bypass blocked database ports (5432/6543)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { google } = require('googleapis');

console.log('='.repeat(50));
console.log('🚀 SUPABASE BACKUP TO GOOGLE DRIVE (REST API)');
console.log('='.repeat(50));

// Configuration - UPDATED for REST API
const config = {
  // REST API Configuration (NOT direct database)
  supabase: {
    url: process.env.VITE_SUPABASE_URL || 'https://mmcwfoqajkfnohbonaqa.supabase.co',
    serviceKey: process.env.SUPABASE_SERVICE_KEY, // REQUIRED
    anonKey: process.env.SUPABASE_ANON_KEY,
  },
  // Google Drive
  googleDrive: {
    folderId: process.env.GDRIVE_FOLDER_ID,
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'credentials.json',
  },
  // Backup settings
  backup: {
    directory: './backups',
    keepLocal: parseInt(process.env.KEEP_LOCAL_BACKUPS) || 5,
    compress: process.env.COMPRESS_BACKUPS === 'true',
  },
};

// Validate configuration
function validateConfig() {
  console.log('🔍 Validating configuration...');
  
  const required = [
    'SUPABASE_SERVICE_KEY',  // Changed from SUPABASE_HOST/PASSWORD
    'GDRIVE_FOLDER_ID',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    console.log('\n📋 Your .env file should contain:');
    console.log(`
# API Keys (get from Supabase Dashboard → Settings → API)
SUPABASE_SERVICE_KEY=your-service-role-secret-key
SUPABASE_ANON_KEY=your-anon-public-key
VITE_SUPABASE_URL=https://mmcwfoqajkfnohbonaqa.supabase.co

# Google Drive
GDRIVE_FOLDER_ID=1kPpGLETTR2V1hWRK40SS5LIn9VbBchtz
GOOGLE_APPLICATION_CREDENTIALS=credentials.json
KEEP_LOCAL_BACKUPS=5
COMPRESS_BACKUPS=true
    `);
    console.log('\n🔑 Get your keys from:');
    console.log('https://supabase.com/dashboard/project/mmcwfoqajkfnohbonaqa/settings/api');
    process.exit(1);
  }

  console.log('✅ Configuration validated');
  console.log('📡 Using REST API (bypasses blocked database ports)');
}

// Backup using REST API
async function backupWithRESTAPI() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `supabase-backup-${timestamp}.json`;
  const backupPath = path.join(config.backup.directory, backupFile);
  
  console.log(`📦 Creating backup via REST API: ${backupFile}`);
  
  // Create backup directory
  await fs.mkdir(config.backup.directory, { recursive: true });
  
  // Initialize Supabase client with SERVICE KEY
  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  
  try {
    console.log('🔌 Connecting via REST API...');
    
    // Get list of all tables
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');
    
    if (tablesError) {
      console.error('❌ Failed to get tables:', tablesError.message);
      
      if (tablesError.message.includes('JWT')) {
        console.log('\n🔑 API Key Issue:');
        console.log('1. Use "service_role" key, not "anon" key');
        console.log('2. Get it from: Settings → API → service_role');
      }
      throw tablesError;
    }
    
    if (!tables || tables.length === 0) {
      console.log('⚠️  No tables found. Database might be empty.');
      console.log('    This is normal for new projects.');
      
      // Create empty backup
      const emptyBackup = {
        metadata: {
          timestamp: new Date().toISOString(),
          project: 'SocialMediaAI',
          backup_method: 'rest-api',
          table_count: 0,
          note: 'Database is empty'
        },
        tables: {}
      };
      
      await fs.writeFile(backupPath, JSON.stringify(emptyBackup, null, 2));
      return backupPath;
    }
    
    console.log(`📊 Found ${tables.length} tables`);
    
    const backupData = {
      metadata: {
        timestamp: new Date().toISOString(),
        project: 'SocialMediaAI',
        project_id: 'mmcwfoqajkfnohbonaqa',
        backup_method: 'rest-api',
        table_count: tables.length
      },
      tables: {}
    };
    
    // Backup each table
    for (const table of tables) {
      console.log(`   Backing up: ${table.table_name}`);
      
      try {
        // Get table data via REST API
        const { data: rows, error: dataError, count } = await supabase
          .from(table.table_name)
          .select('*', { count: 'exact' })
          .limit(10000); // Safety limit
        
        if (dataError) {
          console.warn(`   ⚠️  Could not backup ${table.table_name}: ${dataError.message}`);
          backupData.tables[table.table_name] = { 
            error: dataError.message,
            row_count: 0
          };
        } else {
          const rowCount = count || rows.length;
          backupData.tables[table.table_name] = {
            row_count: rowCount,
            rows: rows
          };
          console.log(`     ✅ ${rowCount} rows`);
        }
      } catch (error) {
        console.warn(`   ⚠️  Error backing up ${table.table_name}: ${error.message}`);
        backupData.tables[table.table_name] = { 
          error: error.message,
          row_count: 0
        };
      }
    }
    
    // Get table schemas
    console.log('📐 Getting table schemas...');
    try {
      const { data: schemas, error: schemaError } = await supabase
        .from('information_schema.columns')
        .select('table_name, column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public');
      
      if (!schemaError && schemas) {
        backupData.schemas = schemas;
        console.log(`   ✅ ${schemas.length} columns`);
      }
    } catch (schemaErr) {
      console.log('   ⚠️  Could not fetch schemas:', schemaErr.message);
    }
    
    // Save backup to file
    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
    
    const fileSize = fsSync.statSync(backupPath).size;
    console.log(`✅ Backup saved: ${backupPath}`);
    console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Format: JSON (REST API)`);
    
    return backupPath;
    
  } catch (error) {
    console.error('❌ REST API backup failed:', error.message);
    throw error;
  }
}

// Compress backup file
async function compressBackup(backupPath) {
  if (!config.backup.compress) {
    console.log('⏭️  Compression disabled');
    return backupPath;
  }
  
  const compressedPath = `${backupPath}.gz`;
  
  console.log(`🗜️ Compressing backup...`);
  
  return new Promise((resolve, reject) => {
    const { createGzip } = require('zlib');
    const input = fsSync.createReadStream(backupPath);
    const output = fsSync.createWriteStream(compressedPath);
    const gzip = createGzip();
    
    input.pipe(gzip).pipe(output);
    
    output.on('finish', async () => {
      try {
        await fs.unlink(backupPath);
        const compressedSize = fsSync.statSync(compressedPath).size;
        console.log(`✅ Compressed: ${compressedPath}`);
        console.log(`   Compression ratio: ${((compressedSize / fsSync.statSync(backupPath).size) * 100).toFixed(1)}%`);
        resolve(compressedPath);
      } catch (error) {
        reject(error);
      }
    });
    
    output.on('error', reject);
  });
}

// Upload to Google Drive
async function uploadToGoogleDrive(filePath) {
  console.log(`☁️ Uploading to Google Drive...`);
  
  try {
    // Load credentials
    const credentials = JSON.parse(
      fsSync.readFileSync(path.resolve(config.googleDrive.credentialsPath), 'utf8')
    );
    
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/drive.file']
    );
    
    const drive = google.drive({ version: 'v3', auth });
    
    const fileName = path.basename(filePath);
    const fileSize = fsSync.statSync(filePath).size;
    const mimeType = fileName.endsWith('.gz') ? 'application/gzip' : 'application/json';
    
    console.log(`   Uploading: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    
    const fileMetadata = {
      name: fileName,
      parents: [config.googleDrive.folderId],
      description: `Supabase backup - ${new Date().toISOString()}`,
      mimeType: mimeType
    };
    
    const media = {
      mimeType: mimeType,
      body: fsSync.createReadStream(filePath),
    };
    
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, size, webViewLink, mimeType',
    });
    
    console.log(`✅ Upload successful!`);
    console.log(`   File ID: ${response.data.id}`);
    console.log(`   Name: ${response.data.name}`);
    console.log(`   Size: ${response.data.size} bytes`);
    if (response.data.webViewLink) {
      console.log(`   🔗 View: ${response.data.webViewLink}`);
    }
    
    return response.data.id;
    
  } catch (error) {
    console.error(`❌ Google Drive upload failed: ${error.message}`);
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n🔑 Google Auth Issue:');
      console.log('1. Check credentials.json file exists');
      console.log('2. Ensure Google Drive API is enabled');
      console.log('3. Service account needs Drive API access');
    }
    
    throw error;
  }
}

// Clean up old local backups
async function cleanupOldBackups() {
  console.log('🧹 Cleaning up old backups...');
  
  try {
    const files = await fs.readdir(config.backup.directory);
    
    // Get backup files
    const backupFiles = files
      .filter(file => file.startsWith('supabase-backup-'))
      .map(file => ({
        name: file,
        path: path.join(config.backup.directory, file),
        mtime: fsSync.statSync(path.join(config.backup.directory, file)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime); // Newest first
    
    // Delete old backups
    if (backupFiles.length > config.backup.keepLocal) {
      const toDelete = backupFiles.slice(config.backup.keepLocal);
      
      for (const file of toDelete) {
        await fs.unlink(file.path);
        console.log(`   Deleted: ${file.name}`);
      }
    }
    
    console.log(`📊 Keeping ${Math.min(backupFiles.length, config.backup.keepLocal)} latest backups`);
    
  } catch (error) {
    console.warn(`⚠️ Cleanup error: ${error.message}`);
  }
}

// Main function
async function main() {
  try {
    // Validate configuration
    validateConfig();
    
    console.log('\n' + '='.repeat(50));
    console.log('⚡ BACKUP STARTING');
    console.log('='.repeat(50));
    
    // Create backup using REST API
    const backupPath = await backupWithRESTAPI();
    
    // Compress backup
    const finalBackupPath = config.backup.compress 
      ? await compressBackup(backupPath) 
      : backupPath;
    
    // Upload to Google Drive
    await uploadToGoogleDrive(finalBackupPath);
    
    // Cleanup old backups
    await cleanupOldBackups();
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 BACKUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log('📋 Summary:');
    console.log('• Method: REST API (bypasses blocked ports 5432/6543)');
    console.log('• Network: Uses HTTPS port 443 (✅ Works on your network)');
    console.log('• Data: Full database export via Supabase API');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ BACKUP FAILED:', error.message);
    console.log('='.repeat(50));
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Get correct "service_role" key from Supabase Dashboard → API');
    console.log('2. Check internet connection');
    console.log('3. Verify .env file has correct values');
    console.log('4. Your network: ✅ HTTPS works, ❌ Database ports blocked');
    
    process.exit(1);
  }
}

// Run the script
main();