CREATE TABLE IF NOT EXISTS invitation_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  max_devices INTEGER NOT NULL DEFAULT 5
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  browser TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  first_active_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  FOREIGN KEY (code) REFERENCES invitation_codes(code)
);

CREATE INDEX IF NOT EXISTS idx_devices_code ON devices(code);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_devices_last_active ON devices(last_active_at);
