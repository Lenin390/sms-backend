require('dotenv').config();
const token = process.argv[2];
if (!token) {
  console.error('Usage: node scripts/post_order.js <JWT>');
  process.exit(1);
}

const body = {
  clientName: 'Acme Corp',
  clientPhone: '0123456789',
  deliveryDate: new Date().toISOString(),
  amount: 100.0,
  advancePayment: 10.0,
  instructions: 'Test order from script',
};

(async () => {
  try {
    const res = await fetch('http://localhost:5000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log(text);
  } catch (err) {
    console.error(err);
  }
})();
