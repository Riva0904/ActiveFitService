// One-off migration: move base64 data-URL avatars out of the DB and into Cloudinary,
// replacing the column value with the resulting secure_url.
//
// Usage:
//   node scripts/migrate-avatars.js --dry-run    # report only, no writes, no uploads
//   node scripts/migrate-avatars.js              # backs up affected rows to
//                                                 # scripts/avatar-backup-<timestamp>.json,
//                                                 # then uploads + updates
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const prisma = new PrismaClient();

  const users = await prisma.user.findMany({
    where: { avatar: { startsWith: 'data:image' } },
    select: { id: true, email: true, avatar: true },
  });

  console.log(`Found ${users.length} user(s) with base64 avatar.`);
  if (users.length === 0) { await prisma.$disconnect(); return; }

  if (DRY_RUN) {
    for (const u of users) {
      console.log(`  [dry-run] ${u.email} — avatar ${Math.round(u.avatar.length / 1024)}KB`);
    }
    await prisma.$disconnect();
    return;
  }

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.error('Missing CLOUDINARY_* env vars. Aborting — no rows touched.');
    await prisma.$disconnect();
    process.exit(1);
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  // Backup raw values before any mutation — lets us roll back by hand if needed.
  const backupPath = path.join(__dirname, `avatar-backup-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(users, null, 2));
  console.log(`Backed up ${users.length} row(s) to ${backupPath}`);

  let ok = 0, failed = 0;
  for (const u of users) {
    try {
      const base64Data = u.avatar.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'avatars', resource_type: 'image' },
          (err, res) => (err || !res) ? reject(err ?? new Error('upload failed')) : resolve(res),
        );
        stream.end(buffer);
      });
      await prisma.user.update({ where: { id: u.id }, data: { avatar: result.secure_url } });
      console.log(`  OK   ${u.email} -> ${result.secure_url}`);
      ok++;
    } catch (e) {
      console.error(`  FAIL ${u.email}: ${e.message}`);
      failed++;
    }
  }

  console.log(`Done. ${ok} migrated, ${failed} failed. Backup: ${backupPath}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
