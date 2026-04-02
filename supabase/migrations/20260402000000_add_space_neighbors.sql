CREATE TABLE space_neighbors (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id          TEXT        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  neighbor_space_id TEXT        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (space_id, neighbor_space_id)
);

ALTER TABLE space_neighbors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read space_neighbors"
  ON space_neighbors FOR SELECT USING (true);

CREATE POLICY "admin write space_neighbors"
  ON space_neighbors FOR INSERT WITH CHECK (true);

CREATE POLICY "admin delete space_neighbors"
  ON space_neighbors FOR DELETE USING (true);
