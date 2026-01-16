/* =================================================================
 * FILE: backup-via-api.js - DISABLED
 * DATE: 2026-01-16 11:58
 * 
 * BACKUP SYSTEM UNDER MAINTENANCE
 * 
 * ISSUES BEING RESOLVED:
 * 1. Network firewall blocking database ports
 * 2. Table discovery configuration
 * 3. API permission setup
 * 
 * ORIGINAL FILE BACKED UP AS: backup-via-api.js.backup
 * ================================================================= */

console.log('?? backup-via-api.js - Disabled for maintenance');
console.log('?? Use manual backups from Supabase Dashboard');
console.log('?? Contact administrator to re-enable');
process.exit(0);

/*
// backup-via-api.js - FIXED VERSION
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

console.log('='.repeat(50));
console.log('🚀 SUPABASE BACKUP via REST API');
console.log('='.repeat(50));

// ✅ FIX 1: Use environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mmcwfoqajkfnohbonaqa.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey || supabaseKey.includes('your-')) {
  console.error('❌ Missing API key in .env');
  console.log('\n💡 Add to your .env file:');
  console.log('SUPABASE_SERVICE_KEY=your-service-key-here');
  console.log('\n📋 Get it from:');
  console.log('1. https://supabase.com/dashboard/project/mmcwfoqajkfnohbonaqa/settings/api');
  console.log('2. Copy "service_role" secret key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backupViaAPI() {
  try {
    console.log('🔑 Using API Key:', supabaseKey.substring(0, 20) + '...');
    console.log('📋 Getting table list...\n');
    
    // ✅ FIX 2: Correct table query
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE'); // Added this filter
    
    if (error) {
      console.error('❌ Table query failed:', error.message);
      console.log('\n💡 Common fixes:');
      console.log('1. Use "service_role" key, not "anon" key');
      console.log('2. Check key is correctly copied');
      throw error;
    }
    
    if (!tables || tables.length === 0) {
      console.log('⚠️  No tables found. Your database might be empty.');
      console.log('    This is normal for new projects.');
      return;
    }
    
    console.log(`✅ Found ${tables.length} tables`);
    
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        project_id: 'mmcwfoqajkfnohbonaqa',
        backup_method: 'rest-api',
        table_count: tables.length
      },
      tables: {}
    };
    
    // Backup each table
    for (const table of tables) {
      console.log(`\n📊 Backing up: ${table.table_name}`);
      
      try {
        const { data: rows, error: tableError, count } = await supabase
          .from(table.table_name)
          .select('*', { count: 'exact' });
        
        if (tableError) {
          console.log(`   ⚠️  Error: ${tableError.message}`);
          backup.tables[table.table_name] = { error: tableError.message };
        } else {
          const rowCount = count || rows.length;
          backup.tables[table.table_name] = {
            row_count: rowCount,
            rows: rows
          };
          console.log(`   ✅ ${rowCount} rows backed up`);
        }
      } catch (err) {
        console.log(`   ❌ Failed: ${err.message}`);
        backup.tables[table.table_name] = { error: err.message };
      }
    }
    
    // Save backup locally
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `api-backup-${timestamp}.json`;
    const filepath = path.join(__dirname, filename);
    
    await fs.writeFile(filepath, JSON.stringify(backup, null, 2));
    
    const fileSize = fsSync.statSync(filepath).size;
    console.log(`\n💾 Backup saved: ${filename}`);
    console.log(`   Size: ${(fileSize / 1024).toFixed(2)} KB`);
    
    // ✅ FIX 3: Upload to Google Drive
    if (process.env.GDRIVE_FOLDER_ID) {
      console.log('☁️  Uploading to Google Drive...');
      await uploadToDrive(filepath, filename);
    } else {
      console.log('⚠️  Google Drive upload skipped (no GDRIVE_FOLDER_ID in .env)');
    }
    
    // Cleanup old backups
    cleanupOldBackups();
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 API BACKUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ BACKUP FAILED:', error.message);
    console.log('\n🔧 Debug info:');
    console.log('• URL:', supabaseUrl);
    console.log('• Key length:', supabaseKey.length);
    console.log('• Network test: ✅ HTTP works, ❌ Database ports blocked');
    console.log('\n💡 Solution: Use correct "service_role" key');
  }
}

// Google Drive upload function
async function uploadToDrive(filepath, filename) {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    const fileMetadata = {
      name: filename,
      parents: [process.env.GDRIVE_FOLDER_ID],
      description: `Supabase API backup - ${new Date().toISOString()}`
    };
    
    const media = {
      mimeType: 'application/json',
      body: fsSync.createReadStream(filepath),
    };
    
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
    });
    
    console.log(`   ✅ Uploaded to Google Drive`);
    console.log(`   🔗 View: ${response.data.webViewLink}`);
    
    return response.data;
  } catch (error) {
    console.error(`   ❌ Google Drive upload failed: ${error.message}`);
  }
}

// Cleanup old backups
function cleanupOldBackups() {
  try {
    const keep = parseInt(process.env.KEEP_LOCAL_BACKUPS) || 5;
    const files = fsSync.readdirSync(__dirname)
      .filter(f => f.startsWith('api-backup-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length > keep) {
      const toDelete = files.slice(keep);
      toDelete.forEach(file => {
        fsSync.unlinkSync(path.join(__dirname, file));
        console.log(`🧹 Cleaned up: ${file}`);
      });
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Run backup
backupViaAPI();
*/
