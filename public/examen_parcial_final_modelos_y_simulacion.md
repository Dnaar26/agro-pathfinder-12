# Examen Parcial Final - Modelos y Simulación

# Página 1

¿Puede demostrarse mediante análisis estadístico, simulación de eventos discretos, teoría 
de colas, generación y validación de números pseudoaleatorios, transformada inversa, 
teoría de grafos y criptografía, que existe una diferencia significativa en el nivel de servicio 
entre el transporte público tradicional y las plataformas digitales en Apartadó, y cuál debe 
ser la política pública regulatoria óptima? 
 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
Aprendizaje Basado en Problemas (ABP) Modelos y 
Simulación · Período 2026 -1 
¿Debe Apartadó regular las plataformas digitales de transporte o fortalecer su sistema de 
movilidad pública tradicional? 
 
CONTEXTO DEL PROBLEMA 
 
 
El municipio de Apartadó, corazón económico del Urabá antioqueño, enfrenta desde 2022 una 
transformación profunda en su sistema de movilidad urbana. La llegada de plataformas digitales como 
InDrive, Uber y DiDi ha generado un debate entre conductores de transporte tradicional, la Alcaldía, 
usuarios y gremios del sector. 
La Secretaría de Movilidad de Apartadó ha documentado: 
• El tiempo promedio de espera en paraderos supera los 10 minutos en horas pico. 
• Las plataformas reportan tiempos medios de recogida de 3 a 5 minutos. 
• El 41% de usuarios menores de 35 años migró a plataformas digitales. 
• Se han reportado al menos dos incidentes de filtración de datos de usuarios. 
• Los conductores formales reportan pérdidas de ingreso del 28% desde la llegada de las 
plataformas. 
 
PREGUNTA  CENTRAL DEL PROYECTO 
 


# Página 2

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
Nota metodológica: Este examen es secuencial. Los resultados de cada fase son insumo obligatorio de la siguiente. No 
está permitido responder fases de forma aislada. 
 
CONTEXTO DEL PROBLEMA 
 
FASE 01 ESTADÍSTICA DESCRIPTIVA Y ANÁLISIS COMPARATIVO 
Datos de entrada — Tiempos de espera (minutos) 
Inspectores de la Secretaría de Movilidad registraron los tiempos en el paradero central y en plataformas digitales (6:00–9:00 
a.m.). 
 
N° Usuario Bus Urbano (min) Plataforma Digital (min) Diferencia |B-P| 
1 10 3 7 
2 12 5 7 
3 8 2 6 
4 15 4 11 
5 9 6 3 
6 11 3 8 
7 7 4 3 
8 13 2 11 
9 14 5 9 
10 9 3 6 
11 16 4 12 
12 8 6 2 
 
ACTIVIDAD 1.1 — Medidas de tendencia central y dispersión 
Para cada sistema calcule y complete la tabla. Muestre el desarrollo matemático completo. 
 
Estadístico Bus Urbano Plataforma Digital 
Media aritmética (x̄ ) Suma = 132 
x̄  = 132 / 12 = 11 min 
Suma = 47 
x̄  = 47/ 12 = 3.92 min 
Mediana n=12 (par) 
Me = (10+12)/2 = 10.5 min 
n=12 (par) 
Me = (4+4)/2 = 4 min 
Moda 8(2 veces), 9 (2 veces) 
Mo = 8 y 9 min (bimodal) 
3(3 veces), 4(3 veces) 
Mo = 3 y 4 min (bimodal) 


# Página 3

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
Rango R = 16 − 7 = 9 min R = 6 − 2 = 4 min 
Varianza poblacional (σ²) x̄ =11 
Σ =98 
σ² = 98 / 12 = 8.17 min² 
x̄  = 3.917 
Σ = 20.917 
σ² = 20.917 / 12 = 1.74 min² 
Varianza muestral (s²) s² = 98 / (12−1) = 98/11 = 8.91 min² s² = 20.917 / 11 = 1.90 min² 
Desviación estándar (σ) σ = √8.17 = 2.86 min σ = √1.74 = 1.32 min 
Coeficiente de variación CV (%) CV = (σ / x̄ ) × 100 
CV = (2.86 / 11) × 100 = 26.0% CV = (1.32 / 3.917) × 100 = 33.7% 
 
ACTIVIDAD 1.2 — Tabla de frecuencias 
 
Tiempo (min) Frec. Abs. Frec. Rel. Frec. 
Acum. 
% 
Acumulado 
Intervalo [00-99] 
6 2 0.167 12 100.0% 84-99 
7 1 0.083 1 8.3% 00-08 
8 2 0.167 3 25.0% 09-24 
9 2 0.167 5 41.7% 25-40 
10 1 0.083 6 50.0% 41-49 
11 1 0.083 7 58.3% 50-58 
12 1 0.083 8 66.7% 59-66 
13 1 0.083 9 75.0% 67-74 
14 1 0.083 10 83.3% 75-83 
15 1 0.083 11 91.7% 84-91 
16 1 0.083 12 100.0% 92-99 
TOTAL 12 1.00  100%  
 
ACTIVIDAD 1.3 — Análisis crítico (responda con argumentos matemáticos) 
 
1. ¿Cuál sistema presenta menor dispersión relativa? Use el CV para argumentar. 
R/: El Bus Urbano presenta menor dispersión relativa con CV = 26.0%, frente al CV = 33.7% de la Plataforma 
Digital. Aunque el bus tiene mayor desviación estándar absoluta (2.86 min vs 1.32 min), al relativizarla respecto a su 
media mucho mayor, resulta proporcionalmente más homogéneo. La Plataforma Digital tiene más variabilidad 
relativa porque sus tiempos oscilan entre 2 y 6 minutos sobre una media de solo 3.92 min.  
2. ¿La media es representativa en ambos conjuntos o la mediana describe mejor la tendencia central? Justifique. 
R/: Bus Urbano: Media = 11.0, Mediana = 10.5. Son muy cercanas, lo que indica distribución aproximadamente 
simétrica. La media es representativa. 
 
Plataforma Digital: Media = 3.92, Mediana = 4.0. También muy cercanas; la distribución es simétrica. Ambas 
medidas son igualmente representativas. En ambos casos la media describe bien la tendencia central, pues no hay 
valores atípicos extremos que la distorsionen. 


# Página 4

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
3. Con base en el histograma, ¿qué distribución teórica parece ajustarse mejor a cada conjunto? 
R/: Bus Urbano:  La distribución con datos entre 7 y 16, sin sesgo marcado y media ≈ mediana, se asemeja a 
una distribución Normal  o uniforme discreta. También podría ajustarse a una distribución de Poisson dado que 
modela tiempos de espera en sistemas de transporte masivo. 
 
