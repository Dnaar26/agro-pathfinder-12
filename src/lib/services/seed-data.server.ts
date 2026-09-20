import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

/** Extrae y verifica JWT del request, luego verifica que el usuario sea admin */
async function requireAdmin(): Promise<string> {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("No autorizado: token requerido");
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("No autorizado: token inválido");
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!roles?.some((r) => r.role === "admin")) throw new Error("No autorizado: se requiere rol admin");
  return user.id;
}

const PASSWORD = "Demo123!";

const FARMERS = [
  { name: "Carlos Mamani", phone: "999111001", email: "carlos.mamani@test.sgic" },
  { name: "Juana Quispe", phone: "999111002", email: "juana.quispe@test.sgic" },
  { name: "Pedro Huamán", phone: "999111003", email: "pedro.huaman@test.sgic" },
  { name: "Rosa Condori", phone: "999111004", email: "rosa.condori@test.sgic" },
  { name: "Luis Torres", phone: "999111005", email: "luis.torres@test.sgic" },
  { name: "María Vargas", phone: "999111006", email: "maria.vargas@test.sgic" },
  { name: "José Flores", phone: "999111007", email: "jose.flores@test.sgic" },
  { name: "Elena Rivas", phone: "999111008", email: "elena.rivas@test.sgic" },
  { name: "Diego Paredes", phone: "999111009", email: "diego.paredes@test.sgic" },
  { name: "Lucía Morales", phone: "999111010", email: "lucia.morales@test.sgic" },
  { name: "Andrés Huerta", phone: "999111011", email: "andres.huerta@test.sgic" },
  { name: "Sofía Castillo", phone: "999111012", email: "sofia.castillo@test.sgic" },
  { name: "Fernando Rojas", phone: "999111013", email: "fernando.rojas@test.sgic" },
  { name: "Carmen Delgado", phone: "999111014", email: "carmen.delgado@test.sgic" },
  { name: "Ricardo Ramos", phone: "999111015", email: "ricardo.ramos@test.sgic" },
];

const TECNICOS = [
  { name: "Andrea Jiménez", phone: "999111026", email: "andrea.jimenez@tec.sgic" },
  { name: "Jorge Rincón", phone: "999111027", email: "jorge.rincon@tec.sgic" },
];

const ADMIN_SEED = { name: "Admin SIGIC", phone: "999111000", email: "admin@sgic.local" };

const SOIL_NAMES = ["Franco", "Arcilloso", "Arenoso", "Limoso", "Franco arcilloso"];

const CROP_CATALOG = [
  { id: 1, name: "Maíz", cycle: 120, yldLow: 3000, yldHigh: 6000, prcLow: 1200, prcHigh: 2500, costFactor: 1.0 },
  { id: 2, name: "Frijol", cycle: 90, yldLow: 1200, yldHigh: 2500, prcLow: 4000, prcHigh: 8000, costFactor: 0.9 },
  { id: 3, name: "Café", cycle: 270, yldLow: 1000, yldHigh: 2000, prcLow: 8000, prcHigh: 18000, costFactor: 1.5 },
  { id: 4, name: "Plátano", cycle: 300, yldLow: 8000, yldHigh: 15000, prcLow: 1500, prcHigh: 3000, costFactor: 0.8 },
  { id: 5, name: "Yuca", cycle: 270, yldLow: 10000, yldHigh: 25000, prcLow: 1200, prcHigh: 2500, costFactor: 0.7 },
  { id: 6, name: "Papa", cycle: 110, yldLow: 15000, yldHigh: 35000, prcLow: 1000, prcHigh: 3000, costFactor: 1.2 },
  { id: 7, name: "Tomate", cycle: 95, yldLow: 25000, yldHigh: 50000, prcLow: 1500, prcHigh: 5000, costFactor: 1.4 },
  { id: 8, name: "Cacao", cycle: 365, yldLow: 400, yldHigh: 1000, prcLow: 12000, prcHigh: 25000, costFactor: 1.1 },
  { id: 9, name: "Aguacate", cycle: 365, yldLow: 8000, yldHigh: 15000, prcLow: 3500, prcHigh: 8000, costFactor: 1.3 },
  { id: 10, name: "Maracuyá", cycle: 240, yldLow: 12000, yldHigh: 20000, prcLow: 3000, prcHigh: 7000, costFactor: 1.1 },
  { id: 11, name: "Mango", cycle: 330, yldLow: 10000, yldHigh: 18000, prcLow: 2000, prcHigh: 5000, costFactor: 0.9 },
  { id: 12, name: "Limón", cycle: 270, yldLow: 12000, yldHigh: 20000, prcLow: 2500, prcHigh: 6000, costFactor: 0.8 },
  { id: 13, name: "Papaya", cycle: 240, yldLow: 25000, yldHigh: 50000, prcLow: 1500, prcHigh: 3500, costFactor: 1.0 },
  { id: 14, name: "Guayaba", cycle: 210, yldLow: 15000, yldHigh: 25000, prcLow: 2000, prcHigh: 4000, costFactor: 0.8 },
  { id: 15, name: "Mora", cycle: 180, yldLow: 5000, yldHigh: 10000, prcLow: 5000, prcHigh: 12000, costFactor: 1.2 },
  { id: 16, name: "Uchuva", cycle: 240, yldLow: 3000, yldHigh: 6000, prcLow: 8000, prcHigh: 18000, costFactor: 1.4 },
  { id: 17, name: "Cebolla", cycle: 130, yldLow: 15000, yldHigh: 30000, prcLow: 1500, prcHigh: 3500, costFactor: 1.0 },
  { id: 18, name: "Algodón", cycle: 150, yldLow: 2000, yldHigh: 4000, prcLow: 3000, prcHigh: 6000, costFactor: 1.1 },
  { id: 19, name: "Sorgo", cycle: 110, yldLow: 3000, yldHigh: 5000, prcLow: 1200, prcHigh: 2000, costFactor: 0.7 },
  { id: 20, name: "Arroz", cycle: 140, yldLow: 4000, yldHigh: 7000, prcLow: 2000, prcHigh: 3500, costFactor: 1.3 },
  { id: 21, name: "Caña de azúcar", cycle: 420, yldLow: 80000, yldHigh: 130000, prcLow: 100, prcHigh: 350, costFactor: 1.6 },
  { id: 22, name: "Palma aceitera", cycle: 1095, yldLow: 15000, yldHigh: 25000, prcLow: 1800, prcHigh: 4000, costFactor: 1.5 },
];

