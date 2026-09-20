-- Catálogo ampliado de cultivos colombianos para SIGIC
INSERT INTO public.crop_catalog (code, name, cycle_days) VALUES
  ('AGUACATE', 'Aguacate', 365),
  ('MARACUYA', 'Maracuyá', 240),
  ('MANGO', 'Mango', 330),
  ('LIMON', 'Limón', 270),
  ('PAPAYA', 'Papaya', 240),
  ('GUAYABA', 'Guayaba', 210),
  ('MORA', 'Mora', 180),
  ('UCHUVA', 'Uchuva', 240),
  ('CEBOLLA', 'Cebolla', 130),
  ('ALGODON', 'Algodón', 150),
  ('SORGO', 'Sorgo', 110),
  ('ARROZ', 'Arroz', 140),
  ('CANIA_AZUCAR', 'Caña de azúcar', 420),
  ('PALMA_ACEITERA', 'Palma aceitera', 1095)
ON CONFLICT (code) DO NOTHING;
