import { initializeDatabase, getDatabase, closeDatabase } from './config/database';
import { hashPassword } from './utils/auth';

async function seedAdmin() {
  try {
    console.log('🌱 Starting Admin Seeding...');

    // Initialize database
    await initializeDatabase();
    const db = getDatabase();

    // Default admin credentials
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@ecommerce.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const adminName = 'Super Admin';

    // Check if admin already exists
    const existingAdmin = await db.get('SELECT * FROM admins WHERE email = ?', [adminEmail]);

    if (existingAdmin) {
      console.log(`⚠️  Admin with email ${adminEmail} already exists`);
      console.log(`📧 Email: ${adminEmail}`);
      console.log(`🔑 Use your existing password or reset it`);
    } else {
      // Hash password
      const hashedPassword = await hashPassword(adminPassword);

      // Create admin
      await db.run(
        `INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)`,
        [adminName, adminEmail, hashedPassword, 'super_admin']
      );

      console.log('✅ Admin created successfully!');
      console.log('');
      console.log('=================================');
      console.log('  Admin Credentials');
      console.log('=================================');
      console.log(`📧 Email: ${adminEmail}`);
      console.log(`🔑 Password: ${adminPassword}`);
      console.log('=================================');
      console.log('');
      console.log('⚠️  Please change your password after first login!');
    }

    // Disable foreign keys temporarily for clean seed
    await db.run('PRAGMA foreign_keys = OFF');

    // Clear existing data in correct order (respecting foreign keys)
    await db.run('DELETE FROM inventory_logs');
    await db.run('DELETE FROM low_stock_alerts');
    await db.run('DELETE FROM product_versions');
    await db.run('DELETE FROM order_items');
    await db.run('DELETE FROM orders');
    await db.run('DELETE FROM cart');
    await db.run('DELETE FROM wishlist');
    await db.run('DELETE FROM products');
    await db.run('DELETE FROM stores');
    await db.run('DELETE FROM categories');
    
    // Re-enable foreign keys
    await db.run('PRAGMA foreign_keys = ON');
    console.log('🗑️  Cleared existing products, stores, and categories');

    // Seed categories first
    console.log('');
    console.log('📁 Seeding categories...');
    const categories = [
      { id: 1, name: 'Clothing', slug: 'clothing', description: 'Fashion clothing for all occasions', display_order: 1 },
      { id: 2, name: 'Shoes', slug: 'shoes', description: 'Footwear for every style', display_order: 2 },
      { id: 3, name: 'Hats', slug: 'hat', description: 'Stylish hats and caps', display_order: 3 },
      { id: 4, name: 'Home & Living', slug: 'home', description: 'Home decor and lifestyle products', display_order: 4 },
      { id: 5, name: 'Accessories', slug: 'accessories', description: 'Fashion and tech accessories', display_order: 5 },
    ];

    for (const cat of categories) {
      await db.run(
        'INSERT INTO categories (id, name, slug, description, display_order, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [cat.id, cat.name, cat.slug, cat.description, cat.display_order]
      );
    }
    console.log(`✅ Created ${categories.length} categories`);

    // Seed stores (same as mobile app)
    console.log('');
    console.log('🏪 Seeding stores...');
    await db.run(
      `INSERT INTO stores (id, name, location, order_processed, description) VALUES (?, ?, ?, ?, ?)`,
      [1, 'UFO Fashion', 'Mumbai, Maharashtra', '2 Hours', 'Premium fashion store with latest trends']
    );
    await db.run(
      `INSERT INTO stores (id, name, location, order_processed, description) VALUES (?, ?, ?, ?, ?)`,
      [2, 'Mega Regency Store', 'Mega Regency Mall', '3 Hours', 'One-stop shop for all your needs']
    );
    console.log('✅ Created 2 stores');

    // Seed all products from mobile app
    console.log('');
    console.log('📦 Seeding products (matching mobile app)...');

    const products = [
      // CLOTHING PRODUCTS
      { name: 'Under Armour Herren Rival Fitted Pull Over Hoodie', description: 'High quality sports hoodie with modern design', price: 120.00, discount: 25, category: 'clothing', store_id: 1, image_url: 'https://designhub.co/wp-content/uploads/2023/05/hoodie-mockup-mockey-6-819x1024.jpg', sku: 'CLO-001' },
      { name: 'Under Armour Herren Sweatshirt', description: 'Comfortable grey sweatshirt perfect for casual wear', price: 100.00, discount: 10, category: 'clothing', store_id: 1, image_url: 'https://img.freepik.com/premium-psd/psd-simple-green-hoodie-mockup_735731-465.jpg', sku: 'CLO-002' },
      { name: 'Under Armour Jacket Pria UA Rival Fleece', description: 'Premium fleece jacket with superior comfort', price: 120.00, discount: 50, category: 'clothing', store_id: 1, image_url: 'https://img.freepik.com/premium-photo/man-wearing-brown-jacket-with-white-shirt-khaki-pants_959800-15650.jpg?semt=ais_hybrid&w=740&q=80', sku: 'CLO-003' },
      { name: 'Casual T-Shirt', description: 'Everyday casual tee in premium cotton blend', price: 50.00, discount: 20, category: 'clothing', store_id: 1, image_url: 'https://m.media-amazon.com/images/I/B1pppR4gVKL._CLa%7C2140%2C2000%7C71dnofKGsEL.png%7C0%2C0%2C2140%2C2000%2B0.0%2C0.0%2C2140.0%2C2000.0_AC_UY1000_.png', sku: 'CLO-004' },
      { name: 'Polo Shirt Premium', description: 'Classic polo shirt for formal and casual occasions', price: 75.00, discount: 15, category: 'clothing', store_id: 1, image_url: 'https://printmytee.in/wp-content/uploads/2023/11/US-POLO-T-shirt-and-Shirts-11.jpg', sku: 'CLO-005' },
      { name: 'Denim Jeans Blue', description: 'Stylish blue denim with perfect fit', price: 95.00, discount: 30, category: 'clothing', store_id: 1, image_url: 'https://thumbs.dreamstime.com/b/blue-jeans-isolated-white-34440719.jpg', sku: 'CLO-006' },

      // SHOES PRODUCTS
      { name: 'Running Shoes Pro', description: 'Performance running shoes with advanced cushioning technology', price: 150.00, discount: 15, category: 'shoes', store_id: 2, image_url: 'https://static.vecteezy.com/system/resources/thumbnails/056/699/893/small/a-pair-of-running-shoes-on-a-beautiful-vibrant-background-free-photo.jpg', sku: 'SHO-001' },
      { name: 'Casual Sneakers White', description: 'Comfortable white sneakers for everyday wear', price: 85.00, discount: 25, category: 'shoes', store_id: 2, image_url: 'https://img.freepik.com/free-photo/blue-sports-shoe-untied-ready-action-generated-by-ai_188544-25546.jpg?semt=ais_hybrid&w=740&q=80', sku: 'SHO-002' },
      { name: 'Sports Basketball Shoes', description: 'Professional basketball shoes with ankle support', price: 180.00, discount: 20, category: 'shoes', store_id: 2, image_url: 'https://img.tatacliq.com/images/i27//437Wx649H/MP000000028729690_437Wx649H_202510102105431.jpeg', sku: 'SHO-003' },
      { name: 'Formal Leather Shoes', description: 'Premium leather shoes for formal occasions', price: 130.00, discount: 10, category: 'shoes', store_id: 2, image_url: 'https://media.istockphoto.com/id/687698200/photo/cobbler-workshop.jpg?s=612x612&w=0&k=20&c=AilMZhqeV6LRgz6RgnvWL5nRTF1v4irOrtoc1AmZ9wk=', sku: 'SHO-004' },
      { name: 'Sandals Comfort Slide', description: 'Comfortable sandals perfect for summer', price: 45.00, discount: 35, category: 'shoes', store_id: 2, image_url: 'https://www.shutterstock.com/image-photo/brown-leather-sandals-on-white-600nw-2707897089.jpg', sku: 'SHO-005' },
      { name: 'Boots Leather Hiking', description: 'Durable hiking boots for outdoor adventures', price: 160.00, discount: 15, category: 'shoes', store_id: 2, image_url: 'https://thumbs.dreamstime.com/b/brown-leather-hiking-boots-laces-worn-person-grey-leggings-standing-wooden-path-forest-symbolizing-outdoor-397237166.jpg', sku: 'SHO-006' },

      // HAT PRODUCTS
      { name: 'Classic Baseball Cap', description: 'Adjustable baseball cap in multiple colors', price: 30.00, discount: 20, category: 'hat', store_id: 1, image_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQfvmuXZwEttsvfZ_t2TEp7lirXVUWFF_HDoA&s', sku: 'HAT-001' },
      { name: 'Wool Beanie Winter', description: 'Warm wool beanie perfect for cold weather', price: 45.00, discount: 15, category: 'hat', store_id: 1, image_url: 'https://m.media-amazon.com/images/I/615t5YCvtQL._AC_UY1100_.jpg', sku: 'HAT-002' },
      { name: 'Sun Hat Straw', description: 'Breathable straw hat for sunny days', price: 40.00, discount: 25, category: 'hat', store_id: 1, image_url: 'https://m.media-amazon.com/images/I/81fto0TPpnL._AC_UF894,1000_QL80_.jpg', sku: 'HAT-003' },
      { name: 'Fedora Style Hat', description: 'Stylish fedora hat for formal wear', price: 55.00, discount: 10, category: 'hat', store_id: 1, image_url: 'https://files.ekmcdn.com/speedmaster/images/fedora-cowboy-wide-brimmed-hat-crushable-safari-with-removable-feather-10442-p.png?v=238C3E6C-4640-4DC6-BFFB-BABD9774D662', sku: 'HAT-004' },
      { name: 'Trucker Cap Denim', description: 'Trendy trucker cap with denim front', price: 35.00, discount: 30, category: 'hat', store_id: 1, image_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSngxPlIeWQOkyoPKnYoEw-GHW15_uPybaCsA&s', sku: 'HAT-005' },
      { name: 'Bucket Hat Cotton', description: 'Casual cotton bucket hat for outdoor activities', price: 38.00, discount: 20, category: 'hat', store_id: 1, image_url: 'https://hatroom.eu/images/zoom/186605.jpg', sku: 'HAT-006' },

      // HOME & LIFESTYLE PRODUCTS
      { name: 'Decorative Wall Art & Frames', description: 'Beautiful wall art and picture frames for home decoration', price: 85.00, discount: 15, category: 'home', store_id: 1, image_url: 'https://funkydecors.com/cdn/shop/files/aesthetic-minimal-3-panels-art-frame-for-wall-decor-funkydecors-xs-black-posters-prints-visual-artwork-910.jpg?v=1717871816&width=1445', sku: 'HOM-001' },
      { name: 'Aromatic Candles & Diffusers', description: 'Premium scented candles and essential oil diffusers', price: 65.00, discount: 20, category: 'home', store_id: 1, image_url: 'https://assets.myntassets.com/dpr_1.5,q_30,w_400,c_limit,fl_progressive/assets/images/2025/SEPTEMBER/9/46hOL9br_05487166fd27457f9597dec4217166f6.jpg', sku: 'HOM-002' },
      { name: 'Bedsheets & Cushion Covers', description: 'Soft and comfortable bedsheets and decorative cushion covers', price: 95.00, discount: 25, category: 'home', store_id: 1, image_url: 'https://assets.ajio.com/medias/sys_master/root/20240309/793U/65ebe5c816fd2c6e6a48dd07/-473Wx593H-467150830-red-MODEL.jpg', sku: 'HOM-003' },
      { name: 'Kitchen Storage & Organizers', description: 'Practical storage solutions for kitchen organization', price: 75.00, discount: 30, category: 'home', store_id: 1, image_url: 'https://cdn.shopify.com/s/files/1/0859/4545/0780/files/1_0443e13f-6e46-4790-ab3b-4b7ab73195c8.png?v=1729250464', sku: 'HOM-004' },
      { name: 'Tabletop Decor Items', description: 'Elegant tabletop decorations and centerpieces', price: 55.00, discount: 10, category: 'home', store_id: 1, image_url: 'https://i.pinimg.com/236x/c5/fc/c9/c5fcc9a6976de1c5955e3a7cb3b06172.jpg', sku: 'HOM-005' },
      { name: 'Laundry & Home Utility Products', description: 'Essential laundry and home utility items', price: 45.00, discount: 20, category: 'home', store_id: 1, image_url: 'https://www.kuberindustries.co.in/uploads/kuberindustries/products/kuber-industries-multipurpose-plastic-large-55-ltr-laundry-basket-with-lid-amp-handle--ideal-for-hom-8036897166747410_l.jpg', sku: 'HOM-006' },

      // ACCESSORIES PRODUCTS
      { name: 'Sports Backpack', description: 'Durable sports backpack with multiple compartments', price: 75.00, discount: 15, category: 'accessories', store_id: 2, image_url: 'https://adventureworx.in/wp-content/uploads/2024/02/athletic-sports-backpack-35l-black-2-1-1000x1500.jpg', sku: 'ACC-001' },
      { name: 'Gym Gloves Fitness', description: 'Professional gym gloves for weight training', price: 35.00, discount: 25, category: 'accessories', store_id: 2, image_url: 'https://m.media-amazon.com/images/I/81-P6rhVukL.jpg', sku: 'ACC-002' },
      { name: 'Socks Premium Pack', description: 'Set of 6 premium quality socks', price: 25.00, discount: 20, category: 'accessories', store_id: 2, image_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRWQSW0VlHg53uw8tJiZR3m8antkAGQlgjlTQ&s', sku: 'ACC-003' },
      { name: 'Headphones Wireless', description: 'High quality wireless headphones with noise cancellation', price: 150.00, discount: 30, category: 'accessories', store_id: 2, image_url: 'https://www.boat-lifestyle.com/cdn/shop/products/main2_b66dce6b-710d-49cb-9d1c-2bc8c9c0ab15_600x.png?v=1645698328', sku: 'ACC-004' },
      { name: 'Phone Case Leather', description: 'Premium leather phone case with protection', price: 40.00, discount: 20, category: 'accessories', store_id: 2, image_url: 'https://bullstrap.co/cdn/shop/articles/iphoneCase.jpg?v=1610559474', sku: 'ACC-005' },
      { name: 'Travel Neck Pillow', description: 'Comfortable memory foam neck pillow for travel', price: 32.00, discount: 25, category: 'accessories', store_id: 2, image_url: 'https://www.sleepyard.in/cdn/shop/files/TravelNeckPillow04_1024x1024.png?v=1722863339', sku: 'ACC-006' },

      // COLLECTION PRODUCTS (Featured/New Items)
      { name: 'New Jacket', description: 'Premium quality new jacket with modern style', price: 189.99, discount: 15, category: 'clothing', store_id: 1, image_url: 'https://assets.myntassets.com/dpr_1.5,q_30,w_400,c_limit,fl_progressive/assets/images/2025/APRIL/24/tjlztGaF_822d160dea33450c94a27cc17dfdaf4c.jpg', sku: 'NEW-001' },
      { name: 'New Watch', description: 'Stylish quartz watch with premium design', price: 249.99, discount: 10, category: 'accessories', store_id: 2, image_url: 'https://images-cdn.ubuy.co.in/65fe5a0cf323f3169711abc0-pagani-design-new-men-s-quartz-watches.jpg', sku: 'NEW-002' },
      { name: 'New Dinner Set', description: 'Elegant dinner set perfect for dining occasions', price: 179.99, discount: 20, category: 'home', store_id: 1, image_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSesL6tuGW5IiFU3PhzwqKRUeQEMR8A3Sp15A&s', sku: 'NEW-003' },
      { name: 'New Sunglasses', description: 'UV400 mirror sunglasses with trendy design', price: 129.99, discount: 25, category: 'accessories', store_id: 2, image_url: 'https://images.jdmagicbox.com/quickquotes/images_main/2021-new-flat-top-men-women-round-sunglasses-uv400-mirror-eyewear-387415962-4sv6j.jpg', sku: 'NEW-004' },
      { name: 'New Flower Pot', description: 'Decorative ceramic flower pot for indoor plants', price: 89.99, discount: 30, category: 'home', store_id: 1, image_url: 'https://img.tatacliq.com/images/i11/437Wx649H/MP000000017605818_437Wx649H_202305182049011.jpeg', sku: 'NEW-005' },
    ];

    for (const product of products) {
      // Map category slug to category_id
      const categoryMap: Record<string, number> = {
        'clothing': 1,
        'shoes': 2,
        'hat': 3,
        'home': 4,
        'accessories': 5,
      };
      const categoryId = categoryMap[product.category] || 1;
      
      // Random stock between 10 and 200
      const stockQty = Math.floor(Math.random() * 190) + 10;
      // Some products should be low stock or out of stock for testing
      const finalStock = product.sku.includes('001') ? 5 : (product.sku.includes('002') ? 0 : stockQty);
      
      await db.run(
        `INSERT INTO products (name, description, price, discount_percent, category, category_id, image_url, store_id, sku, stock_quantity, is_visible, low_stock_threshold, reorder_quantity, version) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 10, 50, 1)`,
        [product.name, product.description, product.price, product.discount, product.category, categoryId, product.image_url, product.store_id, product.sku, finalStock]
      );
    }

    // Update category product counts
    await db.run(`
      UPDATE categories 
      SET product_count = (
        SELECT COUNT(*) FROM products 
        WHERE products.category_id = categories.id 
        AND products.is_active = 1
      )
    `);

    console.log(`✅ Created ${products.length} products (matching mobile app)`);

    // Seed default roles
    console.log('');
    console.log('👤 Seeding roles and permissions...');

    // Clear existing roles and permissions
    await db.run('DELETE FROM admin_roles');
    await db.run('DELETE FROM role_permissions');
    await db.run('DELETE FROM permissions');
    await db.run('DELETE FROM roles');

    // Create default roles
    const roles = [
      { name: 'super_admin', display_name: 'Super Admin', description: 'Full system access with all permissions', is_system: 1 },
      { name: 'admin', display_name: 'Admin', description: 'Standard admin with most permissions', is_system: 1 },
      { name: 'manager', display_name: 'Manager', description: 'Can manage products, orders, and view reports', is_system: 0 },
      { name: 'support', display_name: 'Support Staff', description: 'Can view and manage orders and users', is_system: 0 },
      { name: 'viewer', display_name: 'Viewer', description: 'Read-only access to dashboard and reports', is_system: 0 },
    ];

    for (const role of roles) {
      await db.run(
        'INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?)',
        [role.name, role.display_name, role.description, role.is_system]
      );
    }
    console.log(`✅ Created ${roles.length} roles`);

    // Create default permissions
    const permissions = [
      // Dashboard
      { module: 'dashboard', action: 'view', name: 'dashboard.view', description: 'View dashboard' },
      { module: 'dashboard', action: 'export', name: 'dashboard.export', description: 'Export dashboard reports' },
      
      // Categories
      { module: 'categories', action: 'view', name: 'categories.view', description: 'View categories' },
      { module: 'categories', action: 'create', name: 'categories.create', description: 'Create categories' },
      { module: 'categories', action: 'edit', name: 'categories.edit', description: 'Edit categories' },
      { module: 'categories', action: 'delete', name: 'categories.delete', description: 'Delete/Disable categories' },
      
      // Products
      { module: 'products', action: 'view', name: 'products.view', description: 'View products' },
      { module: 'products', action: 'create', name: 'products.create', description: 'Create products' },
      { module: 'products', action: 'edit', name: 'products.edit', description: 'Edit products' },
      { module: 'products', action: 'delete', name: 'products.delete', description: 'Delete products' },
      { module: 'products', action: 'visibility', name: 'products.visibility', description: 'Show/Hide products' },
      { module: 'products', action: 'bulk', name: 'products.bulk', description: 'Bulk product operations' },
      
      // Inventory
      { module: 'inventory', action: 'view', name: 'inventory.view', description: 'View inventory levels' },
      { module: 'inventory', action: 'edit', name: 'inventory.edit', description: 'Update stock quantities' },
      { module: 'inventory', action: 'alerts', name: 'inventory.alerts', description: 'Manage low stock alerts' },
      
      // Orders
      { module: 'orders', action: 'view', name: 'orders.view', description: 'View orders' },
      { module: 'orders', action: 'create', name: 'orders.create', description: 'Create orders' },
      { module: 'orders', action: 'edit', name: 'orders.edit', description: 'Edit orders' },
      { module: 'orders', action: 'delete', name: 'orders.delete', description: 'Delete orders' },
      
      // Users
      { module: 'users', action: 'view', name: 'users.view', description: 'View users' },
      { module: 'users', action: 'create', name: 'users.create', description: 'Create users' },
      { module: 'users', action: 'edit', name: 'users.edit', description: 'Edit users' },
      { module: 'users', action: 'delete', name: 'users.delete', description: 'Delete users' },
      
      // Stores
      { module: 'stores', action: 'view', name: 'stores.view', description: 'View stores' },
      { module: 'stores', action: 'create', name: 'stores.create', description: 'Create stores' },
      { module: 'stores', action: 'edit', name: 'stores.edit', description: 'Edit stores' },
      { module: 'stores', action: 'delete', name: 'stores.delete', description: 'Delete stores' },
      
      // Admin Management
      { module: 'admins', action: 'view', name: 'admins.view', description: 'View admin users' },
      { module: 'admins', action: 'create', name: 'admins.create', description: 'Create admin users' },
      { module: 'admins', action: 'edit', name: 'admins.edit', description: 'Edit admin users' },
      { module: 'admins', action: 'delete', name: 'admins.delete', description: 'Delete admin users' },
      
      // Roles & Permissions
      { module: 'roles', action: 'view', name: 'roles.view', description: 'View roles' },
      { module: 'roles', action: 'create', name: 'roles.create', description: 'Create roles' },
      { module: 'roles', action: 'edit', name: 'roles.edit', description: 'Edit roles' },
      { module: 'roles', action: 'delete', name: 'roles.delete', description: 'Delete roles' },
      
      // Sessions
      { module: 'sessions', action: 'view', name: 'sessions.view', description: 'View active sessions' },
      { module: 'sessions', action: 'manage', name: 'sessions.manage', description: 'Manage sessions (force logout)' },
      
      // Settings
      { module: 'settings', action: 'view', name: 'settings.view', description: 'View settings' },
      { module: 'settings', action: 'edit', name: 'settings.edit', description: 'Edit settings' },
      
      // Logs
      { module: 'logs', action: 'view', name: 'logs.view', description: 'View activity logs' },
    ];

    for (const perm of permissions) {
      await db.run(
        'INSERT INTO permissions (module, action, name, description) VALUES (?, ?, ?, ?)',
        [perm.module, perm.action, perm.name, perm.description]
      );
    }
    console.log(`✅ Created ${permissions.length} permissions`);

    // Assign all permissions to super_admin role
    const superAdminRole = await db.get('SELECT id FROM roles WHERE name = ?', ['super_admin']);
    const allPermissions = await db.all('SELECT id FROM permissions');
    
    for (const perm of allPermissions) {
      await db.run(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
        [superAdminRole.id, perm.id]
      );
    }
    console.log('✅ Assigned all permissions to Super Admin role');

    // Assign super_admin role to the admin user
    const admin = await db.get('SELECT id FROM admins WHERE email = ?', [adminEmail]);
    if (admin) {
      await db.run(
        'INSERT OR IGNORE INTO admin_roles (admin_id, role_id, assigned_by) VALUES (?, ?, ?)',
        [admin.id, superAdminRole.id, admin.id]
      );
      console.log('✅ Assigned Super Admin role to admin user');
    }

    // Assign limited permissions to admin role
    const adminRole = await db.get('SELECT id FROM roles WHERE name = ?', ['admin']);
    const adminPermissions = await db.all(
      "SELECT id FROM permissions WHERE module NOT IN ('admins', 'roles', 'sessions')"
    );
    for (const perm of adminPermissions) {
      await db.run(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
        [adminRole.id, perm.id]
      );
    }
    console.log('✅ Assigned permissions to Admin role');

    // Assign view-only permissions to viewer role
    const viewerRole = await db.get('SELECT id FROM roles WHERE name = ?', ['viewer']);
    const viewPermissions = await db.all("SELECT id FROM permissions WHERE action = 'view'");
    for (const perm of viewPermissions) {
      await db.run(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
        [viewerRole.id, perm.id]
      );
    }
    console.log('✅ Assigned view permissions to Viewer role');

    // Seed sample users for testing
    console.log('');
    console.log('👥 Seeding sample users...');
    
    const sampleUsers = [
      { name: 'John Doe', email: 'john@example.com', phone: '+1234567890', address: '123 Main St', city: 'New York' },
      { name: 'Jane Smith', email: 'jane@example.com', phone: '+1234567891', address: '456 Oak Ave', city: 'Los Angeles' },
      { name: 'Bob Johnson', email: 'bob@example.com', phone: '+1234567892', address: '789 Pine Rd', city: 'Chicago' },
      { name: 'Alice Brown', email: 'alice@example.com', phone: '+1234567893', address: '321 Elm St', city: 'Houston' },
      { name: 'Charlie Wilson', email: 'charlie@example.com', phone: '+1234567894', address: '654 Maple Dr', city: 'Phoenix' },
      { name: 'Diana Miller', email: 'diana@example.com', phone: '+1234567895', address: '987 Cedar Ln', city: 'Dallas' },
      { name: 'Edward Davis', email: 'edward@example.com', phone: '+1234567896', address: '147 Birch Way', city: 'Seattle' },
      { name: 'Fiona Garcia', email: 'fiona@example.com', phone: '+1234567897', address: '258 Walnut Blvd', city: 'Miami' },
    ];

    const userPassword = await hashPassword('User@123');
    for (const user of sampleUsers) {
      const existing = await db.get('SELECT id FROM users WHERE email = ?', [user.email]);
      if (!existing) {
        await db.run(
          'INSERT INTO users (name, email, password, phone, address, city) VALUES (?, ?, ?, ?, ?, ?)',
          [user.name, user.email, userPassword, user.phone, user.address, user.city]
        );
      }
    }
    console.log(`✅ Created ${sampleUsers.length} sample users`);

    // Seed sample orders
    console.log('');
    console.log('📦 Seeding sample orders...');
    
    const users = await db.all('SELECT id FROM users LIMIT 5');
    const allProducts = await db.all('SELECT id, price FROM products LIMIT 10');
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const numOrders = Math.floor(Math.random() * 3) + 1;
      
      for (let j = 0; j < numOrders; j++) {
        const orderNumber = `ORD-${Date.now()}-${i}-${j}`;
        const product = allProducts[Math.floor(Math.random() * allProducts.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        const totalAmount = product.price * quantity;
        const statuses = ['pending', 'processing', 'shipped', 'delivered'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        const orderResult = await db.run(
          `INSERT INTO orders (order_number, user_id, total_amount, status, payment_method, delivery_address, city)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderNumber, user.id, totalAmount, status, 'COD', '123 Test Address', 'Test City']
        );
        
        await db.run(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [orderResult.lastID, product.id, quantity, product.price]
        );

        // Create payment for this order
        const paymentStatuses = ['pending', 'completed', 'failed', 'refunded'];
        const paymentStatus = status === 'delivered' ? 'completed' : (status === 'pending' ? 'pending' : paymentStatuses[Math.floor(Math.random() * 2)]);
        const paymentMethods = ['credit_card', 'debit_card', 'upi', 'net_banking', 'cod'];
        const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
        const transactionId = `TXN-${Date.now()}-${i}-${j}`;
        
        const paymentResult = await db.run(
          `INSERT INTO payments (order_id, user_id, payment_method, transaction_id, amount, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [orderResult.lastID, user.id, paymentMethod, transactionId, totalAmount, paymentStatus]
        );

        // Create invoice for completed payments
        if (paymentStatus === 'completed') {
          const invoiceNumber = `INV-${Date.now()}-${i}-${j}`;
          const subtotal = totalAmount * 0.82;
          const taxAmount = totalAmount * 0.18;
          await db.run(
            `INSERT INTO invoices (invoice_number, order_id, user_id, payment_id, subtotal, tax_amount, total_amount, status, billing_name, billing_address, billing_city)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [invoiceNumber, orderResult.lastID, user.id, paymentResult.lastID, subtotal, taxAmount, totalAmount, 'issued', 'Test Customer', '123 Test Address', 'Test City']
          );
        }
      }
    }
    console.log('✅ Created sample orders with payments and invoices');

    // Seed sample user activity logs
    console.log('');
    console.log('📊 Seeding sample activity logs...');
    
    const activities = [
      { action: 'User logged in', action_type: 'auth' },
      { action: 'Viewed product', action_type: 'browse' },
      { action: 'Added item to cart', action_type: 'cart' },
      { action: 'Completed checkout', action_type: 'order' },
      { action: 'Updated profile', action_type: 'profile' },
    ];
    
    for (const user of users) {
      const numActivities = Math.floor(Math.random() * 5) + 2;
      for (let i = 0; i < numActivities; i++) {
        const activity = activities[Math.floor(Math.random() * activities.length)];
        await db.run(
          `INSERT INTO user_activity_logs (user_id, action, action_type, ip_address, device_info)
           VALUES (?, ?, ?, ?, ?)`,
          [user.id, activity.action, activity.action_type, '192.168.1.' + Math.floor(Math.random() * 255), 'android']
        );
      }
    }
    console.log('✅ Created sample activity logs');

    // Seed sample notification preferences
    console.log('');
    console.log('🔔 Seeding notification preferences...');
    
    for (const user of users) {
      await db.run(
        `INSERT OR REPLACE INTO user_notification_preferences 
         (user_id, email_marketing, email_orders, push_enabled, push_orders, consent_date, consent_source)
         VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
        [user.id, Math.random() > 0.3 ? 1 : 0, 1, Math.random() > 0.2 ? 1 : 0, 1, 'app_signup']
      );
    }
    console.log('✅ Created notification preferences');

    await closeDatabase();
    console.log('');
    console.log('🎉 Seeding completed successfully!');
    console.log('');
    console.log('📱 Products are now synced with the mobile app!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedAdmin();
