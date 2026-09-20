CREATE TABLE IF NOT EXISTS pest_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  pest_name TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('BAJA','MEDIA','ALTA','CRITICA')) DEFAULT 'MEDIA',
  treatment TEXT,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pest_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their pest incidents" ON pest_incidents
  FOR ALL USING (
    crop_id IN (SELECT id FROM crops WHERE parcel_id IN (SELECT id FROM parcels WHERE owner_id = auth.uid()))
  );