Plataforma Digital:  Con valores entre 2 y 6, concentración en 3 -4 y distribución simétrica, se aproxima a 
una distribución Uniforme discreta  o Normal con baja varianza. Dado el contexto de llegadas de vehículos a 
demanda, también es plausible una distribución Exponencial. 
4. Calcule la diferencia promedio |B - P|. ¿Es relevante para la política de movilidad? 
 
R/: Suma de diferencias B-P = 7+7+6+11+3+8+3+11+9+6+12+2 = 85 
Diferencia promedio = 85 / 12 = 7.08 minutos 
 
Sí, es altamente relevante. En promedio, los usuarios esperan  7.08 minutos más  en el sistema de bus urbano que en 
plataformas digitales. Esto representa una reducción del 64.4% en tiempo de espera al usar plataformas digitales [(11.0 - 3.92) 
/ 11.0 × 100]. Para la política pública, este dato sugiere que las plataformas digitales ofrecen un servicio objetivamente má s 
eficiente en tiempo de respuesta, lo que justifica su regulación formal (no su prohibición) para garantizar competencia leal 
con el transporte tradicional.


# Página 5

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
 
A FASE 02 SIMULACIÓN MONTECARLO CTIVD 
 
ACTIVIDAD 2.1 — Distribución empírica (complete para ambos sistemas) 
 
     
2 0 0 0 - 
3 0 0 0 - 
4 0 0 0 - 
5 0 0 0 - 
6 0 0 0 - 
7 1 0.0833 0.0833 00-07 
8 2 0.1667 0.25 08-24 
9 2 0.1667 0.4167 25-41 
10 1 0.0833 0.5 42-49 
11 1 0.0833 0.5833 50-57 
12 1 0.0833 0.6666 58-66 
13 1 0.0833 0.7499 67-74 
14 1 0.0833 0.8332 75-82 
15 1 0.0833 0.9165 83-91 
16 1 0.0833 0.9998 92-99 
Total 12 1.00 0.9998 - 


# Página 6

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
 
ACTIVIDAD 2.2 — Simulación con números aleatorios 
 
Use la siguiente secuencia para simular 15 usuarios en cada sistema: 
 
07 15 38 42 61 74 83 27 55 91 03 69 48 86 22 
 
N° N° 
Aleatorio 
T. Bus (min) T. Plataforma (min) Llegada Acum. 
Bus 
Llegada Acum. 
Plat. 
1 07 7 2 7 2 
2 15 8 2 15 4 
3 38 9 3 24 7 
4 42 10 4 34 11 
5 61 12 4 46 15 
6 74 13 5 59 20 
7 83 15 6 74 26 
8 27 9 3 83 29 
9 55 11 4 94 33 
10 91 15 6 109 39 
11 03 7 2 116 41 
12 69 13 5 129 46 
13 48 10 4 139 50 
14 86 15 6 154 56 
15 22 8 3 162 59 


# Página 7

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
 
FASE 03 PRUEBAS DE BONDAD DE AJUSTE (CONFORMIDAD) 
Se aplican tres pruebas para verificar que el generador produce secuencias uniformes e independientes. 
 
ACTIVIDAD 3.1 — Prueba Chi-Cuadrado (χ²) de uniformidad 
 
Secuencia a evaluar: 
0.07, 0.15, 0.38, 0.42, 0.61, 0.74, 0.83, 0.27, 0.55, 0.91, 0.03, 0.69, 0.48, 0.86, 0.22, 0.64, 0.37, 0.79, 0.11, 
0.58 
 
 
H0: Los números siguen distribución Uniforme (0,1) | H1: No siguen distribución uniforme 
 
chi^2 = Suma [(Oi - Ei)^2 / Ei] donde Ei = n/k = 20/5 = 4 
 
Intervalo Frec. Observada 
(Oi) 
Frec. Esperada (Ei) (Oi-Ei)^2 (Oi-Ei)^2 / Ei 
[0.00 - 0.20) 4 4 0 0.000 
[0.20 - 0.40) 4 4 0 0.000 
[0.40 - 0.60) 4 4 0 0.000 
[0.60 - 0.80) 5 4 1 0.250 
[0.80 - 1.00] 3 4 1 0.250 
TOTAL 20 20 _ chi^2 =0.500 
 
Valor critico: chi^2(alfa=0.05, gl=4) = 9.488. Si chi^2 calculado < 9.488, no se rechaza H0. 
 
χ² calculado = 0.500 
Valor crítico: χ²(α=0.05, gl=4) = 9.488 
Conclusión: Como 0.500 < 9.488, no se rechaza H₀. La secuencia es consistente con una distribución Uniforme(0,1). 
 


# Página 8

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
 
ACTIVIDAD 3.2 — Prueba Kolmogorov-Smirnov (KS) 
 
Ordene la secuencia de menor a mayor. Para Uniforme(0,1): F(x) = x 
 
D = max { D+, D- } donde D+ = max[Sn(xi) - F(xi)] y D- = max[F(xi) - Sn(xi-1)] 
 
i xi (ordenado) Sn(xi)=i/n F(xi)=xi D+ D- 
1 0.03 0.050 0.030 0.020 0.030 
2 0.07 0.100 0.070 0.030 .0.020 
3 0.11 0.150 0.110 0.040 0.010 
4 0.15 0.200 0.150 0.050 0.0000 
5 0.22 0.250 0.220 0.030 0.020 
6 0.27 0.300 0.270 0.030 .0.020 
7 0.37 0.350 0.370 -0.020 0.070 
8 0.38 0.400 0.380 0.020 0.030 
9 0.42 0.450 0.420 0.030 0.020 
10 0.48 0.500 0.480 0.020 0.030 
11 0.55 0.550 0.550 0.000 0.050 
12 0.58 0.600 0.580 0.020 0.010 
13 0.61 0.650 0.610 0.040 -0.01 
14 0.64 0.700 0.640 0.060 -0.010 
15 0.69 0.750 0.690 0.060 .-0.010 
16 0.74 0.800 0.740 0.060  
-0.010 
17 0.79 0.850 0.790 0.060 -0.010 
18 0.83 0.900 0.830 0.070 0.020 
   19 0.86 0.950 0.860 0.090 -0.040 
20 0.91 1.000 0.910 0.090 -0.060 
D 
max 
                                                                                                       D⁺ = 0.090       D⁻ = 0.070                                                                         


# Página 9

  
 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
Valor critico KS (n=20, alfa=0.05): D_critico = 0.294. Si D max < 0.294, no se rechaza H0. 
 D = max(D⁺, D⁻) = max(0.090, 0.070) = 0.090 
Valor crítico: D_crítico(n=20, α=0.05) = 0.294 
Conclusión: Como 0.090 < 0.294, no se rechaza H₀. La secuencia pasa la prueba KS y se comporta como Uniforme 
(0,1). 
  
