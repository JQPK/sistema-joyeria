const xlsx = require('xlsx');

try {
  const filePath = 'C:\\Users\\cupej\\Downloads\\inventario_template.xlsx';
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log('Total rows:', data.length);
  // Print first few rows to understand structure
  console.log('First 10 rows:');
  console.log(JSON.stringify(data.slice(0, 10), null, 2));
  
  // Print unique values for category, material
  const categories = [...new Set(data.map(d => d['Categoría']))];
  const materials = [...new Set(data.map(d => d['Material']))];
  console.log('\nCategories:', categories);
  console.log('Materials:', materials);

} catch (err) {
  console.error('Error reading Excel:', err.message);
}