const ACTIVITY_KINDS = ["RIEGO", "FERTILIZACION", "MONITOREO", "CONTROL_PLAGAS", "PODA", "COSECHA"] as const;

const ACTIVITY_NOTES: Record<string, string[]> = {
  RIEGO: ["Riego por goteo 2h — caudal 4L/h por emisor", "Riego por aspersión 45 min sector norte", "Riego manual con manguera sector A (cultivos sensibles)", "Riego matinal completo 6:00-9:00 am", "Riego de emergencia por ola de calor — 3h continuas", "Riego por gravedad canal abierto (sucros)", "Fertirriego con bomba dosificadora Venturi 1h", "Riego nocturno sector B + aplicación de fertirriego", "Riego complementario por déficit hídrico — 2 sectores"],
  FERTILIZACION: ["Aplicación NPK 20-20-200 al voleo 250 kg/ha", "Fertilización foliar vía mochila 20L de solución", "Urea granulada 46% 150 kg/ha", "Abono orgánico compostado 5 ton/ha distribuido en surcos", "Fertilización potásica KCl 60% 120 kg/ha", "Encalado de suelo con cal dolomítica 1.5 ton/ha", "Aplicación de gallinaza compostada 3 ton/ha", "Fertilización edáfica profunda con sulpomag 200 kg/ha", "Abonada de cobertura con DAP 18-46-0 80 kg/ha", "Aplicación de quelatos (Fe+Zn+Mn) vía foliar"],
  MONITOREO: ["Revisión general del cultivo — 100% de la parcela", "Monitoreo de plagas con lupa entomológica (10 puntos)", "Control de crecimiento: medición de altura y cobertura", "Evaluación de humedad del suelo con tensiómetro", "Inspección de frutos (tamaño, color, sanidad)", "Toma de muestra foliar para análisis nutricional", "Medición de pH del suelo con potenciómetro", "Evaluación de drenaje y escorrentía superficial", "Monitoreo de enfermedades (incidencia y severidad)", "Registro fotográfico de evolución del cultivo"],
  CONTROL_PLAGAS: ["Aplicación de caldo bordelés 5% al amanecer", "Control biológico con Trichoderma harzianum 2 kg/ha", "Instalación de trampas McPhail para mosca de la fruta", "Poda sanitaria de ramas afectadas (quema de residuos)", "Aplicación de aceite agrícola mineral 1.5% v/v", "Liberación de controladores biológicos (Chrysoperla carnea)", "Trampas de feromonas para picudo del agave (10 trampas/ha)", "Aplicación de Bacillus thuringiensis 1 kg/ha", "Aspersión con azufre micronizado 3 kg/ha"],
  PODA: ["Poda de formación (primer año de establecimiento)", "Poda sanitaria — remoción de tejido afectado", "Deshoje fitosanitario (eliminar hojas bajeras senescentes)", "Aclareo de frutos (dejar 2-3 frutos por racimo)", "Poda de mantenimiento (ramas cruzadas y chupones)", "Poda de recepa (renovación cada 4-5 años)", "Deschuponado de brotes basales", "Deshoje de plantas: eliminar tercio inferior", "Poda de renovación post-cosecha"],
  COSECHA: ["Cosecha manual selectiva (solo frutos maduros)", "Cosecha mecanizada con cosechadora de arrastre", "Recolección de frutos maduros en canastillas plásticas", "Cosecha de parcela completa — cuadrilla de 6 personas", "Cosecha parcial sector norte (maduración anticipada)", "Corte de caña manual con machete — rendimiento 2 ton/jornal", "Recolección de café cereza — 120 kg/día por recolector", "Ordeño de palma aceitera — frutos sueltos cosechados", "Rebusca manual: recolección de frutos remanentes"],
};