ACTIVIDAD 3.3 — Prueba Shapiro-Wilk (normalidad de tiempos del Bus) 
 
Verifica si los 12 tiempos del Bus provienen de una distribución normal (prueba más potente para n < 50). 
 
W = (Suma ai * x(i))^2 / Suma(xi - x_barra)^2 
 
 
Pasos: (1) Ordene los datos de menor a mayor. (2) Consulte los coeficientes ai para n=12 en la tabla oficial de Shapiro-
Wilk (1965) e investigue los valores. (3) Calcule W. (4) Compare con el valor crítico. 
 
i x(i) x(13−i) x(n-i+1) Diferencia ai (tabla S-W) 
INVESTIGAR 
ai x 
Diferencia 
1 7 16 16 9 0.5475 4.9275 
2 8 15 15 7 0.3325 2.3275 
3 8 14 14 6 0.2347 1.4082 
4 9 13 13 4 0.1586 0.6344 
5 9 12 12 3 0.0922 0.2766 
6 10 11 11 1 0.0303 0.0303 
Suma      b = 9.6045 
 
 
Tabla de valores críticos W (investigue los valores faltantes y cite la fuente en formato APA): 
 
 
n alfa = 0.10 alfa = 0.05 alfa = 0.01 Fuente consultada (APA) 
10 0.842 0.815 0.764 Wikipedia. (s. f.). Valores faltantes. En 


# Página 10

12 0.859 0.835 0.782 Wikipedia, la enciclopedia libre. 
Recuperado el 5 de junio de 2026, de 
https://es.wikipedia.org/wiki/Valores_fal
tantes 
15 0.881 0.862 0.814 
20 0.905 0.886 0.850 
25 0.918 0.900 0.868 
 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
FASE 04 VARIABLES ALEATORIAS Y FENÓMENOS ESTOCÁSTICOS 
 
ACTIVIDAD 4.1 — Clasificación de variables del sistema de movilidad 
 
Variable Disc. / 
Cont. 
Espacio 
muestral 
Justificación matemática 
Número de pasajeros por hora Discreta {0, 1, 2, 3, …} Toma valores enteros no 
negativos contables. Se modela 
con distribución Poisson: X ~ 
Poisson(λ) 
Tiempo de espera (minutos) Continua [0, +∞) Puede tomar cualquier valor real 
positivo. Se modela con 
distribución Exponencial: X ~ 
Exp(λ) 
Numero de conductores InDrive 
disponibles 
Discreta {0, 1, 2, …, N} Cantidad entera y acotada por el 
total de conductores registrados 
N. X ∈ ℤ⁺ 
Distancia recorrida en un viaje (km) Continua (0, +∞) Puede tomar cualquier valor real 
positivo. Se modela con 
distribución Normal o Uniforme: 
X ~ U(a,b) 
Cantidad de reclamos diarios Discreta {0, 1, 2, 3, …} Conteo de eventos por unidad de 
tiempo. Se modela con 
distribución Poisson: X ~ 
Poisson(λ) 
Velocidad promedio en hora pico Continua (0, V_max] Toma valores reales en un rango 
acotado. Se modela con 
distribución Normal: X ~ N(μ, 
σ²) 
Numero de paradas en una ruta de bus Discreta {1, 2, 3, …, k} Cantidad entera fija y acotada 
por el diseño de la ruta. X ∈ ℤ⁺ 
finito 
 
ACTIVIDAD 4.2 — Clasificación de fenómenos: estocástico vs. determinístico 
 
Fenómeno Clasificación ¿Requiere 
simulación? 
Justificación 
Duración programada de un semáforo en 
Apartado 
Determinístico No El tiempo de cada fase está fijado 
por programación preestablecida. 
Dado el instante inicial, el estado 
en cualquier tiempo t es 


# Página 11

predecible con certeza. 
Llegada de pasajeros al paradero central Estocástico Sí El instante de llegada de cada 
pasajero es aleatorio e 
impredecible. Se modela con 
proceso de Poisson; requiere 
simulación para estimar tiempos 
de espera y longitud de cola. 
Cálculo de la tarifa oficial del bus 
urbano 
Determinístico No La tarifa es definida por la 
Alcaldía mediante fórmula 
regulatoria fija. Dado el conjunto 
de parámetros de entrada, el 
resultado es único y 
reproducible. 
Tiempo de respuesta de un conductor 
InDrive 
Estocástico Sí Depende de variables aleatorias: 
ubicación del conductor, tráfico, 
demanda simultánea. No puede 
predecirse con exactitud; 
requiere simulación con 
distribución empírica o 
Exponencial. 
Numero de km de la ruta fija Bus 01 
Apartado 
Determinístico No La ruta tiene un trazado físico 
fijo con distancia constante. Es 
un valor conocido e invariable 
independiente de condiciones 
externas. 
Ocurrencia de un accidente de transito Estocástico Sí Es un evento aleatorio cuya 
probabilidad depende de 
múltiples factores incontrolables. 
Se modela como proceso de 
Bernoulli o Poisson; requiere 
simulación para estimar 
frecuencia y riesgo. 

# Página 12

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL ¿OTRO – CUÁL? 
  x   
 
 
FASE 05 TEORIA DE COLAS — SIMULACION DE ATENCION 
 
La terminal dispone de 1 ventanilla con tiempo promedio de servicio de 5 min/usuario. Las plataformas atienden con  tiempo U 
(1,6) min. Use los tiempos de llegada de la Fase 2. 
 
ACTIVIDAD 5.1 — Tabla de simulación de la cola (15 clientes) 
 
Cliente Llegada 
(min) 
Inicio 
Servicio 
Fin 
Servicio 
Espera en 
Cola 
Tiempo en 
Sistema 
Servidor 
Ocupado 
1 2 2 4 0 2 2 
2 4 4 6 0 2 2 
3 7 7 10 0 3 3 
4 11 11 15 0 4 4 
5 15 15 19 0 4 4 
6 20 20 25 0 5 5 
7 26 26 32 0 6 6 
8 29 32 35 3 6 3 
9 33 35 39 2 6 4 
10 39 39 45 0 6 6 
11 41 45 47 4 6 2 
12 46 47 52 1 6 5 
13 50 52 56 2 6 4 
14 56 56 62 0 6 6 
15 59 62 65 3 6 3 
 
ACTIVIDAD 5.1 — Tabla de simulación de la cola (15 clientes) 
 
