// Quick test of normalizeText and computeAdliye
function normalizeText(s) {
  if (!s && s !== 0) return '';
  let str = String(s).normalize('NFKD').toLowerCase();
  str = str.replace(/\p{M}/gu, '');
  const map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'İ': 'i' };
  str = str.replace(/[çğıöşüİ]/g, ch => map[ch] || ch);
  str = str.replace(/[^a-z0-9\s]/g, ' ');
  str = str.replace(/\s+/g, ' ').trim();
  return str;
}

function computeAdliye(icra_dairesi) {
  const d = normalizeText(icra_dairesi || '');
  if (!d) return 'DİĞER';
  if (d.includes('anadolu') || d.includes('istanbul anadolu')) return 'ANADOLU';
  if (d.includes('bakirkoy') || d.includes('bakirky') || d.includes('bakirköy') || d.includes('bakırkoy')) return 'BAKIRKÖY';
  if (d.includes('caglayan') || d.includes('cagla') || d.includes('caglayan')) return 'ÇAĞLAYAN';
  if (d.includes('istanbul')) return 'ÇAĞLAYAN';
  if (d.includes('izmir')) return 'İZMİR';
  if (d.includes('antalya')) return 'ANTALYA';
  if (d.includes('adana')) return 'ADANA';
  return 'DİĞER';
}

const samples = [
  'İstanbul Anadolu 12. İcra',
  'Anadolu İcra',
  'İstanbul Çağlayan 7. İcra',
  'Bakırköy İcra',
  'İstanbul 15. İcra',
  'ÇAĞLAYAN İCRA DAİRESİ',
  'İzmir 5. İcra',
  '',
  'Unknown Court'
];

for (const s of samples) {
  console.log(JSON.stringify(s), '=>', computeAdliye(s));
}
