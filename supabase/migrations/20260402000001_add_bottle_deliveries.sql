CREATE TABLE bottle_deliveries (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id      TEXT        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  hossii_id     TEXT        NOT NULL REFERENCES hossiis(id) ON DELETE CASCADE,
  from_space_id TEXT        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  delivered_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bottle_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read bottle_deliveries"
  ON bottle_deliveries FOR SELECT USING (true);

CREATE POLICY "public insert bottle_deliveries"
  ON bottle_deliveries FOR INSERT WITH CHECK (true);