Indicador Formula Bus Urbano Plataforma Digital 
Tasa de llegada (lambda) lambda = 
1/T_entre_llegadas 
1/10.80 = 0.0926 
cl/min 
1/3.93 = 0.2542 cl/min 
Tasa de servicio (mu) mu = 1/T_servicio 1/5 = 0.2000 cl/min 1/3.5 = 0.2857 cl/min 
Factor de utilizacion (rho) rho = lambda / mu 0.3991/0.0926 = 
4.31 min 
0.2542/0.2857 = 
0.8898 
Tiempo en cola (Wq) Wq = Lq / lambda 0.2143/0.5370 = 
0.3991 
7.1871/0.2542 = 28.27 
min 
Long. promedio cola (Lq) Lq = rho^2 / (1-rho) 0.3991/0.0926 = 
4.31 min 
0.7918/0.1102 = 
7.1871 
Espera maxima observada (de la tabla de 0 min 4 min 


# Página 13

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL ¿OTRO – CUÁL? 
  x   
 
 simulación)   
 
Pregunta: ¿Con los valores de rho calculados, es necesario abrir una segunda ventanilla?  Es sostenible si la demanda crece un 
25%? 
R// Con ρ_bus = 0.46 el Bus no necesita segunda ventanilla. La Plataforma Digital con ρ = 0.89 está al límite; si la demanda crec e 
25%, λ aumentaría a 0.318 cl/min y ρ superaría 1.0, haciendo el sistema inestable, sí requeriría un segundo servidor.  
 
FASE 06 GENERACION  DE NUMEROS PSEUDOALEATORIOS Y MERSENNE TWISTER 
ACTIVIDAD 6.1 — Metodo Congruencial Lineal (MCL) 
 
X(n+1) = (a * Xn + c) mod m con m=100, a=21, c=13, X0=7 
Genere 25 numeros y normalice: Ui = Xi / 100 
 
n Xn a*Xn+c X(n+1) mod 100 Un = X(n+1)/100 
0 7 (semilla) — — — 
1 7 21×7+13 = 160 60 0.60 
2 60 21×60+13 = 1273 73 0.73 
3 73 21×73+13 = 1546 46 0.46 
4 46 21×46+13 = 979 79 0.79 
5 79 21×79+13 = 1672 72 0.72 
6 72 21×72+13 = 1525 25 0.25 
7 25 21×25+13 = 538 38 0.38 
8 38 21×38+13 = 811 11 0.11 
9 11 21×11+13 = 244 44 0.44 
10 44 21×44+13 = 937 37 0.37 
11 37 21×37+13 = 790 90 0.90 
12 90 21×90+13 = 1903 3 0.03 
13 3 21×3+13 = 76 76 0.76 
14 76 21×76+13 = 1609 9 0.09 
15 9 21×9+13 = 202 2 0.02 
16 2 21×2+13 = 55 55 0.55 
17 55 21×55+13 = 1168 68 0.68 
18 68 21×68+13 = 1441 41 0.41 
19 41 21×41+13 = 874 74 0.74 
20 74 21×74+13 = 1567 67 0.67 
21 67 21×67+13 = 1420 20 0.20 
22 20 21×20+13 = 433 33 0.33 
23 33 21×33+13 = 706 6 0.06 


# Página 14

24 6 21×6+13 = 139 39 0.39 
25 39 21×39+13 = 832 32 0.32 
 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
Identifique el periodo del generador. ¿Se logra periodo completo (=100)?  Verifique las condiciones de Hull-Dobell. 
• Período = 100 (período COMPLETO). La secuencia regresa a X=7 exactamente después de 100 pasos. 
 
Condición Verificación ¿Cumple? 
mcd(c, m) = 1 mcd(13, 100) = 1 Si 
(a−1) divisible por todo primo que 
divide m (primos: 2 y 5) 
a−1 = 20; 20/2 = 10 ✓ y 20/5 = 4 Si 
Si 4 divide m, entonces (a−1) 
divisible por 4 
4|100 y 20/4 = 5 Si 
 
• Conclusión: Se logra período completo = m = 100. Todas las condiciones se cumplen. 
 
ACTIVIDAD 6.2 — Mersenne Twister MT19937 (investigue y complete) 
 
Parametro del MT19937 Valor / Descripcion Fuente consultada (APA) 
Periodo del generador 2^19937 - 1 Matsumoto, M., & Nishimura, 
T. (1998). Mersenne twister: A 
623-dimensionally 
equidistributed uniform 
pseudo-random number 
generator. ACM Transactions 
on Modeling and Computer 
Simulation, 8(1), 3–
30. https://doi.org/10.1145/27
2991.272995 
Tamanno del estado interno (palabras) 624 palabras de 32 bits Matsumoto, M., & Nishimura, 
T. (1998). Mersenne twister: A 
623-dimensionally 
equidistributed uniform 
pseudo-random number 
generator. ACM Transactions 
on Modeling and Computer 
Simulation, 8(1), 3–
30. https://doi.org/10.1145/27
2991.272995 
Longitud de palabra (bits) 32 bits Matsumoto, M., & Nishimura, 
T. (1998). Mersenne twister: A 
623-dimensionally 


# Página 15