const PEST_RECORDS = [
  { name: "Mosca blanca", treatment: "Aplicación de imidacloprid + aceite agrícola" },
  { name: "Gusano cogollero", treatment: "Control biológico con Bacillus thuringiensis" },
  { name: "Pulgón", treatment: "Jabón potásico + extracto de neem" },
  { name: "Trips", treatment: "Trampas cromáticas azules + spinosad" },
  { name: "Oidium", treatment: "Azufre micronizado semanal" },
  { name: "Phytophthora", treatment: "Fungicida cúprico + drenaje" },
  { name: "Minador de hoja", treatment: "Control biológico con parasitoides" },
  { name: "Roya", treatment: "Poda sanitaria + fungicida sistémico" },
  { name: "Barrenador del tallo", treatment: "Control biológico con Trichogramma" },
  { name: "Antracnosis", treatment: "Mancozeb + poda sanitaria cada 15 días" },
  { name: "Sigatoka negra", treatment: "Fungicida sistémico + deshoje fitosanitario" },
  { name: "Picudo del agave", treatment: "Trampas de feromonas + control manual" },
  { name: "Mosca de la fruta", treatment: "Trampas McPhail + cebo tóxico" },
  { name: "Perforador de la palma", treatment: "Inyección de nemátodos entomopatógenos" },
  { name: "Ácaro rojo", treatment: "Azufre micronizado + control biológico" },
];

const INVENTORY_ITEMS = [
  { name: "Fertilizante NPK 20-20-20", unit: "KG" as const, minStock: 10 },
  { name: "Urea agrícola", unit: "KG" as const, minStock: 20 },
  { name: "Insecticida cipermetrina", unit: "L" as const, minStock: 5 },
  { name: "Herbicida glifosato", unit: "L" as const, minStock: 5 },
  { name: "Caldo bordelés", unit: "KG" as const, minStock: 10 },
  { name: "Trampas cromáticas", unit: "UN" as const, minStock: 25 },
  { name: "Manguera de riego", unit: "UN" as const, minStock: 3 },
  { name: "Bombas de mochila", unit: "UN" as const, minStock: 2 },
  { name: "Semillas de papa", unit: "KG" as const, minStock: 15 },
  { name: "Abono orgánico compostado", unit: "KG" as const, minStock: 50 },
  { name: "Semillas de aguacate Hass", unit: "UN" as const, minStock: 50 },
  { name: "Fertilizante líquido foliar", unit: "L" as const, minStock: 10 },
  { name: "Tutores de bambú", unit: "UN" as const, minStock: 100 },
  { name: "Malla antipájaros", unit: "KG" as const, minStock: 10 },
  { name: "Acolchado plástico", unit: "KG" as const, minStock: 15 },
  { name: "Sustrato germinador", unit: "KG" as const, minStock: 25 },
  { name: "Bandejas germinadoras", unit: "UN" as const, minStock: 30 },
  { name: "Fungicida cúprico", unit: "KG" as const, minStock: 10 },
  { name: "Aceite agrícola mineral", unit: "L" as const, minStock: 10 },
  { name: "Bioestimulante radicular", unit: "L" as const, minStock: 5 },
  { name: "Trampas de feromonas", unit: "UN" as const, minStock: 20 },
  { name: "Machetes", unit: "UN" as const, minStock: 5 },
  { name: "Tijeras de podar", unit: "UN" as const, minStock: 5 },
  { name: "Guantes de caucho", unit: "UN" as const, minStock: 10 },
  { name: "Semillas de maíz híbrido", unit: "KG" as const, minStock: 8 },
  { name: "Semillas de arroz", unit: "KG" as const, minStock: 25 },
  { name: "Semillas de hortalizas", unit: "GR" as const, minStock: 100 },
];

