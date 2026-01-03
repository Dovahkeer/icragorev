const { db } = require('./config/database');

async function clearTasks() {
  try {
    console.log('\n🗑️  Görevler temizleniyor...');
    
    // Önce task_history'yi temizle (foreign key constraint)
    const historyCount = await db('task_history').count('* as count').first();
    await db('task_history').del();
    console.log(`✓ ${historyCount.count} task_history kaydı silindi`);
    
    // Sonra tasks'ı temizle
    const tasksCount = await db('tasks').count('* as count').first();
    await db('tasks').del();
    console.log(`✓ ${tasksCount.count} görev silindi`);
    
    console.log('\n✅ Tüm görevler ve arşiv temizlendi!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

clearTasks();
