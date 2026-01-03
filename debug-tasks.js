const { db } = require('./config/database');

async function debugTasks() {
  try {
    console.log('\n=== KULLANICILAR ===');
    const users = await db('users').select('id', 'username', 'role');
    console.table(users);
    
    console.log('\n=== GÖREVLER ===');
    const tasks = await db('tasks').select('id', 'islem_turu', 'status', 'assignee_id', 'manager_id', 'creator_id');
    console.table(tasks);
    
    console.log('\n=== YÖNETİCİ ID 4 İÇİN ATANAN GÖREVLER (myAssignedTasks) ===');
    const myAssignedTasks = await db('tasks')
      .where('assignee_id', 4)
      .whereIn('status', ['tamamlanmadi', 'kontrol_ediliyor', 'iade'])
      .orderBy('created_at', 'desc')
      .select('*');
    console.log('Sorgu sonucu:', myAssignedTasks.length, 'görev');
    console.table(myAssignedTasks);
    
    console.log('\n=== YÖNETİCİ ID 4 İÇİN SON ONAY BEKLEYENLER (forFinalApproval) ===');
    const forFinalApproval = await db('tasks')
      .where('status', 'son_onay_bekliyor')
      .where('manager_id', 4)
      .orderBy('created_at', 'desc')
      .select('*');
    console.log('Sorgu sonucu:', forFinalApproval.length, 'görev');
    console.table(forFinalApproval);
    
    process.exit(0);
  } catch (error) {
    console.error('Hata:', error);
    process.exit(1);
  }
}

debugTasks();
