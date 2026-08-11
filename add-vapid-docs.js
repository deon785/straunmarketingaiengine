// add-vapid-docs.js
import fs from 'fs';
import path from 'path';

const docsDir = path.join(process.cwd(), 'docs');

const vapidContent = `# 🔑 VAPID Key Setup Guide

## What is VAPID?

VAPID (Voluntary Application Server Identification) is a specification that identifies the application server sending push notifications. It helps browsers verify that push messages come from legitimate sources.

### Why VAPID?
- ✅ Security - Prevents spoofing
- ✅ Authentication - Identifies sender
- ✅ Required for modern browsers (Chrome, Firefox, Edge)
- ✅ Needed for Web Push API

---

## 🔧 Generating VAPID Keys

### Method 1: Using web-push CLI (Recommended)

**Step 1: Install web-push globally**

\`\`\`bash
npm install -g web-push
\`\`\`

**Step 2: Generate keys**

\`\`\`bash
web-push generate-vapid-keys
\`\`\`

**Step 3: Save the output**

\`\`\`
Public Key:
BEl62iUYgUjKqnQvHwLQhC6wGqJCJmUGbqCnh1pLQcRV9GWgJ6PL6VVIJczGfVq6g
Private Key:
fH4E5Vr3MXyW9ZzJ3Kq2NxM6Pk8RtY7VbNcLqWpX8i
\`\`\`

### Method 2: Using web-push in Node.js

Create a \`generate-vapid.js\` file:

\`\`\`javascript
// generate-vapid.js
import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID Public Key:', vapidKeys.publicKey);
console.log('VAPID Private Key:', vapidKeys.privateKey);

// Save to .env
console.log('\\nAdd these to your .env file:');
console.log(\`VITE_VAPID_PUBLIC_KEY=\${vapidKeys.publicKey}\`);
console.log(\`VAPID_PRIVATE_KEY=\${vapidKeys.privateKey}\`);
\`\`\`

Run it:

\`\`\`bash
node generate-vapid.js
\`\`\`

### Method 3: Using web-push library in code

\`\`\`javascript
import webpush from 'web-push';

const vapidKeys = {
  publicKey: 'your-public-key',
  privateKey: 'your-private-key'
};

webpush.setVapidDetails(
  'mailto:deonmahachi8@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);
\`\`\`

---

## 📝 Environment Variables

### Add to .env

\`\`\`env
# VAPID Keys (for push notifications)
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:deonmahachi8@gmail.com

# Supabase Keys
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
\`\`\`

### In Supabase Edge Functions

Add these environment variables in Supabase Dashboard:

1. Go to **Edge Functions**
2. Select \`send-push-notifications\`
3. Click **Settings** → **Environment Variables**
4. Add:
   - \`VAPID_PUBLIC_KEY\`
   - \`VAPID_PRIVATE_KEY\`
   - \`VAPID_SUBJECT\`

---

## 🔐 Security Best Practices

### NEVER:
- ❌ Commit VAPID private key to GitHub
- ❌ Expose private key to the client
- ❌ Hard-code keys in source code
- ❌ Share private key with anyone

### ALWAYS:
- ✅ Use environment variables for keys
- ✅ Add \`.env\` to \`.gitignore\`
- ✅ Rotate keys if compromised
- ✅ Use different keys for dev/production

---

## 🧪 Testing VAPID Keys

### Test 1: Generate Subscription

\`\`\`javascript
// In browser console
navigator.serviceWorker.ready.then(reg => {
  const vapidPublicKey = 'your-public-key';
  
  reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  }).then(sub => {
    console.log('Subscription:', sub);
  }).catch(err => {
    console.error('Subscription failed:', err);
  });
});
\`\`\`

### Test 2: Send Test Notification

\`\`\`bash
# Using web-push CLI
web-push send-notification \
  --endpoint="https://fcm.googleapis.com/..." \
  --key="your-public-key" \
  --auth="your-auth-secret" \
  --payload="{\\"title\\":\\"Test\\",\\"body\\":\\"Hello!\\"}"
\`\`\`

### Test 3: Edge Function Test

\`\`\`bash
curl -X POST https://your-project.supabase.co/functions/v1/send-push-notifications \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "subscribe",
    "userId": "user-uuid-here",
    "subscription": {
      "endpoint": "your-endpoint-here",
      "keys": {
        "p256dh": "your-p256dh-here",
        "auth": "your-auth-here"
      }
    }
  }'
\`\`\`

---

## 🛠️ VAPID Key Rotation

### When to Rotate
- Keys are compromised
- Regular security audit (every 6-12 months)
- Team changes (member leaving)

### How to Rotate

1. **Generate new keys**
   \`\`\`bash
   web-push generate-vapid-keys
   \`\`\`

2. **Update environment variables**
   - Local: \`.env\`
   - Vercel/Netlify: Dashboard
   - Supabase: Edge Functions settings

3. **Deploy changes**
   - New keys take effect immediately
   - Existing subscriptions remain valid
   - No need to re-subscribe users

4. **Test notifications**
   - Send test notification
   - Verify delivery

---

## 🚨 Common VAPID Issues

### "Invalid VAPID key"

**Symptoms:**
- Push notifications fail
- Error: "Invalid VAPID key"

**Solutions:**
1. Check key format (base64url)
2. Check keys are correctly copied
3. Check no extra spaces/newlines
4. Re-generate keys if necessary

### "VAPID key expired"

**Symptoms:**
- Push notifications suddenly stop working
- Error: "VAPID key expired"

**Solutions:**
1. VAPID keys don't expire (they are permanent)
2. Check if keys were accidentally changed
3. Verify environment variables are correct

### "Subscription not valid"

**Symptoms:**
- User doesn't receive notifications
- Error: "Subscription expired or invalid"

**Solutions:**
1. User needs to re-subscribe
2. Check browser notification permissions
3. Check browser supports push

---

## 📋 VAPID Key Checklist

- [ ] Keys generated using \`web-push\`
- [ ] Public key in \`.env\` (\`VITE_VAPID_PUBLIC_KEY\`)
- [ ] Private key in \`.env\` (\`VAPID_PRIVATE_KEY\`)
- [ ] VAPID subject set (\`VAPID_SUBJECT\`)
- [ ] Keys added to Edge Function environment
- [ ] \`.env\` in \`.gitignore\`
- [ ] Test notification works
- [ ] Production keys different from development

---

## 🔗 Resources

- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8292)
- [VAPID Specification](https://tools.ietf.org/html/rfc8292)
- [Web-Push Library](https://github.com/web-push-libs/web-push)
- [Google Cloud Messaging](https://developers.google.com/web/fundamentals/push-notifications/)
`;

fs.writeFileSync(path.join(docsDir, 'VAPID_SETUP.md'), vapidContent);
console.log('✅ Created: docs/VAPID_SETUP.md');
console.log('\n🎉 VAPID setup guide complete!');