equidistributed uniform 
pseudo-random number 
generator. ACM Transactions 
on Modeling and Computer 
Simulation, 8(1), 3–
30. https://doi.org/10.1145/27
2991.272995 
Dimensiones de equidistribucion 623 dimensiones Matsumoto, M., & Nishimura, 
T. (1998). Mersenne twister: A 
623-dimensionally 
equidistributed uniform 
pseudo-random number 
generator. ACM Transactions 
on Modeling and Computer 
Simulation, 8(1), 3–
30. https://doi.org/10.1145/27
2991.272995 
Pasa la prueba Diehard? Sí L'Ecuyer, P., & Simard, R. 
(2007). TestU01: A C library for 
empirical testing of random 
number generators. ACM 
Transactions on Mathematical 
Software, 33(4), 
22. https://doi.org/10.1145/12
68776.1268777 
Autor y anio de publicacion Makoto Matsumoto y Takuji 
Nishimura, 1998 
Matsumoto, M., & Nishimura, 
T. (1998). Mersenne twister: A 
623-dimensionally 
equidistributed uniform 
pseudo-random number 
generator. ACM Transactions 
on Modeling and Computer 
Simulation, 8(1), 3–
30. https://doi.org/10.1145/27
2991.272995 
Es criptograficamente seguro? No (es predecible con suficiente 
estado observado) 
Kelsey, J., Schneier, B., Wagner, 
D., & Hall, C. (1998). 
Cryptanalytic attacks on 
pseudo-random number 
generators. Proceedings of the 
5th International Workshop on 
Fast Software Encryption (FSE 
'98), 166–
184. https://doi.org/10.1007/B
Fb0054440 
 
Genere 20 numeros con Python (random.random() usa MT19937 internamente) y registrelos: 
 
i 1 2 3 4 5 6 7 8 9 10 
Ui 0.3238 0.1508 0.6509 0.0724 0.5359 0.3657 0.0580 0.5074 0.0375 0.4336 
i 11 12 13 14 15 16 17 18 19 20 
Ui 0.0699 0.0907 0.4245 0.8269 0.1238 0.2232 0.6274 0.9477 0.5771 0.3967 

# Página 16

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
 
FASE 07 PRUEBAS DE INDEPENDENCIA — METODO DE RACHAS 
 
ACTIVIDAD 7.1 — Rachas arriba y abajo de la media 
 
Use los 25 numeros del MCL (Fase 6). Calcule x_barra y clasifique cada Un como A (arriba) o B (abajo). 
 
muR = (2*n1*n2)/(n1+n2) + 1  sigmaR^2 = 2*n1*n2*(2*n1*n2-n)/[n^2*(n-1)]  Z = (R - muR)/sigmaR 
 
n Un A/B n Un A/B Calculos intermedios 
1 0.60 A 13 0.76 A n1(A) = 11 
2 0.73 A 14 0.09 B n2(B) = 14  
3 0.46 A 15 0.02 B R = 10 
4 0.79 A 16 0.55 A muR = 13.32 
5 0.72 A 17 0.68 A sigmaR = 2.4106 
6 0.25 B 18 0.41 B Z = -1.38 
7 0.38 B 19 0.74 A Conclusion 
8 0.11 B 20 0.67 A  |Z| = 1.38 < 1.96 
9 0.44 B 21 0.20 B No se rechaza H₀ 
10 0.37 B 22 0.33 B Secuencia 
11 0.90 A 23 0.06 B Independiente 
12 0.03 B 24 0.39 B — 
— — — 25 0.32 B — 
 
 
ACTIVIDAD 7.2 — Rachas ascendentes y descendentes 
 
Marque + si Ui+1 > Ui (ascendente) y - si Ui+1 < Ui (descendente). Cuente el total de rachas y aplique la prueba Z. 
 
Par (i, i+1) Signo Par (i, i+1) Signo Par (i, i+1) Signo 
(2,3): 0.73→0.46 - (10,11): 0.37→0.90 + (18,19): 0.41→0.74 + 
(3,4): 0.46→0.79 + (11,12): 0.90→0.03 - (19,20): 0.74→0.67 - 
(4,5): 0.79→0.72 - (12,13): 0.03→0.76 + (20,21): 0.67→0.20 - 
(5,6): 0.72→0.25 - (13,14): 0.76→0.09 - (21,22): 0.20→0.33 + 
(6,7): 0.25→0.38 + (14,15): 0.09→0.02 - (22,23): 0.33→0.06 - 


# Página 17

FASE 08  TRANSFORMADA INVERSA — GENERACION DE VARIABLES ALEATORIAS 
ACTIVIDAD 8.1 — Distribucion Exponencial (lambda = 0.25) 
ACTIVIDAD 8.2 — Distribucion Poisson (lambda = 4) 
(7,8): 0.38→0.11 - (15,16): 0.02→0.55 + (23,24): 0.06→0.39 + 
(8,9): 0.11→0.44 + (16,17): 0.55→0.68 + (24,25): 0.39→0.32 - 
(9,10): 0.44→0.37 - (17,18): 0.68→0.41 - — — 
 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
 Secuencia de signos: + − + − − + − + − + − + − − + + − + − − + − + − 
 Contando rachas: +, −, +, −−, +, −, +, −, +, −, +, −−, ++, −, +, −−, +, −, +, − →  
 R = 20 
 Desarrollo estadístico: 
 μR = (2n−1)/3 = (2·25−1)/3 = 49/3 = 16.33 
 σR² = (16n−29)/90 = (16·25−29)/90 = 371/90 = 4.122 → σR = 2.030 
 Z = (20 − 16.33) / 2.030 = 3.67 / 2.030 = 1.81 
 Valor crítico: Z_crítico(α=0.05, bilateral) = ±1.96 
 Conclusión: |Z| = 1.81 < 1.96 → No se rechaza H₀. La secuencia ES INDEPENDIENTE (prueba ascendentes/descendentes).  
 
 
 
 
X = -(1/lambda) * ln(1 - U) => X = -4 * ln(1 - U) 
Use U: 0.12, 0.34, 0.67, 0.89, 0.45, 0.23, 0.78. Muestre el desarrollo numerico completo: 
 
i U (1-U) ln(1-U) X = -4*ln(1-U) Interpretacion 
1 0.12 0.88 −0.12783 0.5113 El conductor llega en 0.51 min 
2 0.34 0.66 −0.41552 1.6621 El conductor llega en 1.66 min 
3 0.67 0.33 −1.10866 4.4347 El conductor llega en 4.43 min 
4 0.89 0.11 −2.20727 8.8291 El conductor llega en 8.83 min 
5 0.45 0.55 −0.59784 2.3913 El conductor llega en 2.39 min 
6 0.23 0.77 −0.26136 1.0455 El conductor llega en 1.05 min 
7 0.78 0.22 −1.51413 6.0565 El conductor llega en 6.06 min 
 
• Verificación: x̄  generada = 3.56 min ≈ media teórica = 1/λ = 1/0.25 = 4 min 


# Página 18

 
 P(X=k) = e^(-4) * 4^k / k! donde e^(-4) = 0.01832  
Construya F(k) para k = 0 a 12 y genere 10 observaciones: 
 
k P(X=k) F(k)=P(X<=k) k P(X=k) F(k) 
0 0.018316 0.018316 7 0.059540 0.948866 
1 0.073263 0.091578 8 0.029770 0.978637 
2 0.146525 0.238103 9 0.013231 0.991868 
3 0.195367 0.433470 10 0.005292 0.997160 
4 0.195367 0.628837 11 0.001925 0.999085 
5 0.156293 0.785130 12 0.000642 0.999726 
6 0.104196 0.889326 ___ ____ ____ 
 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
Genere 10 observaciones usando U: 0.08, 0.29, 0.55, 0.71, 0.94, 0.42, 0.63, 0.87, 0.16, 0.48 
 
i U X Poisson i U X Poisson 
1 0.08 1 
Razonamiento 
F(0)=0.0183 < 0.08 ≤ F(1)=0.0916 
 
6 0.42 3 
Razonamiento 
F(2)=0.2381 < 0.42 ≤ F(3)=0.4335 
2 0.29 3 
Razonamiento 
F(2)=0.2381 < 0.29 ≤ F(3)=0.4335 
7 0.63 5 
Razonamiento 
F(4)=0.6288 < 0.63 ≤ F(5)=0.7851 
3 0.55 4 
Razonamiento 
F(3)=0.4335 < 0.55 ≤ F(4)=0.6288 
8 0.87 6 
Razonamiento 
F(5)=0.7851 < 0.87 ≤ F(6)=0.8893 
4 0.71 5 
Razonamiento 
F(4)=0.6288 < 0.71 ≤ F(5)=0.7851 
9 0.16 2 
Razonamiento 
F(1)=0.0916 < 0.16 ≤ F(2)=0.2381 
5 0.94 7 
Razonamiento 
F(6)=0.8893 < 0.94 ≤ F(7)=0.9489 
10 0.48 4 
Razonamiento 
F(3)=0.4335 < 0.48 ≤ F(4)=0.6288 
 
ACTIVIDAD 8.3 — Distribucion Uniforme Continua U(1, 6) 
 
X = a + (b - a) * U => X = 1 + 5 * U 
Use U: 0.15, 0.52, 0.73, 0.38, 0.91. Compare con los tiempos del Bus Urbano. 
 
i U X = 1 + 5*U Bus Urbano 
(Fase 2) 
Diferencia |Bus - 
Plat| 
1 0.15 1 + 5×0.15 = 
1.75 min 
7 5.25 


# Página 19

2 0.52 1 + 5×0.52 = 
3.60 min 
8 4.40 
3 0.73 1 + 5×0.73 = 
4.65 min 
9 4.35 
4 0.38 1 + 5×0.38 = 
2.90 min 
10 7.10 
5 0.91 1 + 5×0.91 = 
5.55 min 
12 6.45 
 
• Analisis comparativo 
  
Indicador Plataforma U(1,6) Bus Urbano (Fase 2) 
Media x̄  3.69 min 9.20 min 
Media teórica μ = (1+6)/2 = 3.50 min — 
Diferencia promedio |Bus−Plat| — 5.51 min 
 
 Interpretación: La distribución U(1,6) modela el tiempo de servicio de las plataformas digitales (entre 1 y 6 min), confirmando que la plataforma 
 digital es en promedio 5.51 minutos más rápida que el bus urbano para los 5 primeros usuarios simulados. La media generada (3.69 min) es muy 
 cercana al valor teórico (3.50 min), lo que valida la correcta aplicación de la transformada inversa. 
 
 

# Página 20

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
FASE 09 TEORIA DE GRAFOS — RED VIAL DE APARTADO 
 
Arista Tiempo 
(min) 
Descripcion vial en Apartado 
A - B 4 Calle Principal <-> Parque Central 
A - C 7 Calle Principal <-> Terminal de Transportes 
B - D 3 Parque Central <-> Zona Comercial 
B - E 6 Parque Central <-> Barrio El Triunfo 
C - D 2 Terminal <-> Zona Comercial 
D - E 5 Zona Comercial <-> Barrio El Triunfo 
D - F 4 Zona Comercial <-> Aeropuerto Los Cedros 
E - F 3 Barrio El Triunfo <-> Aeropuerto Los Cedros 
 
ACTIVIDAD 9.1 — Representacion y analisis del grafo 
 
• Dibuje el grafo con vertices A-F y aristas ponderadas. 
 
• Construya la matriz de adyacencia ponderada (use inf para pares no conectados). 
     A    B    C    D    E    F 
A  [ 0    4    7   inf  inf  inf ] 
B  [ 4    0   inf   3    6   inf ] 
C  [ 7   inf   0    2   inf  inf ] 
D  [inf   3    2    0    5    4  ] 
E  [inf   6   inf   5    0    3  ] 
F  [inf  inf  inf   4    3    0  ] 
 
• Calcule el grado de cada vertice. Determine si el grafo es conexo, si posee circuito euleriano y hamiltoniano. 
Grado de cada vertice: 


# Página 21

  grado(A) = 2  (conecta con B, C) 
  grado(B) = 3  (conecta con A, D, E) 
  grado(C) = 2  (conecta con A, D) 
  grado(D) = 4  (conecta con B, C, E, F) 
  grado(E) = 3  (conecta con B, D, F) 
  grado(F) = 2  (conecta con D, E) 
Analisis: 
- El grafo ES conexo: existe camino entre cualquier par de vertices. 
- NO posee circuito euleriano: los vertices A, B, C, E y F tienen grado impar o no todos los grados son pares. Verificacion: 
grados son 2,3,2,4,3,2 — B, E tienen grado impar (3), por lo tanto no existe circuito euleriano (condicion: todos los vertices 
deben tener grado par). 
- SI posee circuito hamiltoniano: existe un ciclo que pasa por todos los vertices exactamente una vez. El ciclo A ->B->E->F-
>D->C->A = 4+6+3+4+2+7 = 26 min lo demuestra, ya que la arista C-A existe (peso 7), completando el ciclo hamiltoniano. 
 
 
ACTIVIDAD 9.2 — Algoritmo de Dijkstra: ruta A -> F 
Aplique el algoritmo paso a paso. Muestre la tabla de iteraciones: 
 
Iter. Vertice 
visitado 
d[A] d[B] d[C] d[D] d[E] d[F] Camino 
0 A 0 inf inf inf inf inf — 
1 B 0 4 7 inf inf inf A-B 
2 C 0 4 7 7 10 inf A-B-D / A-C 
3 D 0 4 7 7 10 11 A-B-D 
4 E 0 4 7 7 10 11 A-B-D-F 
5 F 0 4 7 7 10 11 A-B-D-F 
 
Ruta optima A -> F: A → B → D → F Tiempo total:11 min 
Pregunta adicional: Si la arista B -D se cierra por obras, cual es la nueva ruta optima A  -> F y cuanto tiempo adicional  implica? 
R// Sin la arista B-D, se recalcula Dijkstra desde A. Las rutas posibles hacia F son: A→C→D→F = 7+2+4 = 13 min, y 
A→C→D→E→F = 7+2+5+3 = 17 min, y A→B→E→F = 4+6+3 = 13 min. La nueva ruta optima es A→C→D→F o A→B→E→F, 
ambas con tiempo total de 13 minutos. El tiempo adicional respecto a la ruta original (11 min) es de 2 minutos (incremento de l 
18.2%). 

# Página 22

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
FASE 10 CRIPTOGRAFIA — PROTECCION DE DATOS DE USUARIOS 
Tras los reportes de filtracion de datos, la Alcaldia  exige que las plataformas implementen cifrado.  Se evaluaran tres niveles de 
seguridad. 
 
ACTIVIDAD 10.1 — Cifrado Cesar (k = 6) 
E(x) = (x + 6) mod 26 Mensaje: TRANSPORTE PUBLICO APARTADO 
 
Letra Valor x x+6 (x+6) mod 26 Letra cifrada 
T 19 25 25 Z 
R 17 23 23 X 
A 0 6 6 G 
N 13 19 19 T 
S 18 24 24 Y 
P 15 21 21 V 
O 14 20 20 U 
R 17 23 23 X 
T 19 25 25 Z 
E 4 10 10 K 
P 15 21 21 V 
U 20 26 0 A 
B 1 7 7 H 
L 11 17 17 R 
I 8 14 14 O 
C 2 8 8 I 
O 14 20 20 U 
A 0 6 6 G 
P 15 21 21 V 
A 0 6 6 G 
R 17 23 23 X 
T 19 25 25 Z 
A 0 6 6 G 
D 3 9 9 J 
O 14 20 20 U 
 
Texto cifrado completo: ZXGTYVUXZKVAHROIUGVGXZGJU  
¿Por que el cifrado Cesar es inseguro? Explique el ataque de analisis de frecuencias. 
R// El cifrado Cesar es inseguro porque su espacio de claves es de solo 25 valores posibles (desplazamientos 
del 1 al 25), lo que permite un ataque de fuerza bruta en segundos. Ademas, no oculta la distribucion de 
frecuencias de las letras: en espanol, la letra E aparece con frecuencia ~13%, seguida de A (~12%) y O (~9%). 
En el texto cifrado, la letra con mayor frecuencia corresponde al cifrado de E, lo que permite al atacante 
deducir el desplazamiento k sin probar todas las claves. Por ejemplo, si la letra mas frecuente en el 
criptograma es K, se infiere k = K - E = 10 - 4 = 6, revelando la clave sin conocerla previamente.  


