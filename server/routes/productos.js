const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const { parse } = require('csv-parse');
const xlsx = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });

router.use(auth);

// GET all with filters
router.get('/', async (req, res, next) => {
  try {
    let query = `
      SELECT p.*, c.nombre as categoria_nombre, m.nombre as material_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN materiales m ON p.material_id = m.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.query.categoria_id) {
      query += ` AND p.categoria_id = $${paramIndex++}`;
      params.push(req.query.categoria_id);
    }
    if (req.query.material_id) {
      query += ` AND p.material_id = $${paramIndex++}`;
      params.push(req.query.material_id);
    }
    if (req.query.stock_bajo === 'true') {
      query += ` AND p.stock_actual <= p.stock_minimo`;
    }
    if (req.query.precio_min) {
      query += ` AND p.precio_venta >= $${paramIndex++}`;
      params.push(req.query.precio_min);
    }
    if (req.query.precio_max) {
      query += ` AND p.precio_venta <= $${paramIndex++}`;
      params.push(req.query.precio_max);
    }
    if (req.query.estado) {
      query += ` AND p.activo = $${paramIndex++}`;
      params.push(req.query.estado === 'activo');
    } else {
      query += ` AND p.activo = true`;
    }

    query += ' ORDER BY p.nombre ASC';
    const result = await db.query(query, params);
    const productos = result.rows;

    // Fetch variants for products that have them
    const prodIdsWithVariants = productos.filter(p => p.tiene_variantes).map(p => p.id);
    if (prodIdsWithVariants.length > 0) {
      const varRes = await db.query(
        'SELECT * FROM producto_variantes WHERE producto_id = ANY($1) AND activo = true ORDER BY nombre_variante ASC',
        [prodIdsWithVariants]
      );
      const variantesMap = {};
      varRes.rows.forEach(v => {
        if (!variantesMap[v.producto_id]) variantesMap[v.producto_id] = [];
        variantesMap[v.producto_id].push(v);
      });
      productos.forEach(p => {
        if (p.tiene_variantes) {
          p.variantes = variantesMap[p.id] || [];
        }
      });
    }

    res.json({ success: true, data: productos });
  } catch (err) {
    next(err);
  }
});

// GET search
router.get('/search', async (req, res, next) => {
  try {
    const term = `%${req.query.q || ''}%`;
    const result = await db.query(`
      SELECT p.*, c.nombre as categoria_nombre, m.nombre as material_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN materiales m ON p.material_id = m.id
      WHERE p.activo = true 
        AND (p.nombre ILIKE $1 OR p.codigo ILIKE $1 OR c.nombre ILIKE $1)
      ORDER BY p.nombre ASC LIMIT 50
    `, [term]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET by exact SKU (product or variant)
router.get('/sku/:sku', async (req, res, next) => {
  try {
    const sku = req.params.sku;
    
    // First check variants
    const varRes = await db.query(`
      SELECT v.*, p.nombre as producto_nombre
      FROM producto_variantes v
      JOIN productos p ON v.producto_id = p.id
      WHERE v.sku ILIKE $1 AND v.activo = true AND p.activo = true
    `, [sku]);
    
    if (varRes.rows.length > 0) {
      const v = varRes.rows[0];
      return res.json({
        success: true,
        type: 'variant',
        data: {
          id: v.producto_id,
          variant_id: v.id,
          nombre: `${v.producto_nombre} - ${v.nombre_variante}`,
          codigo: v.sku,
          precio_venta: v.precio_venta || (await db.query('SELECT precio_venta FROM productos WHERE id=$1', [v.producto_id])).rows[0].precio_venta,
          stock_actual: v.stock_actual,
          descuento_porcentaje: 0 // Simplification
        }
      });
    }

    // Then check base products
    const prodRes = await db.query(`
      SELECT * FROM productos WHERE codigo ILIKE $1 AND activo = true
    `, [sku]);

    if (prodRes.rows.length > 0) {
      return res.json({
        success: true,
        type: 'product',
        data: prodRes.rows[0]
      });
    }

    res.status(404).json({ success: false, message: 'SKU no encontrado' });
  } catch (err) {
    next(err);
  }
});

// GET by id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT p.*, c.nombre as categoria_nombre, m.nombre as material_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN materiales m ON p.material_id = m.id
      WHERE p.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    
    const product = result.rows[0];
    
    // Fetch variants
    if (product.tiene_variantes) {
      const variantsRes = await db.query(
        'SELECT * FROM producto_variantes WHERE producto_id = $1 AND activo = true ORDER BY nombre_variante ASC',
        [req.params.id]
      );
      product.variantes = variantsRes.rows;
    } else {
      product.variantes = [];
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

// POST create
router.post('/', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { 
      codigo, nombre, descripcion, categoria_id, material_id, 
      peso_gramos, precio_compra, precio_venta, stock_actual, stock_minimo, 
      descuento_porcentaje, imagen_path 
    } = req.body;

    const finalCodigo = codigo || `JM-PRD-${Math.floor(100000 + Math.random() * 900000)}`;

    const result = await client.query(`
      INSERT INTO productos (
        codigo, nombre, descripcion, categoria_id, material_id,
        peso_gramos, precio_compra, precio_venta, stock_actual, stock_minimo,
        descuento_porcentaje, imagen_path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id
    `, [
      finalCodigo, nombre, descripcion || '', categoria_id || null, material_id || null,
      peso_gramos || 0, precio_compra || 0, precio_venta, stock_actual || 0, stock_minimo || 1,
      descuento_porcentaje || 0, imagen_path || null
    ]);

    const newId = result.rows[0].id;

    if (!codigo) {
      let prefix = 'PROD';
      if (categoria_id) {
        const catRes = await client.query('SELECT nombre FROM categorias WHERE id = $1', [categoria_id]);
        if (catRes.rows.length > 0) prefix = catRes.rows[0].nombre.substring(0, 3).toUpperCase();
      }
      const newCodigo = `${prefix}-${String(newId).padStart(4, '0')}`;
      await client.query('UPDATE productos SET codigo = $1 WHERE id = $2', [newCodigo, newId]);
    }

    await client.query('COMMIT');
    
    // Emit real-time event
    const io = req.app.get('io');
    if (io) io.emit('product:created', { id: newId });

    res.json({ success: true, id: newId });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PUT update
router.put('/:id', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    // Check price change
    if (req.body.precio_venta !== undefined) {
      const currentRes = await client.query('SELECT precio_venta FROM productos WHERE id = $1', [id]);
      if (currentRes.rows.length > 0) {
        const currentPrice = parseFloat(currentRes.rows[0].precio_venta);
        const newPrice = parseFloat(req.body.precio_venta);
        if (currentPrice !== newPrice) {
          await client.query(
            'INSERT INTO historial_precios (producto_id, precio_anterior, precio_nuevo) VALUES ($1, $2, $3)',
            [id, currentPrice, newPrice]
          );
        }
      }
    }

    const fields = [];
    const values = [];
    let paramIdx = 1;
    
    const allowed = ['codigo', 'nombre', 'descripcion', 'categoria_id', 'material_id',
      'peso_gramos', 'precio_compra', 'precio_venta', 'stock_actual', 'stock_minimo',
      'descuento_porcentaje', 'imagen_path', 'activo'];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${paramIdx++}`);
        values.push(req.body[key]);
      }
    }

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(id);
      await client.query(`UPDATE productos SET ${fields.join(', ')} WHERE id = $${paramIdx}`, values);
    }

    await client.query('COMMIT');
    
    // Emit real-time event
    const io = req.app.get('io');
    if (io) io.emit('product:updated', { id });

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE soft
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE productos SET activo = false, updated_at = NOW() WHERE id = $1', [id]);
    
    const io = req.app.get('io');
    if (io) io.emit('product:deleted', { id });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST import Excel
