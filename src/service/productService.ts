import { query } from '../db';
import { Product } from '../db/models/product';
import brandService from './brandService';
import categoryService from './categoryService';
import logService from './logService';
import userService from './userService';

interface Params {
  q?: string;
  brand?: string | string[];
  category?: string | string[];
  price_gte?: number;
  price_lte?: number;
  page?: number;
  limit?: number;
}

class ProductService {
  getProducts = async (
    params: Params
  ): Promise<{ rows: Product[]; totalCount: number }> => {
    try {
      const { brand, category, price_gte, price_lte, page, limit, q } = params;

      const filters = [];
      const values = [];
      let orderNumber = 0;

      if (brand) {
        const brands = Array.isArray(brand) ? brand : [brand];
        filters.push(
          `b.name IN (${brands
            .map((_, i) => `$${(orderNumber += 1)}`)
            .join(', ')})`
        );
        values.push(...brands);
      }

      if (category) {
        const categories = Array.isArray(category) ? category : [category];
        filters.push(
          `c.name IN (${categories
            .map((_, i) => `$${(orderNumber += 1)}`)
            .join(', ')})`
        );
        values.push(...categories);
      }

      if (price_gte) {
        filters.push(`price >= $${values.length + 1}`);
        values.push(price_gte);
      }

      if (price_lte) {
        filters.push(`price <= $${values.length + 1}`);
        values.push(price_lte);
      }

      let queryString = `SELECT p.id, p.title, p.images, p.rating, p.price, b.name AS brand, c.name AS category FROM product p JOIN brand b ON p.brand_id = b.id JOIN category c ON p.category_id = c.id`;

      if (q) {
        const query = q.trim().toLowerCase();
        filters.push(
          `to_tsvector(p.title || ' ' || b.name || ' ' || c.name) @@ plainto_tsquery($${
            values.length + 1
          })`
        );
        values.push(query);
      }

      if (filters.length) {
        queryString += ' WHERE ' + filters.join(' AND ');
      }

      if (page && limit) {
        const pageValue = page || 1;
        const limitValue = limit || 10;
        const offset = (pageValue - 1) * limitValue;

        queryString += ` LIMIT ${limitValue} OFFSET ${offset}`;
      }

      const [result, count] = await Promise.all([
        query<Product>(queryString, values),
        query<{ total_count: number }>(
          `SELECT COUNT(p.id) AS total_count 
          FROM product p 
          JOIN brand b ON p.brand_id = b.id 
          JOIN category c ON p.category_id = c.id
          ${filters.length ? ' WHERE ' + filters.join(' AND ') : ''}`,
          values
        ),
      ]);

      return { rows: result.rows, totalCount: count.rows[0].total_count };
    } catch (err) {
      console.error(err);
      throw new Error('Internal server error');
    }
  };

  getProductsByIds = async (
    productIds: number[]
  ): Promise<{ price: number; id: number }[]> => {
    const productPrices = await query<{ price: number; id: number }>(
      `SELECT price, id FROM product WHERE id = ANY($1)`,
      [productIds]
    );

    return productPrices.rows;
  };

  getProductById = async (productId: number): Promise<Product | null> => {
    try {
      const result = await query<Product>(
        `SELECT p.id, p.title, p.images, p.rating, p.price, b.name AS brand, c.name AS category
        FROM product p
        JOIN brand b ON p.brand_id = b.id
        JOIN category c ON p.category_id = c.id WHERE p.id = $1`,
        [productId]
      );
      if (result.rowCount === 0) {
        return null;
      }

      return result.rows[0];
    } catch (err) {
      console.error(err);
      throw new Error('Internal server error');
    }
  };

  createProduct = async (
    title: string,
    images: string[],
    rating: number,
    price: number,
    brand: string,
    category: string,
    userId: number
  ): Promise<Product> => {
    try {
      const brandId = await brandService.findBrandIdByName(brand);
      const categoryId = await categoryService.findCategoryIdByName(category);
      const product = await query<Product>(
        'INSERT INTO product (title, images, rating, price, brand_id, category_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, images, rating, price, brand_id, category_id',
        [title, JSON.stringify(images), rating, price, brandId, categoryId]
      );

      const user = await userService.getUserById(userId);

      await logService.createLog('add', user.id, product.rows[0].title);

      const row = product.rows[0];

      return {
        ...row,
        brand,
        category,
      };
    } catch (err) {
      console.error(err);
      throw new Error('Internal server error');
    }
  };

  updateProduct = async (
    id: number,
    title: string,
    images: string[],
    rating: number,
    price: number,
    brandName: string,
    categoryName: string
  ): Promise<Product> => {
    const brandId = await brandService.findBrandIdByName(brandName);
    const categoryId = await categoryService.findCategoryIdByName(categoryName);
    const result = await query<Product>(
      'UPDATE product SET title = $1, images = $2, rating = $3, price = $4, brand_id = $5, category_id = $6 WHERE id = $7 RETURNING *',
      [title, images, rating, price, brandId, categoryId, id]
    );
    return result.rows[0];
  };

  deleteProduct = async (id: number, userId: number): Promise<Product> => {
    const product = await query<Product>(
      'DELETE FROM product WHERE id = $1 RETURNING *',
      [id]
    );

    const user = await userService.getUserById(userId);

    await logService.createLog('remove', user.id, product.rows[0].title);

    return product.rows[0];
  };
}

export default new ProductService();
