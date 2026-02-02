const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_M7sOnpArVS6W@ep-delicate-snow-ah267bho-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function runMigration() {
  try {
    // Update Polo Shirt Premium image URL
    const updateResult = await pool.query(
      `UPDATE products 
       SET image_url = 'https://printmytee.in/wp-content/uploads/2023/11/US-POLO-T-shirt-and-Shirts-11.jpg' 
       WHERE name = 'Polo Shirt Premium' AND sku = 'CLO-005'`
    );
    console.log('✅ Updated rows:', updateResult.rowCount);

    // Verify the update
    const verifyResult = await pool.query(
      `SELECT id, name, image_url FROM products WHERE sku = 'CLO-005'`
    );
    console.log('📦 Product after update:', verifyResult.rows[0]);

    await pool.end();
    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
