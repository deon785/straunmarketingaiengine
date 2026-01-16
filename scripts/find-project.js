/* =================================================================
 * FILE: find-project.js - DISABLED
 * DATE: 2026-01-16 11:58
 * 
 * BACKUP SYSTEM UNDER MAINTENANCE
 * 
 * ISSUES BEING RESOLVED:
 * 1. Network firewall blocking database ports
 * 2. Table discovery configuration
 * 3. API permission setup
 * 
 * ORIGINAL FILE BACKED UP AS: find-project.js.backup
 * ================================================================= */

console.log('?? find-project.js - Disabled for maintenance');
console.log('?? Use manual backups from Supabase Dashboard');
console.log('?? Contact administrator to re-enable');
process.exit(0);

/*
// find-project.js - UPDATED for Session Pooler Discovery
const https = require('https');
const { Client } = require('pg');

console.log('🔍 Finding your Supabase project...\n');

// Your current credentials (from .env)
const DB_PASSWORD = process.env.SUPABASE_PASSWORD || '@Mahachi2004';
const REF_ID = 'mmcwfoqajkfnohbonaqa';

// Test BOTH direct AND session pooler connections
const testConfigs = [
  // Direct connection (IPv6 - may not work on your network)
  {
    name: 'Direct IPv6',
    host: `db.${REF_ID}.supabase.co`,
    port: 5432,
    user: 'postgres',
    type: 'direct'
  },
  // Session Pooler options (IPv4 compatible)
  {
    name: 'Session Pooler US West',
    host: 'aws-0-us-west-1.pooler.supabase.co',
    port: 6543,
    user: `postgres.${REF_ID}`,
    type: 'pooler'
  },
  {
    name: 'Session Pooler US East',
    host: 'aws-0-us-east-1.pooler.supabase.co',
    port: 6543,
    user: `postgres.${REF_ID}`,
    type: 'pooler'
  },
  {
    name: 'Session Pooler EU West',
    host: 'aws-0-eu-west-1.pooler.supabase.co',
    port: 6543,
    user: `postgres.${REF_ID}`,
    type: 'pooler'
  }
];

async function testDatabaseConnection(config) {
  console.log(`Testing: ${config.name}`);
  console.log(`  Host: ${config.host}:${config.port}`);
  console.log(`  User: ${config.user}`);
  
  const client = new Client({
    host: config.host,
    port: config.port,
    database: 'postgres',
    user: config.user,
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  try {
    await client.connect();
    const result = await client.query('SELECT NOW() as time');
    console.log(`  ✅ SUCCESS! Server time: ${result.rows[0].time}`);
    
    // Get some database info
    const dbInfo = await client.query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`  📊 Tables in database: ${dbInfo.rows[0].table_count}`);
    
    await client.end();
    return { success: true, config };
    
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}`);
    await client.end().catch(() => {});
    return { success: false, error: error.message };
  }
}

async function testHostAvailability(host) {
  return new Promise((resolve) => {
    console.log(`Checking host availability: ${host}`);
    
    const req = https.get(`https://${host}`, { timeout: 5000 }, (res) => {
      console.log(`  ✅ Host responds (HTTP ${res.statusCode})`);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.log(`  ❌ Host unreachable: ${err.code}`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('  ⏱️ Timeout');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function discoverProject() {
  console.log('='.repeat(50));
  console.log('PHASE 1: Testing host availability...\n');
  
  // First check if hosts are reachable
  const uniqueHosts = [...new Set(testConfigs.map(c => c.host))];
  for (const host of uniqueHosts) {
    await testHostAvailability(host);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('PHASE 2: Testing database connections...\n');
  
  // Test each database connection
  let workingConfig = null;
  
  for (const config of testConfigs) {
    const result = await testDatabaseConnection(config);
    if (result.success) {
      workingConfig = config;
      break; // Stop at first success
    }
    console.log(''); // Empty line between tests
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (workingConfig) {
    console.log('🎉 FOUND WORKING CONNECTION!');
    console.log(`\n💡 Use in your .env file:`);
    console.log(`SUPABASE_HOST=${workingConfig.host}`);
    console.log(`SUPABASE_PORT=${workingConfig.port}`);
    console.log(`SUPABASE_USER=${workingConfig.user}`);
    console.log(`SUPABASE_PASSWORD=${DB_PASSWORD}`);
    console.log(`SUPABASE_DATABASE=postgres`);
    
    console.log('\n📋 Backup script should work with these settings.');
  } else {
    console.log('❌ No working connection found.');
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check password is correct in .env');
    console.log('2. Your network may block port 5432/6543');
    console.log('3. Try different network (mobile hotspot)');
    console.log('4. Purchase IPv4 add-on in Supabase dashboard');
    
    console.log('\n📖 From your Supabase dashboard screenshot:');
    console.log('• Click "IPv4 add-on" to enable IPv4 support');
    console.log('• Or use Session Pooler with correct region');
  }
}

// Check if password is set
if (!DB_PASSWORD || DB_PASSWORD === '@Mahachi2004') {
  console.log('⚠️  Warning: Using default password');
  console.log('   Make sure your .env has SUPABASE_PASSWORD=@Mahachi2004');
}

discoverProject();
*/
