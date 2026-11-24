*** Settings ***
Library    Browser

*** Variables ***
${BASE_URL}          http://localhost:8080
${TEST_USER_EMAIL}   admin@sgic.local
${TEST_USER_PASS}    QaSegura2026!
${LOC_CHAT_SCREEN}   [data-testid="chat-screen"]
${LOC_CHAT_INPUT}    [data-testid="chat-input"]
${LOC_CHAT_SEND}     [data-testid="chat-send-button"]
${LOC_MD_TABLE}      [data-testid="chat-markdown-table"]
${LOC_WARNING_BOX}   [data-testid="chat-warning-callout"]

*** Keywords ***
Iniciar Sesion Y Abrir Pantalla Chat
    [Arguments]    ${width}=1440    ${height}=900
    New Browser    chromium    headless=True
    New Context    viewport={'width': ${width}, 'height': ${height}}
    New Page       ${BASE_URL}/auth?mode=login
    Fill Text      #email       ${TEST_USER_EMAIL}
    Fill Text      #password    ${TEST_USER_PASS}
    Click          form button[type="submit"]
    Wait For Load State    networkidle
    Go To          ${BASE_URL}/chat
    Wait For Elements State    ${LOC_CHAT_SCREEN}    visible    timeout=15s

Enviar Consulta Agronomica
    [Arguments]    ${pregunta}
    Fill Text      ${LOC_CHAT_INPUT}    ${pregunta}
    Click          ${LOC_CHAT_SEND}

Verificar Area Tactil Minima En Movil
    [Arguments]    ${selector}    ${min_px}=44
    ${box}=        Get BoundingBox    ${selector}
    Should Be True    ${box}[height] >= ${min_px}    El alto del botón (${box}[height]px) es menor a ${min_px}px
    Should Be True    ${box}[width] >= ${min_px}     El ancho del botón (${box}[width]px) es menor a ${min_px}px
