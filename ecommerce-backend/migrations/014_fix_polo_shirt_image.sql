-- Fix: Update Polo Shirt Premium image URL to load properly on mobile app
UPDATE products 
SET image_url = 'https://printmytee.in/wp-content/uploads/2023/11/US-POLO-T-shirt-and-Shirts-11.jpg'
WHERE name = 'Polo Shirt Premium' 
  AND sku = 'CLO-005';

-- Verify the update
SELECT id, name, image_url FROM products WHERE sku = 'CLO-005';
