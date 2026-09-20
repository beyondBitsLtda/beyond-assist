@echo off
setlocal
rem ============================================================================
rem  docgen - atalho do Windows
rem
rem  DOIS CLIQUES              abre a tela do docgen no navegador
rem  ARRASTAR UMA PASTA AQUI   gera a documentacao daquela pasta direto
rem
rem  O segundo caso existe porque arrastar e a unica forma de "clicar" num
rem  caminho no Windows: o Explorer passa a pasta como argumento, e o docgen
rem  recebe o caminho sem ninguem ter de digitar nada.
rem ============================================================================

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   O Node.js nao foi encontrado nesta maquina.
  echo   O docgen precisa dele para rodar. Abra um chamado no Service Desk ^(GLPI^)
  echo   pedindo a instalacao do Node.js LTS - a TI instala com seguranca.
  echo.
  pause
  exit /b 1
)

if "%~1"=="" (
  echo.
  echo   Abrindo a tela do docgen...
  echo.
  node bin\docgen.js --tela
  exit /b %errorlevel%
)

echo.
echo   Gerando a documentacao de: %~1
echo.
node bin\docgen.js "%~1" --publicar --forcar
echo.
pause
