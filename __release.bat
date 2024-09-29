
powershell -Command "powershell Get-Content -Path __data/zsr-0.js -Encoding utf8 | Set-Content -Path chrome/content/zsr.js -Encoding utf8"
powershell -Command "powershell Get-Content -Path __data/zsr-1.js -Encoding utf8 | Add-Content -Path chrome/content/zsr.js -Encoding utf8"

:: 打包
del zotero-scholar-rank.zip
del zotero-scholar-rank.xpi
7z a -tzip zotero-scholar-rank.zip chrome defaults locale bootstrap.js chrome.manifest install.rdf manifest.json
ren  zotero-scholar-rank.zip Zotero-Scholar-Rank.xpi

:: 计算哈希值
set "filePath=Zotero-Scholar-Rank.xpi"
for /f "delims=" %%i in ('powershell -command "Get-FileHash -Path '%filePath%' -Algorithm SHA256 | Select-Object -ExpandProperty Hash"') do set "hash=%%i"
echo 文件的 SHA-256 哈希值是: %hash%

pause