-- Artist Marketplace category rename (launch taxonomy).
-- Legacy labels → current SHOP_CATEGORIES in src/lib/shop/categories.ts

UPDATE public.shop_products
SET category = 'Ceramics'
WHERE category = 'Pottery';

UPDATE public.shop_products
SET category = 'Prints & Paintings'
WHERE category = 'Prints';

UPDATE public.shop_products
SET category = 'Jewelry & Metalwork'
WHERE category = 'Jewelry';

UPDATE public.shop_products
SET category = 'Home & Lifestyle'
WHERE category = 'Home';
