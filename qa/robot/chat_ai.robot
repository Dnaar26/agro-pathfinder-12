*** Settings ***
Documentation     Suite automatizada en Robot Framework (Browser/Playwright) enfocada en la pantalla única /chat (Puerto 8080)
Resource          resources/chat_keywords.resource
Test Teardown     Close Browser

*** Test Cases ***
TC01 - Adaptabilidad Movil Y Ergonomia Tactil En Pantalla Chat
    [Tags]    ui    responsive    mobile
    Iniciar Sesion Y Abrir Pantalla Chat    width=390    height=844
    Verificar Area Tactil Minima En Movil    ${LOC_CHAT_SEND}    44
    ${overflow}=    Evaluate JavaScript    ${LOC_CHAT_SCREEN}
    ...    () => document.documentElement.scrollWidth <= window.innerWidth
    Should Be True    ${overflow}    Existe scroll horizontal indeseado en viewport móvil 390px

TC02 - Respuesta Estructurada Con Tabla Markdown Y Alerta Fitosanitaria
    [Tags]    functional    ai-chat    markdown
    Iniciar Sesion Y Abrir Pantalla Chat    width=1440    height=900
    Enviar Consulta Agronomica    Genera una tabla de fertilización NPK por hectárea para cultivo de maíz
    Wait For Elements State    ${LOC_MD_TABLE}       visible    timeout=30s
    Wait For Elements State    ${LOC_WARNING_BOX}    visible    timeout=30s
    Get Text                   ${LOC_MD_TABLE}       contains   ha

TC03 - Prevencion De Envio En Blanco Y Atributos ARIA De Accesibilidad
    [Tags]    accessibility    validation
    Iniciar Sesion Y Abrir Pantalla Chat    width=1280    height=800
    Get Element States    ${LOC_CHAT_SEND}    *=    disabled
    Get Attribute         [data-testid="chat-messages-log"]    role         ==    log
    Get Attribute         [data-testid="chat-messages-log"]    aria-live    ==    polite
