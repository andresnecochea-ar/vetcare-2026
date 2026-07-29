CREATE TABLE IF NOT EXISTS invoice_sequence (
  id TEXT PRIMARY KEY CHECK (id = 'singleton'),
  lastNumber INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO invoice_sequence (id, lastNumber)
SELECT
  'singleton',
  COALESCE(MAX(
    CASE
      WHEN number <> '' AND number NOT GLOB '*[^0-9]*' THEN CAST(number AS INTEGER)
      ELSE 0
    END
  ), 0)
FROM invoices;