const COST_KINDS = ["INSUMOS", "MANO_OBRA", "MAQUINARIA", "TRANSPORTE", "OTROS"];
const COST_DESCS: Record<string, string[]> = {
  INSUMOS: ["Semillas certificadas variedad mejorada", "Fertilizante NPK 20-20-20 x bulto 50kg", "Urea agrícola x bulto 50kg", "Caldo bordelés x 20kg", "Insecticida cipermetrina x 1L", "Herbicida glifosato x 4L", "Sustrato de germinación x saco 40L", "Tutores de bambú x 50 un", "Plántulas injertadas certificadas", "Acolchado plástico agrícola x rollo", "Malla antipájaros x 10m", "Abono orgánico compostado x tonelada", "Fungicida cúprico x 5kg", "Aceite agrícola mineral x 4L", "Bioestimulante radicular x 1L"],
  MANO_OBRA: ["Jornal de 8h preparación de terreno", "Destajo de cosecha por kg recolectado", "Jornal aplicación manual de fertilizantes", "Jornal deshierbe manual", "Jornal poda especializada", "Jornal riego manual sector A", "Jornal empaque y selección de producto", "Jornal vigilancia nocturna de cultivo", "Jornal clasificado de frutos por calidad", "Jornal aporque y acondicionamiento de surcos", "Jornal aplicación de caldo bordelés", "Medio jornal labores menores"],
  MAQUINARIA: ["Alquiler tractor agrícola 85hp x hora", "Motocultor para preparación de suelo x hora", "Bomba de agua 2 pulgadas x hora", "Fumigadora estacionaria x hora", "Sembradora mecánica de precisión x hora", "Desbrozadora manual x hora", "Cosechadora de forraje x hora", "Molino triturador de granos x hora", "Bomba centrífuga 3hp x hora", "Arado de disco x hora"],
  TRANSPORTE: ["Flete camión 5 ton a mercado local", "Traslado interno en carreta agrícola", "Transporte de insumos desde central de abastos", "Flete cosecha a planta de procesamiento", "Distribución a central de abastos mayorista", "Flete de exportación a puerto marítimo", "Camión refrigerado 8 ton", "Transporte de abono orgánico"],
  OTROS: ["Análisis de suelo completo (pH+MO+nutrientes)", "Asistencia técnica ingeniero agrónomo x visita", "Certificación GlobalG.A.P. anual", "Empaque tipo exportación x 100 un", "Análisis foliar (N-P-K-Ca-Mg)", "Control biológico Trichoderma x 1kg", "Alquiler de terreno temporal x hectárea", "Seguro agrícola contra heladas/sequía", "Análisis de agua de riego"],
};

const ALERT_TITLES: Record<string, { title: string; body: string }[]> = {
  RIEGO: [
    { title: "Riego programado urgente", body: "Cultivo alcanzó punto de marchitez. Requiere riego inmediato por goteo por 3 horas como mínimo." },
    { title: "Estrés hídrico detectado por satélite", body: "NDVI descendió 15% en última semana. Alta probabilidad de déficit hídrico en parcela." },
    { title: "Riego de socorro por altas temperaturas", body: "Senla IDEAM pronostica 38°C en las próximas 48h. Se recomienda adelantar riego al amanecer y repetir al atardecer." },
    { title: "Programación riego semanal", body: "Humedad del suelo al 28%. Se requiere riego de reposición en sectores A y C por 2.5 horas." },
    { title: "Alerta de sequía", body: "15 días sin lluvias significativas. Activar plan de contingencia hídrica y priorizar cultivos de mayor valor." },
  ],
  FERTILIZACION: [
    { title: "Fertilización edáfica programada", body: "Aplicar 200 kg/ha de NPK 20-20-20 al voleo. No fertilizar si hay lluvias pronosticadas." },
    { title: "Deficiencia de nitrógeno detectada", body: "Hojas inferiores amarillas (clorosis) en forma de V. Aplicar urea 46% 150 kg/ha de inmediato." },
    { title: "Fertilización de postcosecha", body: "Aplicar fertilizante de recuperación 15-15-15 250 kg/ha para restituir nutrientes extraídos por el cultivo." },
    { title: "Fertilización potásica urgente", body: "Análisis foliar muestra K por debajo del umbral crítico. Aplicar KCl 60% 120 kg/ha." },
    { title: "Encalado recomendado", body: "pH del suelo en 4.8. Aplicar cal dolomítica 1.5 ton/ha 30 días antes de próxima siembra." },
  ],
  COSECHA: [
    { title: "Ventana de cosecha óptima abierta", body: "Frutos en punto de madurez fisiológica. Cosechar en los próximos 5 días para evitar sobre maduración." },
    { title: "Cosecha próxima a vencerse", body: "Frutos alcanzaron 90% de madurez. Se recomienda cosechar máximo dentro de 48 horas." },
    { title: "Maduración heterogénea en parcela", body: "Diferencia de >10 días en maduración entre sectores. Programar cosecha selectiva por etapas." },
    { title: "Pronóstico de lluvias en cosecha", body: "Lluvias pronosticadas durante ventana de cosecha. Anticipar recolección para evitar pérdidas por humedad." },
    { title: "Rendimiento inferior al esperado", body: "Estimación de cosecha muestra 30% menos que el potencial. Evaluar causas y registrar en bitácora." },
  ],
  CLIMA: [
    { title: "Helada pronosticada para madrugada", body: "Temperatura mínima esperada < 2°C en las próximas 48h. Proteger cultivos sensibles con cobertores o riego por aspersión nocturno." },
    { title: "Lluvias intensas por onda tropical", body: "Precipitación acumulada > 60mm en 24h pronosticada por el IDEAM. Revisar drenajes y canales de evacuación." },
    { title: "Ola de calor extremo", body: "Temperaturas máximas sobre 38°C esperadas por 3 días consecutivos. Aumentar frecuencia de riego a 2 veces al día." },
    { title: "Vientos fuertes asociados a vendaval", body: "Ráfagas de viento > 50km/h pronosticadas. Revisar tutores, amarres y estructuras de soporte." },
    { title: "Fenómeno de La Niña activo", body: "Aumento de precipitaciones 40% sobre el promedio histórico. Reforzar drenajes y preparar plan de manejo de excesos hídricos." },
    { title: "Alta radiación solar UV", body: "Índice UV > 11 pronosticado. Programar labores de campo antes de las 9am. Asegurar protección del personal." },
  ],
};

