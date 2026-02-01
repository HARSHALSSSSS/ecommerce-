require('dotenv').config();
const pg = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgres://agumentix_user:cXkFyv5J@localhost:5432/agumentix';

if (!connectionString) {
  console.error('❌ DATABASE_URL not set and no default provided');
  process.exit(1);
}

console.log('🔗 Connecting to database...');

const client = new pg.Client({ connectionString });

(async () => {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Update Polo Shirt Premium image
    const newImageUrl = 'https://m.media-amazon.com/images/I/71GYfbLFLpL._AC_UL1000_.jpg';
    const poloShirtName = 'Polo Shirt Premium';

    console.log(`\n🔄 Updating Polo Shirt Premium image...`);
    const result = await client.query(
      `UPDATE products SET image_url = $1 WHERE name = $2 RETURNING id, name, image_url`,
      [newImageUrl, poloShirtName]
    );

    if (result.rows.length > 0) {
      const product = result.rows[0];
      console.log(`\n✅ Product updated successfully!`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   New Image URL: ${product.image_url}`);
    } else {
      console.log('⚠️  No products matched for update');
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Update error:', error.message);
    process.exit(1);
  }
})();
