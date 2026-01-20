const { db } = require('./config/database');

async function deleteTasksByCreatorAndDate() {
    try {
        // topraksezgin kullanıcısının ID'sini bul
        const creator = await db('users')
            .where({ username: 'topraksezgin' })
            .first();

        if (!creator) {
            console.log('❌ topraksezgin kullanıcısı bulunamadı!');
            return;
        }

        console.log(`✓ topraksezgin kullanıcısı bulundu (ID: ${creator.id})\n`);

        // 16.01.2026 tarihinde bu kullanıcı tarafından atanan görevleri bul
        // Hem '2026-01-16' hem de '2026-01-16T...' formatlarını yakala
        const tasksToDelete = await db('tasks')
            .where({ creator_id: creator.id })
            .where(function () {
                this.where('eklenme_tarihi', 'like', '2026-01-16%')
                    .orWhere('eklenme_tarihi', '=', '2026-01-16');
            })
            .select('*');

        console.log(`📋 16.01.2026 tarihinde topraksezgin tarafından atanan görevler:`);
        console.log(`   Toplam: ${tasksToDelete.length} görev\n`);

        if (tasksToDelete.length === 0) {
            console.log('✓ Silinecek görev bulunamadı.');
            process.exit(0);
        }

        // Görevleri listele
        console.log('Silinecek görevler:');
        console.log('─'.repeat(100));
        tasksToDelete.forEach((task, index) => {
            const assignee = task.assignee_id ? `Atanan: ${task.assignee_id}` : 'Atanmamış';
            console.log(`${index + 1}. ID: ${task.id} | ${task.eklenme_tarihi} | ${task.muvekkil} | ${task.borclu} | ${task.islem_turu} | ${assignee}`);
        });
        console.log('─'.repeat(100));

        console.log('\n⚠️  BU GÖREVLER SİLİNECEK! Devam etmek için 5 saniye bekleniyor...\n');

        // 5 saniye bekle
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Görevleri sil
        const deletedCount = await db('tasks')
            .where({ creator_id: creator.id })
            .where(function () {
                this.where('eklenme_tarihi', 'like', '2026-01-16%')
                    .orWhere('eklenme_tarihi', '=', '2026-01-16');
            })
            .delete();

        console.log(`✅ ${deletedCount} görev başarıyla silindi!`);
        console.log('✓ İlişkili geçmiş kayıtları da temizlendi (CASCADE).\n');

        console.log('🔄 Değişikliklerin tüm kullanıcıların ekranlarında görünmesi için');
        console.log('   sayfalarını yenilemeleri gerekiyor.');

    } catch (error) {
        console.error('❌ Hata:', error);
    } finally {
        await db.destroy();
        process.exit(0);
    }
}

deleteTasksByCreatorAndDate();
