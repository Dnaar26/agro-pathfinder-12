-- Migration: Add category column to inventory_items table if not exists

ALTER TABLE public.inventory_items 
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Otro';

-- Update existing inventory items with appropriate categories based on their names
UPDATE public.inventory_items
SET category = CASE
  WHEN lower(name) ~ '(fertiliz|urea|npk|compost|abono|cal |dolomit)' THEN 'Fertilizante'
  WHEN lower(name) ~ '(insectic|herbic|fungic|plaguic|caldo|acaric|cipermetrina|glifosato)' THEN 'Plaguicida'
  WHEN lower(name) ~ '(semill|plantul|germinad|esqueje)' THEN 'Semilla'
  WHEN lower(name) ~ '(bomba|machete|tijera|manguera|tutor|trampa|herramienta)' THEN 'Herramienta'
  WHEN lower(name) ~ '(gasolina|diesel|acpm|combust)' THEN 'Combustible'
  ELSE 'Otro'
END
WHERE category IS NULL OR category = 'Otro' OR category = '';
