const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const headers = [
  'Nombre Producto',
  'Variante',
  'Atributo 1',
  'Valor 1',
  'Atributo 2',
  'Valor 2',
  'SKU',
  'Precio Compra',
  'Precio Venta',
  'Stock',
  'Stock Mínimo',
  'Peso (g)',
  'Categoría',
  'Material',
  'Descripción'
];

const data = [
  {
    'Nombre Producto': 'Anillo Solitario',
    'Variante': 'Talla 6 / Oro 18k',
    'Atributo 1': 'Talla',
    'Valor 1': '6',
    'Atributo 2': 'Material',
    'Valor 2': 'Oro 18k',
    'SKU': 'ANI-0001-T6-O18',
    'Precio Compra': 400,
    'Precio Venta': 850,
    'Stock': 3,
    'Stock Mínimo': 1,
    'Peso (g)': 5.5,
    'Categoría': 'Anillos',
    'Material': 'Oro 18k',
    'Descripción': 'Anillo con diamante de 0.5 quilates'
  },
  {
    'Nombre Producto': 'Anillo Solitario',
    'Variante': 'Talla 7 / Oro 18k',
    'Atributo 1': 'Talla',
    'Valor 1': '7',
    'Atributo 2': 'Material',
    'Valor 2': 'Oro 18k',
    'SKU': 'ANI-0001-T7-O18',
    'Precio Compra': 400,
    'Precio Venta': 850,
    'Stock': 2,
    'Stock Mínimo': 1,
    'Peso (g)': 5.8,
    'Categoría': 'Anillos',
    'Material': 'Oro 18k',
    'Descripción': 'Anillo con diamante de 0.5 quilates'
  },
  {
    'Nombre Producto': 'Collar Perlas Naturales',
    'Variante': '',
    'Atributo 1': '',
    'Valor 1': '',
    'Atributo 2': '',
    'Valor 2': '',
    'SKU': 'COL-0001',
    'Precio Compra': 200,
    'Precio Venta': 450,
    'Stock': 4,
    'Stock Mínimo': 1,
    'Peso (g)': 15,
    'Categoría': 'Collares',
    'Material': '',
    'Descripción': 'Collar de perlas cultivadas'
  }
];

const ws = xlsx.utils.json_to_sheet(data, { header: headers });
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Inventario');

const dir = path.join(__dirname, '..', 'client', 'plantillas');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

xlsx.writeFile(wb, path.join(dir, 'inventario_template.xlsx'));
console.log('Template created');
