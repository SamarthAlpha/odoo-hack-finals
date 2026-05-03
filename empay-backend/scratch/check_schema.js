const db = require('../src/db/connection');
async function check() {
  try {
    const [cols] = await db.execute('DESCRIBE leave_balances');
    console.log('leave_balances columns:', cols.map(c => c.Field));
    const [cols2] = await db.execute('DESCRIBE time_off_requests');
    console.log('time_off_requests columns:', cols2.map(c => c.Field));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
