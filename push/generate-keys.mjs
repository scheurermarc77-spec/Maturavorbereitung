// Generate VAPID keys locally (never publish the private key).
import { createECDH } from 'node:crypto';
const pair=createECDH('prime256v1');
pair.generateKeys();
console.log('VAPID_PUBLIC_KEY='+pair.getPublicKey().toString('base64url'));
console.log('VAPID_PRIVATE_KEY='+pair.getPrivateKey().toString('base64url'));
console.log('Keep the private key out of GitHub. Save it using: npx wrangler secret put VAPID_PRIVATE_KEY');
