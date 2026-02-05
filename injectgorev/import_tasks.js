/*
 * JSON -> SQLite tasks importer
 * Usage: node injectgorev/import_tasks.js [input.json] [--dry-run] [--out=path]
 * Defaults: input=injectgorev/ornek10veri.json, out=injectgorev/tasksornek.json
 */

const fs = require('fs');
const path = require('path');
const { db } = require('../config/database');
const { computeAdliye, normalizeText } = require('../helpers/adliye');

const args = process.argv.slice(2);
const inputPath = args.find(a => !a.startsWith('--')) || path.join(__dirname, 'ornek10veri.json');
const dryRun = args.includes('--dry-run');
const outArg = args.find(a => a.startsWith('--out='));
const outputPath = outArg ? outArg.replace('--out=', '') : path.join(__dirname, 'tasksornek.json');

const CREATOR_ID = 3; // top raks ezgin (atayan) per requirement

// assignee name -> user id mapping
const assigneeMap = {
  'adem can ozkan': 8,
  'ademcan ozkan': 8,
  'adem ozkan': 8,
  'ozkan adem can': 8,
  'omercan oruc': 6,
  'omer can oruc': 6,
  'melissa ozturk': 7,
  'melissaozturk': 7,
  'humeyra': 12,
  'cansu bozbek': 11,
};

// status text -> enum mapping
const statusMap = new Map([
  ['kontrol bekleniyor', 'kontrol_bekleniyor'],
  ['kontrol bekle', 'kontrol_bekleniyor'],
  ['kontrol', 'kontrol_bekleniyor'],
  ['arsiv', 'arsiv'],
]);

function parseDate(str) {
  if (!str) return null;
  const m = String(str).trim().match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!m) return null;
  const [ , d, M, yRaw ] = m;
  const year = yRaw.length === 2 ? Number('20' + yRaw) : Number(yRaw);
  const iso = new Date(Date.UTC(year, Number(M) - 1, Number(d))).toISOString().slice(0, 10);
  return iso;
}

function splitDebtor(raw) {
  const val = raw || '';
  const parts = val.split('-');
  const namePart = parts[0].trim();
  const number = (parts[1] || '').match(/\d{8,}/g);
  const tckn = number && number.length ? number[number.length - 1] : '';
  return { borclu: namePart || null, borclu_tckn_vkn: tckn || null };
}

function mapOncelik(v) {
  if (!v) return 'rutin';
  const n = normalizeText(v);
  return n.includes('acil') ? 'acil' : 'rutin';
}

function mapStatus(text) {
  if (!text) return 'tamamlanmadi';
  const n = normalizeText(text);
  for (const [k, v] of statusMap.entries()) {
    if (n.includes(k)) return v;
  }
  return 'tamamlanmadi';
}

function mapAssignee(name) {
  if (!name) return null;
  const n = normalizeText(name);
  return assigneeMap[n] || null;
}

function buildIslem(row) {
  const chunks = [];
  if (row['İşlem AÇIKLAMASI']) chunks.push(`[İşlem Açıklaması]\n${row['İşlem AÇIKLAMASI'].trim()}`);
  if (row['İşlem Durum Not']) chunks.push(`[İşlem Durum Not]\n${row['İşlem Durum Not'].trim()}`);
  if (row['NOT']) chunks.push(`[Not]\n${row['NOT'].trim()}`);
  return chunks.join('\n\n');
}

function mapRow(row) {
  const borcVal = row?.Borçlu?.['Borçlu TCKN-VKN'] || '';
  const debtor = splitDebtor(borcVal);
  const icra_dairesi = row['İcra Dairesi'] || '';
  const adliye = computeAdliye(icra_dairesi);
  const eklenme = parseDate(row['Eklenme Tarihi']) || new Date().toISOString().slice(0, 10);
  const islem_turu = (row['TAKİP EDEN SON DURUM'] || row['YÖNETİCİ SON DURUM'] || '').trim();
  const islem_aciklamasi = buildIslem(row);
  const oncelik = mapOncelik(row['ÖNCELİK']);
  const status = mapStatus(row['YÖNETİCİ SON DURUM']);
  const assignee_id = mapAssignee(row['TAKİP EDEN']);

  return {
    adliye,
    muvekkil: row['Müvekkil'] || null,
    portfoy: row['Portföy'] || null,
    borclu: debtor.borclu,
    borclu_tckn_vkn: debtor.borclu_tckn_vkn,
    icra_dairesi,
    icra_esas_no: row['İcra Esas Numarası'] || null,
    islem_turu: islem_turu || null,
    islem_aciklamasi,
    oncelik,
    status,
    creator_id: CREATOR_ID,
    assignee_id,
    manager_id: null,
    last_status_by: CREATOR_ID,
    eklenme_tarihi: eklenme,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
}

async function insertBatched(rows, size = 400) {
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    await db('tasks').insert(slice);
  }
}

async function main() {
  if (!fs.existsSync(inputPath)) {
    console.error('Input JSON bulunamadı:', inputPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    console.error('Beklenen format: array');
    process.exit(1);
  }

  const mapped = data.map(mapRow);
  console.log(`Toplam ${mapped.length} kayıt hazırlandı.`);

  if (dryRun) {
    console.log('Dry-run: ilk kayıt örneği:', mapped[0]);
    process.exit(0);
  }

  const maxRow = await db('tasks').max({ maxId: 'id' }).first();
  const prevMax = maxRow && maxRow.maxId ? Number(maxRow.maxId) : 0;

  await insertBatched(mapped, 400);
  console.log(`✓ ${mapped.length} kayıt tasks tablosuna eklendi (batched).`);

  // tasksornek.json güncelle
  let existing = { tasks: [] };
  if (fs.existsSync(outputPath)) {
    try {
      const tRaw = fs.readFileSync(outputPath, 'utf8');
      const parsed = JSON.parse(tRaw);
      if (parsed && Array.isArray(parsed.tasks)) existing = parsed;
    } catch (e) {
      console.warn('tasksornek.json okunamadı, üzerine yazılacak:', e.message);
    }
  }

  const insertedRows = await db('tasks').where('id', '>', prevMax).select('*');
  existing.tasks = existing.tasks.concat(insertedRows);
  fs.writeFileSync(outputPath, JSON.stringify(existing, null, 2));
  console.log(`✓ ${outputPath} güncellendi (toplam ${existing.tasks.length} kayıt).`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
