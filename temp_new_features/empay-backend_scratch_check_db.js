
const db = require('./src/db/connection');
async function run() {
  try {
    const [rows] = await db.execute('SELECT id, first_name, last_name, user_id FROM employees');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();



empay-frontend\scratch\check_balance.py


content = open(r"d:\Oddo\odoo-hack-finals\empay-frontend\src\pages\EmployeeProfilePage.jsx", "r", encoding="utf-8").read()
print(f"Braces: {{: {content.count('{')}, }}: {content.count('}')}")
print(f"Parens: (: {content.count('(')}, ): {content.count(')')}")
print(f"Fragments: <>: {content.count('<>')}, </>: {content.count('</>')}")