# Página 23

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
 
ACTIVIDAD 10.3 — RSA Simplificado (p=17, q=11, M=15) 
 
Paso Formula Desarrollo  Resultado 
1. Calcule n n = p * q n = 17 x 11 = 187  
2. Calcule 
phi(n) 
phi(n) = (p-1)*(q- 
1) 
phi(n) = 16 x 10 = 160  
3. e=7, 
verificar 
mcd(e, phi(n)) = 1 mcd(7, 160) = 1  
4. Calcule d d = e^(-1) mod 
phi(n) 
7 * d = 1 (mod 160) 23  
5. Cifre M=15 C = M^e mod n C = 15^7 mod 187 93  
6. Descifre C M = C^d mod n M = C^d mod 187 15 Es = 15? 
 
Exponenciacion rapida para 15^7 mod 187 (cuadrados sucesivos): 
 
7 en binario = 0111_2 => Calcule: 15^1 mod 187, 15^2 mod 187, 15^4 mod 187 
 
15^1 mod 187 = 15 
15^2 mod 187 = 225 mod 187 = 38  
15^4 mod 187 = 38^2 mod 187 = 1444 mod 187 = 135  
7 = 4+2+1 = 111_2, entonces: 15^7 = 15^4 * 15^2 * 15^1 mod 187 = 135 * 38 * 15 mod 187  
135 * 38 = 5130 mod 187 = 5130 - 27*187 = 5130 - 5049 = 81 
81 * 15 = 1215 mod 187 = 1215 - 6*187 = 1215 - 1122 = 93. Por lo tanto C = 93.  
Verificacion: 15^7 mod 187 = 93.  
 
