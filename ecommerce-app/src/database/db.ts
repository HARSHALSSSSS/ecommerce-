import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// Only initialize database on native platforms (not on web)
let db: any = null;
if (Platform.OS !== 'web') {
  db = SQLite.openDatabaseSync('ecommerce.db');
}

export const initDB = async () => {
  // Skip database initialization on web platform
  if (Platform.OS === 'web') {
    console.log('Database initialization skipped on web platform');
    return;
  }

  try {
    // Verify database is available
    if (!db) {
      console.warn('⚠️ Database not available on this platform');
      return;
    }

    console.log('🔄 [DB] Checking if database is already initialized...');
    // Check if tables already exist
    const result = await db.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='products'"
    );

    // If products table exists, database is already initialized
    if (result && result.length > 0) {
      console.log('✓ [DB] Database already initialized, skipping setup');
      return;
    }

    console.log('🔧 [DB] Setting up database for first time...');

    // Create tables (don't drop on reload)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        city TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Products table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        discount_percent INTEGER DEFAULT 0,
        category TEXT,
        rating REAL DEFAULT 0,
        image_url TEXT,
        store_id INTEGER,
        is_collection INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Stores table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT,
        rating REAL DEFAULT 0,
        followers INTEGER DEFAULT 0,
        order_processed TEXT DEFAULT '2 Hours',
        image_url TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Cart table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        user_id INTEGER,
        quantity INTEGER DEFAULT 1,
        size TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);

    // Orders table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        delivery_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);

    // Order items table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        size TEXT,
        price REAL NOT NULL,
        FOREIGN KEY(order_id) REFERENCES orders(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
      );
    `);

    // Seed initial data only on first creation
    await seedData();

    console.log('✓ Database created and seeded successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

const seedData = async () => {
  try {
    console.log('Seeding database with initial data...');
    
    // Update UFO Fashion location to Mumbai, Maharashtra
    await db.execAsync(`
      UPDATE stores SET location = 'Mumbai, Maharashtra' WHERE name = 'UFO Fashion';
    `);

    // Check if data already exists
    const count = await db.getFirstAsync('SELECT COUNT(*) as count FROM products');
    if (count && count.count > 0) {
      console.log('✓ Data already seeded, skipping');
      return;
    }

    // Insert stores
    await db.execAsync(`
      INSERT INTO stores (name, location, rating, followers, order_processed) VALUES
      ('UFO Fashion', 'Mumbai, Maharashtra', 5.0, 50000, '2 Hours'),
      ('Mega Regency Store', 'Mega Regency Mall', 4.8, 35000, '3 Hours');
    `);
    console.log('Stores inserted successfully');

    // Insert expanded products with all categories
    await db.execAsync(`
      INSERT INTO products (name, description, price, discount_percent, category, rating, store_id, image_url) VALUES
      -- CLOTHING PRODUCTS - Simple & Professional Friendly
      ('Under Armour Herren Rival Fitted Pull Over Hoodie', 'High quality sports hoodie with modern design', 120.00, 25, 'clothing', 4.5, 1, 'https://designhub.co/wp-content/uploads/2023/05/hoodie-mockup-mockey-6-819x1024.jpg'),
      ('Under Armour Herren Sweatshirt', 'Comfortable grey sweatshirt perfect for casual wear', 100.00, 10, 'clothing', 4.3, 1, 'https://img.freepik.com/premium-psd/psd-simple-green-hoodie-mockup_735731-465.jpg'),
      ('Under Armour Jacket Pria UA Rival Fleece', 'Premium fleece jacket with superior comfort', 120.00, 50, 'clothing', 5.0, 1, 'https://img.freepik.com/premium-photo/man-wearing-brown-jacket-with-white-shirt-khaki-pants_959800-15650.jpg?semt=ais_hybrid&w=740&q=80'),
      ('Casual T-Shirt', 'Everyday casual tee in premium cotton blend', 50.00, 20, 'clothing', 4.2, 1, 'https://m.media-amazon.com/images/I/B1pppR4gVKL._CLa%7C2140%2C2000%7C71dnofKGsEL.png%7C0%2C0%2C2140%2C2000%2B0.0%2C0.0%2C2140.0%2C2000.0_AC_UY1000_.png'),
      ('Polo Shirt Premium', 'Classic polo shirt for formal and casual occasions', 75.00, 15, 'clothing', 4.6, 1, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcThbdGds4ro1i2rszjprr5HRo-8p2o_TGNWbg&s'),
      ('Denim Jeans Blue', 'Stylish blue denim with perfect fit', 95.00, 30, 'clothing', 4.4, 1, 'https://thumbs.dreamstime.com/b/blue-jeans-isolated-white-34440719.jpg'),
      
      -- SHOES PRODUCTS - Proper Shoe Images
      ('Running Shoes Pro', 'Performance running shoes with advanced cushioning technology', 150.00, 15, 'shoes', 4.7, 2, 'https://static.vecteezy.com/system/resources/thumbnails/056/699/893/small/a-pair-of-running-shoes-on-a-beautiful-vibrant-background-free-photo.jpg'),
      ('Casual Sneakers White', 'Comfortable white sneakers for everyday wear', 85.00, 25, 'shoes', 4.5, 2, 'https://img.freepik.com/free-photo/blue-sports-shoe-untied-ready-action-generated-by-ai_188544-25546.jpg?semt=ais_hybrid&w=740&q=80'),
      ('Sports Basketball Shoes', 'Professional basketball shoes with ankle support', 180.00, 20, 'shoes', 4.8, 2, 'https://img.tatacliq.com/images/i27//437Wx649H/MP000000028729690_437Wx649H_202510102105431.jpeg'),
      ('Formal Leather Shoes', 'Premium leather shoes for formal occasions', 130.00, 10, 'shoes', 4.6, 2, 'https://media.istockphoto.com/id/687698200/photo/cobbler-workshop.jpg?s=612x612&w=0&k=20&c=AilMZhqeV6LRgz6RgnvWL5nRTF1v4irOrtoc1AmZ9wk='),
      ('Sandals Comfort Slide', 'Comfortable sandals perfect for summer', 45.00, 35, 'shoes', 4.3, 2, 'https://www.shutterstock.com/image-photo/brown-leather-sandals-on-white-600nw-2707897089.jpg'),
      ('Boots Leather Hiking', 'Durable hiking boots for outdoor adventures', 160.00, 15, 'shoes', 4.9, 2, 'https://thumbs.dreamstime.com/b/brown-leather-hiking-boots-laces-worn-person-grey-leggings-standing-wooden-path-forest-symbolizing-outdoor-397237166.jpg'),
      
      -- HAT PRODUCTS - Proper Hat Images
      ('Classic Baseball Cap', 'Adjustable baseball cap in multiple colors', 30.00, 20, 'hat', 4.4, 1, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQfvmuXZwEttsvfZ_t2TEp7lirXVUWFF_HDoA&s'),
      ('Wool Beanie Winter', 'Warm wool beanie perfect for cold weather', 45.00, 15, 'hat', 4.6, 1, 'https://m.media-amazon.com/images/I/615t5YCvtQL._AC_UY1100_.jpg'),
      ('Sun Hat Straw', 'Breathable straw hat for sunny days', 40.00, 25, 'hat', 4.5, 1, 'https://m.media-amazon.com/images/I/81fto0TPpnL._AC_UF894,1000_QL80_.jpg'),
      ('Fedora Style Hat', 'Stylish fedora hat for formal wear', 55.00, 10, 'hat', 4.7, 1, 'https://files.ekmcdn.com/speedmaster/images/fedora-cowboy-wide-brimmed-hat-crushable-safari-with-removable-feather-10442-p.png?v=238C3E6C-4640-4DC6-BFFB-BABD9774D662'),
      ('Trucker Cap Denim', 'Trendy trucker cap with denim front', 35.00, 30, 'hat', 4.3, 1, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSngxPlIeWQOkyoPKnYoEw-GHW15_uPybaCsA&s'),
      ('Bucket Hat Cotton', 'Casual cotton bucket hat for outdoor activities', 38.00, 20, 'hat', 4.5, 1, 'https://hatroom.eu/images/zoom/186605.jpg'),
      
      -- HOME & LIFESTYLE CATEGORY (New Category)
      ('Decorative Wall Art & Frames', 'Beautiful wall art and picture frames for home decoration', 85.00, 15, 'home', 4.6, 1, 'https://funkydecors.com/cdn/shop/files/aesthetic-minimal-3-panels-art-frame-for-wall-decor-funkydecors-xs-black-posters-prints-visual-artwork-910.jpg?v=1717871816&width=1445'),
      ('Aromatic Candles & Diffusers', 'Premium scented candles and essential oil diffusers', 65.00, 20, 'home', 4.5, 1, 'https://assets.myntassets.com/dpr_1.5,q_30,w_400,c_limit,fl_progressive/assets/images/2025/SEPTEMBER/9/46hOL9br_05487166fd27457f9597dec4217166f6.jpg'),
      ('Bedsheets & Cushion Covers', 'Soft and comfortable bedsheets and decorative cushion covers', 95.00, 25, 'home', 4.7, 1, 'https://assets.ajio.com/medias/sys_master/root/20240309/793U/65ebe5c816fd2c6e6a48dd07/-473Wx593H-467150830-red-MODEL.jpg'),
      ('Kitchen Storage & Organizers', 'Practical storage solutions for kitchen organization', 75.00, 30, 'home', 4.4, 1, 'https://cdn.shopify.com/s/files/1/0859/4545/0780/files/1_0443e13f-6e46-4790-ab3b-4b7ab73195c8.png?v=1729250464'),
      ('Tabletop Decor Items', 'Elegant tabletop decorations and centerpieces', 55.00, 10, 'home', 4.8, 1, 'https://i.pinimg.com/236x/c5/fc/c9/c5fcc9a6976de1c5955e3a7cb3b06172.jpg'),
      ('Laundry & Home Utility Products', 'Essential laundry and home utility items', 45.00, 20, 'home', 4.5, 1, 'https://www.kuberindustries.co.in/uploads/kuberindustries/products/kuber-industries-multipurpose-plastic-large-55-ltr-laundry-basket-with-lid-amp-handle--ideal-for-hom-8036897166747410_l.jpg'),
      
      -- ACCESSORIES (General) - Proper Accessory Images
      ('Sports Backpack', 'Durable sports backpack with multiple compartments', 75.00, 15, 'accessories', 4.5, 2, 'https://adventureworx.in/wp-content/uploads/2024/02/athletic-sports-backpack-35l-black-2-1-1000x1500.jpg'),
      ('Gym Gloves Fitness', 'Professional gym gloves for weight training', 35.00, 25, 'accessories', 4.4, 2, 'https://m.media-amazon.com/images/I/81-P6rhVukL.jpg'),
      ('Socks Premium Pack', 'Set of 6 premium quality socks', 25.00, 20, 'accessories', 4.3, 2, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRWQSW0VlHg53uw8tJiZR3m8antkAGQlgjlTQ&s'),
      ('Headphones Wireless', 'High quality wireless headphones with noise cancellation', 150.00, 30, 'accessories', 4.8, 2, 'https://www.boat-lifestyle.com/cdn/shop/products/main2_b66dce6b-710d-49cb-9d1c-2bc8c9c0ab15_600x.png?v=1645698328'),
      ('Phone Case Leather', 'Premium leather phone case with protection', 40.00, 20, 'accessories', 4.5, 2, 'https://bullstrap.co/cdn/shop/articles/iphoneCase.jpg?v=1610559474'),
      ('Travel Neck Pillow', 'Comfortable memory foam neck pillow for travel', 32.00, 25, 'accessories', 4.6, 2, 'https://www.sleepyard.in/cdn/shop/files/TravelNeckPillow04_1024x1024.png?v=1722863339'),
      
      -- COLLECTION PRODUCTS - NEW ITEMS
      ('New Jacket', 'Premium quality new jacket with modern style', 189.99, 15, 'clothing', 4.8, 1, 'https://assets.myntassets.com/dpr_1.5,q_30,w_400,c_limit,fl_progressive/assets/images/2025/APRIL/24/tjlztGaF_822d160dea33450c94a27cc17dfdaf4c.jpg'),
      ('New Watch', 'Stylish quartz watch with premium design', 249.99, 10, 'accessories', 4.9, 2, 'https://images-cdn.ubuy.co.in/65fe5a0cf323f3169711abc0-pagani-design-new-men-s-quartz-watches.jpg'),
      ('New Dinner Set', 'Elegant dinner set perfect for dining occasions', 179.99, 20, 'home', 4.7, 1, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSesL6tuGW5IiFU3PhzwqKRUeQEMR8A3Sp15A&s'),
      ('New Sunglasses', 'UV400 mirror sunglasses with trendy design', 129.99, 25, 'accessories', 4.6, 2, 'https://images.jdmagicbox.com/quickquotes/images_main/2021-new-flat-top-men-women-round-sunglasses-uv400-mirror-eyewear-387415962-4sv6j.jpg'),
      ('New Flower Pot', 'Decorative ceramic flower pot for indoor plants', 89.99, 30, 'home', 4.5, 1, 'https://img.tatacliq.com/images/i11/437Wx649H/MP000000017605818_437Wx649H_202305182049011.jpeg');
    `);
    console.log('Products inserted successfully');
    
    // Mark collection products
    await db.execAsync(`
      UPDATE products SET is_collection = 1 
      WHERE name IN ('New Jacket', 'New Watch', 'New Dinner Set', 'New Sunglasses', 'New Flower Pot')
    `);
    console.log('✓ Collection products marked');
  } catch (error) {
    console.error('Error seeding data:', error);
  }
};

/**
 * Fetch all products with image URLs for preloading
 * Used during app initialization to preload all product images
 */
export const getAllProductsForImagePreload = async (): Promise<any[]> => {
  try {
    if (Platform.OS === 'web' || !db) {
      console.log('Returning mock products for web platform');
      return [
        { id: 1, name: 'Under Armour Hoodie', image_url: 'https://images.unsplash.com/photo-1556821552-5ff63b1fcd74?w=500&h=500&fit=crop' },
        { id: 2, name: 'Running Shoes', image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=500&fit=crop' },
      ];
    }

    const result = await db.getAllAsync('SELECT id, name, image_url FROM products WHERE image_url IS NOT NULL AND image_url != ""');
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Error fetching products for image preload:', error);
    return [];
  }
};

export default db;
