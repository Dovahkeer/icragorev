# Bu dosyayı sağ tıklayıp "PowerShell ile Çalıştır" (Yönetici olarak) seçin

Write-Host "Windows Firewall kuralı ekleniyor..." -ForegroundColor Yellow

try {
    New-NetFirewallRule -DisplayName "Node.js Görev Yönetimi (Port 3000)" `
                        -Direction Inbound `
                        -LocalPort 3000 `
                        -Protocol TCP `
                        -Action Allow `
                        -Profile Any `
                        -ErrorAction Stop
    
    Write-Host "`n✅ Firewall kuralı başarıyla eklendi!" -ForegroundColor Green
    Write-Host "Diğer bilgisayarlar artık http://192.168.10.124:3000 adresinden erişebilir." -ForegroundColor Cyan
} catch {
    Write-Host "`n❌ Hata: $_" -ForegroundColor Red
    Write-Host "`nManuel olarak eklemek için:" -ForegroundColor Yellow
    Write-Host "1. Windows Güvenlik Duvarı > Gelişmiş Ayarlar" -ForegroundColor White
    Write-Host "2. Gelen Kurallar > Yeni Kural" -ForegroundColor White
    Write-Host "3. Bağlantı Noktası > TCP > 3000" -ForegroundColor White
    Write-Host "4. Bağlantıya İzin Ver" -ForegroundColor White
}

Write-Host "`nDevam etmek için bir tuşa basın..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
