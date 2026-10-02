CREATE TABLE orders_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  wilaya TEXT NOT NULL,
  municipality TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('منزل', 'مكتب')),
  product TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  items_json TEXT NOT NULL,
  total_price INTEGER NOT NULL CHECK (total_price >= 0),
  order_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'قيد التأكيد'
    CHECK (status IN ('قيد التأكيد', 'مؤكد', 'لم يرد 1', 'لم يرد 2', 'غير مجاب', 'تم التسليم', 'مرتجع', 'ملغى')),
  tracking_number TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  shipping_state TEXT NOT NULL DEFAULT '',
  shipping_desc TEXT NOT NULL DEFAULT '',
  shipping_color TEXT NOT NULL DEFAULT '',
  shipping_checked_at TEXT NOT NULL DEFAULT '',
  shipping_return INTEGER NOT NULL DEFAULT 0
);

INSERT INTO orders_new
  (id, customer_name, phone, wilaya, municipality, address, delivery_type, product, quantity,
   items_json, total_price, order_date, status, tracking_number, notes,
   shipping_state, shipping_desc, shipping_color, shipping_checked_at)
SELECT id, customer_name, phone, wilaya, municipality, address, delivery_type, product, quantity,
   items_json, total_price, order_date, status, tracking_number, notes,
   shipping_state, shipping_desc, shipping_color, shipping_checked_at
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

CREATE INDEX IF NOT EXISTS orders_order_date_idx ON orders (order_date DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders (phone);

CREATE TABLE IF NOT EXISTS customer_risk (
  phone TEXT PRIMARY KEY,
  total INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  returned INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