const INVENTORY_COST_MAP: Record<string, number> = {
  "Semillas de papa": 4500, "Semillas de maíz híbrido": 12000, "Semillas de arroz": 3800,
  "Semillas de aguacate Hass": 6500, "Semillas de hortalizas": 350,
  "Fertilizante NPK 20-20-20": 1850, "Fertilizante líquido foliar": 22000, "Urea agrícola": 1450,
  "Abono orgánico compostado": 800, "Bioestimulante radicular": 28000,
  "Caldo bordelés": 12000, "Insecticida cipermetrina": 25000, "Herbicida glifosato": 22000,
  "Fungicida cúprico": 18000, "Aceite agrícola mineral": 15000,
  "Trampas cromáticas": 4500, "Trampas de feromonas": 9500,
  "Manguera de riego": 2800,
  "Machetes": 18000, "Tijeras de podar": 22000, "Guantes de caucho": 6000,
  "Bombas de mochila": 85000,
  "Tutores de bambú": 800, "Malla antipájaros": 3500, "Acolchado plástico": 1800,
  "Sustrato germinador": 5500, "Bandejas germinadoras": 12000,
};

const DEPARTMENTS = ["Cundinamarca", "Boyacá", "Huila", "Antioquia", "Tolima", "Caldas", "Santander", "Nariño", "Cauca", "Valle del Cauca"];
const IRRIGATION = ["Secano", "Riego por gravedad", "Riego por goteo", "Temporal"];

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function randDate(daysBack: number) {
  const d = new Date();
  d.setDate(d.getDate() - rand(0, daysBack));
  d.setHours(rand(6, 17), rand(0, 59), 0, 0);
  return d.toISOString();
}

function pick<T>(arr: readonly T[]): T { return arr[rand(0, arr.length - 1)]; }

export const clearAllUsers = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const adminEmail = "admin@sgic.local";
  let deleted = 0;
  for (const u of users?.users ?? []) {
    if (u.email === adminEmail) continue;
    const { error } = await supabaseAdmin.auth.admin.deleteUser(u.id);
    if (!error) deleted++;
  }
  return { success: true, message: `${deleted} usuarios eliminados. Admin preservado.` };
});

export const deleteUser = createServerFn({ method: "POST" }).handler(async ({ data }: { data: { userId: string } }) => {
  await requireAdmin();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
  if (error) throw error;
  return { success: true };
});

