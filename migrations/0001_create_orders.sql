CREATE TABLE IF NOT EXISTS orders (
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
    CHECK (status IN ('قيد التأكيد', 'مؤكد', 'غير مجاب', 'ملغى')),
  tracking_number TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS orders_order_date_idx ON orders (order_date DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