router.post('/import-excel', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  
  const client = await db.pool.connect();
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const records = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    if (records.length === 0) return res.status(400).json({ success: false, message: 'El archivo está vacío' });

    await client.query('BEGIN');
    
    // Group by 'Nombre Producto' + 'Categoría' + 'Material'
    const grouped = {};
    for (const row of records) {
      let nombre = row['Nombre Producto'];
      if (!nombre) continue;
      
      if (typeof nombre === 'string') {
        nombre = nombre.trim();
        row['Nombre Producto'] = nombre;
      }
      
      let cat = row['Categoría'] || '';
      if (typeof cat === 'string') {
        cat = cat.trim();
        row['Categoría'] = cat;
      }

      let mat = row['Material'] || '';
      if (typeof mat === 'string') {
        mat = mat.trim();
        row['Material'] = mat;
      }
      
      const groupKey = `${nombre}|${cat.toLowerCase()}|${mat.toLowerCase()}`;
      if (!grouped[groupKey]) grouped[groupKey] = [];
      grouped[groupKey].push(row);
    }

    let addedProducts = 0;
    let addedVariants = 0;

    for (const key in grouped) {
      const items = grouped[key];
      const nombre = items[0]['Nombre Producto'];
      
      // Determine if simple product or variants
      const hasVariants = items.some(i => i['Variante']);
      
      // Get category and material from first item
      const catName = items[0]['Categoría'];
      const matName = items[0]['Material'];
      let catId = null, matId = null;

      if (catName) {
        let catRes = await client.query('SELECT id, activo FROM categorias WHERE LOWER(nombre) = LOWER($1)', [catName]);
        if (catRes.rows.length === 0) {
          catRes = await client.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [catName]);
        } else if (catRes.rows[0].activo === false) {
          await client.query('UPDATE categorias SET activo = true WHERE id = $1', [catRes.rows[0].id]);
        }
        catId = catRes.rows[0].id;
      }
      if (matName) {
        let matRes = await client.query('SELECT id, activo FROM materiales WHERE LOWER(nombre) = LOWER($1)', [matName]);
        if (matRes.rows.length === 0) {
          matRes = await client.query('INSERT INTO materiales (nombre) VALUES ($1) RETURNING id', [matName]);
        } else if (matRes.rows[0].activo === false) {
          await client.query('UPDATE materiales SET activo = true WHERE id = $1', [matRes.rows[0].id]);
        }
        matId = matRes.rows[0].id;
      }

      if (!hasVariants) {
        // Simple product
        const item = items[0];
        const precio_venta = parseFloat(item['Precio Venta']) || 0;
        const precio_compra = parseFloat(item['Precio Compra']) || 0;
        const stock = parseInt(item['Stock']) || 0;
        const stock_min = parseInt(item['Stock Mínimo']) || 1;
        const peso = parseFloat(item['Peso (g)']) || 0;
        let sku = item['SKU'] || `JM-PRD-${Math.floor(100000 + Math.random() * 900000)}`;

        const prodRes = await client.query(`
          INSERT INTO productos (
            codigo, nombre, descripcion, categoria_id, material_id,
            peso_gramos, precio_compra, precio_venta, stock_actual, stock_minimo, tiene_variantes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE) RETURNING id
        `, [
          sku, nombre, item['Descripción'] || '', catId, matId,
          peso, precio_compra, precio_venta, stock, stock_min
        ]);
        
        addedProducts++;
      } else {
        // Product with variants
        // Base product takes minimum price and total stock
        const totalStock = items.reduce((sum, item) => sum + (parseInt(item['Stock']) || 0), 0);
        const minPrice = Math.min(...items.map(item => parseFloat(item['Precio Venta']) || 0));
        
        const prodRes = await client.query(`
          INSERT INTO productos (
            nombre, descripcion, categoria_id, material_id,
            precio_venta, stock_actual, tiene_variantes
          ) VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id
        `, [
          nombre, items[0]['Descripción'] || '', catId, matId,
          minPrice, totalStock
        ]);
        const baseId = prodRes.rows[0].id;
        addedProducts++;

        // Insert variants
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const precio_venta = parseFloat(item['Precio Venta']) || 0;
          const precio_compra = parseFloat(item['Precio Compra']) || 0;
          const stock = parseInt(item['Stock']) || 0;
          const stock_min = parseInt(item['Stock Mínimo']) || 1;
          const peso = parseFloat(item['Peso (g)']) || 0;
          let sku = item['SKU'] || `JM-VAR-${Math.floor(100000 + Math.random() * 900000)}`;

          await client.query(`
            INSERT INTO producto_variantes (
              producto_id, sku, nombre_variante,
              atributo_1_nombre, atributo_1_valor,
              atributo_2_nombre, atributo_2_valor,
              precio_venta, precio_compra, stock_actual, stock_minimo, peso_gramos
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [
            baseId, sku, item['Variante'] || item['Valor 1'] || 'Única',
            item['Atributo 1'] || '', item['Valor 1'] || '',
            item['Atributo 2'] || '', item['Valor 2'] || '',
            precio_venta, precio_compra, stock, stock_min, peso
          ]);
          addedVariants++;
        }
      }
    }

    await client.query('COMMIT');
    
    const io = req.app.get('io');
    if (io) {
      io.emit('product:updated');
      io.emit('stock:changed');
    }

    res.json({ success: true, message: `Importación exitosa: ${addedProducts} productos, ${addedVariants} variantes` });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
