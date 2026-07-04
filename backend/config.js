// ─────────────────────────────────────────────
//  config.js
//  All environment variables live here.
//  The rest of the app imports from this file
//  instead of reading process.env directly.
// ─────────────────────────────────────────────

require('dotenv').config();

const config = {
  port:           process.env.PORT || 3000,
  awsRegion:      process.env.AWS_REGION,
  s3Bucket:       process.env.S3_BUCKET_NAME,
  jwtSecret:      process.env.JWT_SECRET,
  usersTable:     process.env.DYNAMODB_USERS_TABLE  || 'vault_users',
  filesTable:     process.env.DYNAMODB_FILES_TABLE  || 'vault_files',
  maxFileSizeMB:  parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10),
};

// Check that nothing critical is missing before the server starts
const required = ['awsRegion', 's3Bucket', 'jwtSecret'];
required.forEach((key) => {
  if (!config[key]) {
    console.error(`\n❌  Missing required env var: ${key.toUpperCase()}\n   Check your .env file.\n`);
    process.exit(1);
  }
});

module.exports = config;