export const seedTestData = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const results: string[] = [];
  const credentials: { email: string; password: string; name: string }[] = [];

  try {
    // Crear admin (solo admin, no genera datos agrícolas)
    const { data: adminUser } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_SEED.email,
      password: "Admin123!",
      email_confirm: true,
      user_metadata: { full_name: ADMIN_SEED.name },
    });
    if (adminUser?.user) {
      const uid = adminUser.user.id;
      await supabaseAdmin.from("profiles").upsert({ id: uid, full_name: ADMIN_SEED.name, phone: ADMIN_SEED.phone }).maybeSingle();
      await supabaseAdmin.from("user_roles").upsert({ user_id: uid, role: "admin" }).maybeSingle();
      credentials.push({ email: ADMIN_SEED.email, password: "Admin123!", name: ADMIN_SEED.name });
      results.push(`✅ Admin: ${ADMIN_SEED.name} (${ADMIN_SEED.email})`);
    }

    for (const f of FARMERS) {
      const { data: user, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email: f.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: f.name },
      });
      if (uErr) { results.push(`Error creando ${f.name}: ${uErr.message}`); continue; }
      if (!user?.user) continue;
      const uid = user.user.id;
      credentials.push({ email: f.email, password: PASSWORD, name: f.name });

      await supabaseAdmin.from("profiles").upsert({ id: uid, full_name: f.name, phone: f.phone }).maybeSingle();
      await supabaseAdmin.from("user_roles").upsert({ user_id: uid, role: "agricultor" }).maybeSingle();

      const parcelCount = rand(2, 4);
      const parcelIds: string[] = [];
      for (let p = 1; p <= parcelCount; p++) {
        const area = rand(3000, 50000);
        const { data: parcel } = await supabaseAdmin.from("parcels").insert({
          owner_id: uid,
          name: `${f.name.split(" ")[0]}-P${p}`,
          soil_type_id: rand(1, 5),
          area_m2: area,
          latitude: 4.5 + Math.random() * 3,
          longitude: -74.5 + Math.random() * 3,
          notes: `${pick(SOIL_NAMES)}. ${pick(IRRIGATION)}. ${pick(DEPARTMENTS)}.`,
        }).select().single();
        if (parcel) parcelIds.push(parcel.id);
      }

      // NDVI histórico por parcela (curva de crecimiento sigmoidea)
      for (const pid of parcelIds) {
        const ndviCount = rand(5, 10);
        const ndviBase = new Date();
        ndviBase.setDate(ndviBase.getDate() - 180);
        for (let n = 0; n < ndviCount; n++) {
          const progress = n / (ndviCount - 1);
          const ndviDate = new Date(ndviBase);
          ndviDate.setDate(ndviDate.getDate() + Math.round(progress * 170));
          // Curva sigmoidea: baja al inicio, pico en mid-season, baja en senescencia
          const ideal = 0.15 + 0.65 / (1 + Math.exp(-10 * (progress - 0.45)));
          const noise = (Math.random() - 0.5) * 0.1;
          const ndvi = Math.max(0.1, Math.min(0.92, Math.round((ideal + noise) * 1000) / 1000));
          await supabaseAdmin.from("ndvi_cache").insert({
            parcel_id: pid,
            ndvi,
            date: ndviDate.toISOString().split("T")[0],
            source: n % 2 === 0 ? "sentinel2" : "landsat8",
            raw_data: { cloud_cover: Math.round(Math.random() * 25) / 100 },
          }).maybeSingle();
        }
      }

      let totalCrops = 0;
      let totalActs = 0;
      for (const pid of parcelIds) {
        const cropCount = rand(1, 2);
        totalCrops += cropCount;
        for (let c = 0; c < cropCount; c++) {
          const cat = pick(CROP_CATALOG);
          const planting = new Date();
          planting.setDate(planting.getDate() - rand(20, cat.cycle + 30));
          const harvest = new Date(planting);
          harvest.setDate(harvest.getDate() + cat.cycle);
          const statuses = ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO", "COSECHA", "FINALIZADO"];
          const status = statuses[rand(0, statuses.length - 1)];
          const now = new Date();
          const isPast = harvest < now;

          const { data: crop } = await supabaseAdmin.from("crops").insert({
            parcel_id: pid,
            catalog_id: cat.id,
            planting_date: planting.toISOString().split("T")[0],
            estimated_harvest_date: harvest.toISOString().split("T")[0],
            status: isPast && status === "MANTENIMIENTO" ? "FINALIZADO" : status,
            notes: `Siembra de ${cat.name}. Ciclo estimado ${cat.cycle} días. ${pick(["Sistema de tutorado instalado.", "Acolchado plástico aplicado.", "Riego por goteo configurado.", "Sin labranza."])}`,
          }).select().single();
          if (!crop) continue;

          const actCount = rand(10, 22);
          totalActs += actCount;
          for (let a = 0; a < actCount; a++) {
            const kind = pick(ACTIVITY_KINDS);
            const notes = pick(ACTIVITY_NOTES[kind] ?? ["Actividad de rutina"]);
            await supabaseAdmin.from("activities").insert({
              crop_id: crop.id,
              responsible_id: uid,
              kind,
              performed_at: randDate(isPast ? 180 : 20),
              notes,
            });
          }

          const harvestCount = isPast ? rand(3, 6) : rand(0, 1);
          for (let h = 0; h < harvestCount; h++) {
            // Rendimiento realista por tipo de cultivo
            const qty = rand(cat.yldLow, cat.yldHigh);
            const price = rand(cat.prcLow, cat.prcHigh);
            const harvestDate = new Date();
            harvestDate.setDate(harvestDate.getDate() - rand(1, isPast ? 120 : 15));
            await supabaseAdmin.from("crop_harvests").insert({
              crop_id: crop.id,
              harvested_qty: qty,
              unit: "KG",
              sale_price: price,
              total_revenue: Math.round(qty * price * 100) / 100,
              performed_at: harvestDate.toISOString(),
            });

            const qualLabels = cat.id === 3 ? ["Café pergamino seco", "Café especial", "Café convencional"] :
                              cat.id === 9 ? ["Premium exportación", "Primera calidad", "Segunda calidad"] :
                              cat.id === 8 ? ["Cacao fermentado", "Cacao estándar"] :
                              cat.id === 21 ? ["Caña de azúcar", "Panela"] :
                              cat.id === 22 ? ["RFF calidad A", "RFF calidad B"] :
                              ["Calidad premium", "Calidad estándar", "Calidad exportación", "Consumo local"];
            await supabaseAdmin.from("batches").insert({
              crop_id: crop.id,
              batch_code: `BATCH-${crop.id.slice(0, 6).toUpperCase()}-${h + 1}`,
              harvest_date: harvestDate.toISOString().split("T")[0],
              qty: Math.round(qty * (0.8 + Math.random() * 0.4)),
              unit: "KG",
              globalgap_cert: Math.random() > 0.5,
              notes: `${h + 1}° cosecha de ${cat.name} - ${f.name}. ${pick(qualLabels)}.`,
            });
          }

          const costCount = rand(10, 20);
          for (let k = 0; k < costCount; k++) {
            const kind = pick(COST_KINDS);
            const desc = pick(COST_DESCS[kind]);
            const cf = cat.costFactor;
            let qty: number, unitCost: number, unit: string;
            switch (kind) {
              case "INSUMOS":
                unit = pick(["KG", "L", "UN", "SACO"]);
                qty = rand(1, 20);
                unitCost = Math.round(cf * rand(4000, 85000));
                break;
              case "MANO_OBRA":
                unit = "JOR";
                qty = rand(1, 6);
                unitCost = Math.round(cf * rand(50000, 75000));
                break;
              case "MAQUINARIA":
                unit = "HORA";
                qty = rand(1, 6);
                unitCost = Math.round(cf * rand(80000, 200000));
                break;
              case "TRANSPORTE":
                unit = "FLETE";
                qty = rand(1, 4);
                unitCost = Math.round(cf * rand(60000, 250000));
                break;
              default:
                unit = "UN";
                qty = rand(1, 5);
                unitCost = Math.round(cf * rand(15000, 150000));
            }
            await supabaseAdmin.from("crop_costs").insert({
              crop_id: crop.id,
              kind,
              description: desc,
              qty,
              unit,
              unit_cost: unitCost,
              total: qty * unitCost,
              created_at: randDate(isPast ? 180 : 20),
            });
          }

          const pestCount = rand(1, 4);
          for (let p = 0; p < pestCount; p++) {
            const pest = pick(PEST_RECORDS);
            await supabaseAdmin.from("pest_incidents").insert({
              crop_id: crop.id,
              pest_name: pest.name,
              severity: pick(["BAJA", "MEDIA", "MEDIA", "ALTA", "CRITICA"]),
              treatment: pest.treatment,
              date: new Date(Date.now() - rand(0, isPast ? 150 : 15) * 86400000).toISOString().split("T")[0],
              notes: `Detectado en ${["hojas inferiores", "zona norte", "borde de parcela", "focos aislados", "tercio superior"][rand(0, 4)]}. ${["Control aplicado.", "Requiere re-aplicación.", "Bajo control.", "Monitoreo continuo."][rand(0, 3)]}`,
            });
          }
        }
      }

      const alertCount = rand(3, 6);
      for (let a = 0; a < alertCount; a++) {
        const alertConfig = pick(Object.values(ALERT_TITLES).flat());
        await supabaseAdmin.from("alerts").insert({
          user_id: uid,
          kind: pick(["RIEGO", "FERTILIZACION", "COSECHA", "CLIMA"]),
          title: alertConfig.title,
          body: alertConfig.body,
          status: a === 0 ? "ATENDIDA" : "PENDIENTE",
          scheduled_at: new Date(Date.now() + rand(0, 14) * 86400000).toISOString(),
        });
      }

      const invCount = rand(5, 10);
      const shuffledInv = [...INVENTORY_ITEMS].sort(() => Math.random() - 0.5).slice(0, invCount);
      for (const item of shuffledInv) {
        const unitCost = INVENTORY_COST_MAP[item.name] ?? rand(2000, 50000);
        await supabaseAdmin.from("inventory_items").insert({
          owner_id: uid,
          name: item.name,
          unit: item.unit,
          stock_qty: rand(20, 500),
          min_stock: item.minStock,
          unit_cost: unitCost,
        });
      }

      const eventCount = rand(3, 6);
      const eventTemplates = [
        { title: "Riego matinal", desc: "Riego por goteo 2h en parcela principal. Verificar presión y caudal.", kind: "RIEGO" as const },
        { title: "Riego de socorro", desc: "Temperaturas altas pronosticadas. Adelantar riego de emergencia.", kind: "RIEGO" as const },
        { title: "Aplicación de NPK", desc: "Fertilización balanceada 20-20-20. Aplicar 200 kg/ha al voleo.", kind: "FERTILIZACION" as const },
        { title: "Fertilización foliar", desc: "Aplicar fertilizante líquido vía foliar con bomba de mochila.", kind: "FERTILIZACION" as const },
        { title: "Encalado de suelo", desc: "Aplicar cal dolomítica 500 kg/ha para corregir pH del suelo.", kind: "FERTILIZACION" as const },
        { title: "Abonada orgánica", desc: "Distribuir compost maduro (5 ton/ha) en surcos del cultivo.", kind: "FERTILIZACION" as const },
        { title: "Monitoreo fitosanitario", desc: "Recorrer parcela identificando focos de plaga o enfermedad.", kind: "MONITOREO" as const },
        { title: "Evaluación de humedad", desc: "Medir humedad del suelo con tensiómetro en 5 puntos.", kind: "MONITOREO" as const },
        { title: "Toma de muestras de suelo", desc: "Recolectar muestras compuestas para análisis de laboratorio.", kind: "MONITOREO" as const },
        { title: "Cosecha programada", desc: "Iniciar cosecha manual selectiva de frutos en punto óptimo de madurez.", kind: "COSECHA" as const },
        { title: "Clasificado y empaque", desc: "Seleccionar y empacar producto cosechado en canastillas plásticas.", kind: "COSECHA" as const },
        { title: "Control de malezas", desc: "Deshierbe manual o mecánico entre surcos del cultivo.", kind: "MONITOREO" as const },
        { title: "Poda sanitaria", desc: "Eliminar ramas o tallos afectados por plagas/enfermedades.", kind: "CONTROL_PLAGAS" as const },
        { title: "Aplicación de caldo bordelés", desc: "Fungicida preventivo a base de cobre. Aplicar al amanecer.", kind: "CONTROL_PLAGAS" as const },
        { title: "Control biológico", desc: "Liberar Trichoderma harzianum en la rizosfera del cultivo.", kind: "CONTROL_PLAGAS" as const },
        { title: "Trampeo de plagas", desc: "Instalar trampas cromáticas azules para monitoreo de trips.", kind: "CONTROL_PLAGAS" as const },
        { title: "Día de capacitación", desc: "Taller técnico sobre manejo integrado de plagas y fertilización.", kind: "MONITOREO" as const },
        { title: "Mantenimiento de infraestructura", desc: "Reparar sistema de riego y cercos perimetrales.", kind: "OTROS" as const },
      ];
      for (let e = 0; e < eventCount; e++) {
        const eventDate = new Date(Date.now() + rand(-3, 21) * 86400000);
        const tmpl = pick(eventTemplates);
        await supabaseAdmin.from("calendar_events").insert({
          user_id: uid,
          title: tmpl.title,
          description: tmpl.desc,
          starts_at: eventDate.toISOString(),
          ends_at: new Date(eventDate.getTime() + rand(1, 4) * 3600000).toISOString(),
          kind: tmpl.kind,
        });
      }

      results.push(`✅ ${f.name} (${f.email}): ${parcelCount} parcelas, ${totalCrops} cultivos, ${totalActs} actividades`);
    }

    for (const t of TECNICOS) {
      const { data: user, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email: t.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: t.name },
      });
      if (uErr) { results.push(`Error creando técnico ${t.name}: ${uErr.message}`); continue; }
      if (!user?.user) continue;
      const uid = user.user.id;
      credentials.push({ email: t.email, password: PASSWORD, name: t.name });
      await supabaseAdmin.from("profiles").upsert({ id: uid, full_name: t.name, phone: t.phone }).maybeSingle();
      await supabaseAdmin.from("user_roles").upsert({ user_id: uid, role: "tecnico" }).maybeSingle();
      results.push(`✅ Técnico: ${t.name} (${t.email})`);
    }

    const credsText = credentials.map((c) => `  ${c.email} / ${c.password}  —  ${c.name}`).join("\n");

    return {
      success: true,
      message: `Datos de prueba generados.\n\n${results.join("\n")}\n\n━━━ CREDENCIALES ━━━\n${credsText}`,
    };
  } catch (err) {
    return { success: false, message: `Error: ${err instanceof Error ? err.message : String(err)}` };
  }
});