Reflexion de seguridad: 
• Por que RSA con p y q pequennos es inseguro en produccion? 
R/ RSA con p y q pequenos es inseguro porque n = p*q es factorizable en tiempo polinomial. Con valores de solo 
2 cifras (p=17, q=11, n=187), un atacante puede probar todos los primos menores a raiz(187) = 13.7 en segundos 
y recuperar phi(n) y la clave privada d. La seguridad de RSA depende de que la factorizacion de n sea 
computacionalmente intratable, lo cual solo se logra con n de al menos 2048 bits en la actualidad. 
• Cuantos bits necesitan p y q en un sistema de pago real como InDrive? 
R/ En un sistema de pago real como InDrive, p y q deben ser primos de al menos 1024 bits cada uno, generando un modulo n 
de 2048 bits (estandar minimo actual segun NIST). Para mayor seguridad y longevidad del sistema se recomienda usar 2048 
bits por primo y n de 4096 bits, especialmente para proteger datos financieros y de ubicacion de usuarios.  
• Que relacion existe entre el Mersenne Twister (Fase 6) y la generacion de claves RSA? 
R/ El Mersenne Twister NO debe usarse para generar claves RSA porque no es criptograficamente seguro: su estado interno 
(624 palabras de 32 bits = 19936 bits) puede reconstruirse completamente observando 624 salidas consecutivas, lo que 
permitiria a un atacante predecir los primos p y q generados y romper la clave. Para RSA se deben usar generadores 
criptograficamente seguros (CSPRNG) como /dev/urandom en Linux o los provistos por librerias como OpenSSL, que 
incorporan entropia del sistema operativo y son impredecibles. 
 


# Página 24

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
 
FASE 11 RELOJ DE SIMULACION — CALENDARIO DE EVENTOS 
Con los tiempos obtenidos en las fases anteriores, construya el calendario de eventos discretos (FEL) para los primeros 40 
minutos de operacion del sistema de buses de Apartado. 
 
Reloj t Evento Cliente En 
sistema 
En 
cola 
Estado 
servidor Proximo evento 
0 INICIO — 0 0 Libre Llegada C1 (t=7) 
7 LLEGADA C1 0 0 Ocupado Salida C1 (t=12) / 
Llegada C2 (t=15) 
12 SALIDA C1 1 0 Libre  
Llegada C2 (t=15) 
 
15 LLEGADA C2 0 0 Ocupado Salida C2 (t=20) / 
Llegada C3 (t=24) 
20 SALIDA C2 1 0 Libre  
Llegada C3 (t=24) 
 
24 LLEGADA C3 0 0 Ocupado Salida C3 (t=29) / 
Llegada C4 (t=34) 
29 SALIDA C3 1 0 Libre Llegada C4 (t=34) 
34 LLEGADA C4 0 0 Ocupado 
Salida C4 (t=39) / 
Llegada C5 (t=46 — 
fuera de ventana) 
39 SALIDA C4 1 0 Libre — (C5 llega a t=46, 
fuera del rango t≤40) 
40 FIN 
VENTANA  0 0 Libre Simulación terminada 
 
(a) En que instantes el servidor estuvo ocioso? Calcule el tiempo total de ociosidad.  
El servidor estuvo ocioso en tres intervalos: 
— t = 0 a t = 7 → 7 minutos (antes de que llegue el primer cliente) 
— t = 12 a t = 15 → 3 minutos (entre salida C1 y llegada C2) 
— t = 20 a t = 24 → 4 minutos (entre salida C2 y llegada C3) 
— t = 29 a t = 34 → 5 minutos (entre salida C3 y llegada C4) 
— t = 39 a t = 40 → 1 minuto (tras salida C4 hasta fin de ventana) 
 
Tiempo total de ociosidad = 7 + 3 + 4 + 5 + 1 = 20 minutos 
Porcentaje de ociosidad = 20/40 × 100 = 50% 
 
Esto es coherente con ρ_bus = λ/μ = (1/10.8)/(1/5) = 0.463, lo que implica que el servidor está ocupado ≈46% del tiempo teóri co. 
El resultado empírico (50% ocupado, 50% ocioso) es consistente con ese factor de utilización.  
 
 
 


# Página 25

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
(b) Cual fue la longitud maxima de la cola y en que tiempo t ocurrio? 
 
La longitud máxima de la cola fue 0 clientes en todo momento. Dado que los intervalos entre llegadas (7, 9, 10, 12 min) son 
superiores al tiempo de servicio (5 min), el servidor siempre terminó de atender antes de que llegara el siguiente cliente. N unca se 
formó cola durante los primeros 40 minutos. 
 
(c) Grafique la evolucion de N(t) = numero de clientes en el sistema vs. tiempo t.  
 
 


# Página 26

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
 
FASE 12 IMPLEMENTACION EN PYTHON — SISTEMA INTEGRADO 
Desarrolle un sistema modular en Python. Use random.seed(42) para reproducibilidad. Comente cada linea de codigo. 
 
Modulo Funcion principal Salida esperada 
A — Estadistica Calcule todos los estadisticos Fase 1 para 
ambos sistemas 
Tabla comparativa + histogramas 
B — Montecarlo Simule 500 usuarios en cada sistema con 
distrib. empirica 
Tabla + tiempo total por sistema 
C — Colas Implemente cola M/G/1 con tiempos de la 
Fase 2 
Wq, W, Lq, L, rho + grafica cola 
D — Generadores MCL (Fase 6) + MT19937 (random). 
Genere 1000 c/u 
Secuencias + grafica comparativa 
E — Pruebas chi^2, KS y Shapiro-Wilk automaticos para 
ambos generadores 
Estadistico, valor p, conclusion 
F — 
Transformada 
Exp(0.25), Poisson(4), U(1,6) — 1000 
valores c/u 
Histogramas con PDF/PMF teorica 
G — Grafos Red vial con networkx. Dijkstra A ->F y 
cierre B-D 
Grafo visualizado + tabla rutas 
H — Criptografia Cesar, Afin con inverso, RSA con 
exponenciacion rapida 
Menu interactivo cifrado/descifrado 
I — Dashboard Reporte comparativo Bus vs. 
Plataforma 
PDF o HTML automatico 


# Página 27

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
 
FASE 13 INFORME TECNICO Y RECOMENDACION A LA ALCALDIA 
Seccion del informe Contenido minimo requerido Paginas 
1. Resumen ejecutivo Recomendacion + 3 indicadores clave que la sustentan 1 
2. Analisis estadistico Resultados Fase 1 con tablas, histogramas e interpretacion 3 
3. Simulacion Montecarlo Distribuciones empiricas, tablas y analisis comparativo 2 
4. Pruebas estadisticas chi^2, KS y Shapiro-Wilk con interpretacion y conclusion 3 
5. Teoria de colas Indicadores Wq, W, Lq, rho. Decision de ampliar capacidad 2 
6. Generadores + rachas MCL vs. MT19937. Recomendacion del generador a usar 2 
7. Transformada inversa Comparacion Exp, Poisson, Uniforme vs. datos reales 2 
8. Red vial y grafos Dijkstra, rutas minimas, impacto cierre de aristas 2 
9. Criptografia Cesar, Afin y RSA. Recomendacion estandar de cifrado 2 
10. Codigo Python Codigo comentado + capturas de resultados Anexo 
11. Conclusiones Respuesta directa a la pregunta central + politica publica 2 
12. Referencias APA Minimo 8 fuentes academicas (libros, articulos, software) 1 
 
 
 
RUBRICA DE EVALUACION 
 
Componente evaluado Peso 
(%) 
Criterio de evaluacion superior (5.0) 
Fases 1-4: Estadistica, variables, 
Montecarlo 
20% Calculos correctos, tablas completas, analisis critico con 
datos 
Fases 5-7: Colas, generadores, 
pruebas chi^2/KS/SW 
25% Tabla de colas completa, tres pruebas con conclusion correcta 
Fase 8: Transformada inversa (3 
distribuciones) 
10% Tres distribuciones generadas y comparadas con datos reales 
Fase 9: Grafos + Dijkstra + cierre 
de arista 
10% Grafo correcto, Dijkstra completo, analisis de cierre 
Fase 10: Criptografia (Cesar + Afin 
+ RSA) 
15% Tres algoritmos correctos, inverso y exponenciacion rapida 
Fase 12: Implementacion 15% Todos los modulos funcionales, comentados, con 


# Página 28

 
 
POLITÉCNICO COLOMBIANO JAIME ISAZA CADAVID 
FORMATO PARA REALIZACIÓN DE ACTIVIDADES EVALUATIVAS 
FACULTAD DE: Ingeniería. 
PROGRAMA: Ingeniería informática. 
Código: 
FD-GC195 
Versión: 02 
ASIGNATURA CÓDIGO: 
ING 01210 Modelos y simulación 
PROFESOR: Alexander Jaramillo Córdoba FECHA: 08/04/2026 
TIPO DE 
EVALUACIÓN 
TALLER QUIZ PARCIAL FINAL OTRO – CUÁL? 
  x   
 
Python (9 modulos)  graficas 
Fase 13: Informe + 
Recomendacion de politica  
5% Informe cohesivo, APA correcto, recomendacion 
cuantificada 
TOTAL 100%  
 
 
 
REFERENCIAS ORIENTADORAS (APA 7.a edicion) 
Banks, J., Carson, J. S., Nelson, B. L., & Nicol, D. M. (2010). Discrete-event system simulation (5.a ed.). Pearson Education. 
Law, A. M. (2015). Simulation modeling and analysis (5.a ed.). McGraw-Hill Education. 
Matsumoto, M., & Nishimura, T. (1998). Mersenne Twister: A 623 -dimensionally equidistributed uniform pseudo - random 
number generator. ACM Transactions on Modeling and Computer Simulation, 8(1), 3 -30. 
https://doi.org/10.1145/272991.272995 
Shapiro, S. S., & Wilk, M. B. (1965). An analysis of variance test for normality (complete samples). Biometrika, 52(3- 4), 591-
611. https://doi.org/10.2307/2333709  
Stallings, W. (2017). Cryptography and network security: Principles and practice (7.a ed.). Pearson Education. Taha, H. A. 
(2017). Operations research: An introduction (10.a ed.). Pearson Education.  
 
 
Politecnico Colombiano Jaime Isaza Cadavid — Seccional Apartado | Modelos y Simulacion | Examen Final 
Integrador ABP | 2021-6 


