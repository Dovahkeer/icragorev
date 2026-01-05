// Robust adliye detection helper
const normalizeText = (s) => {
  if (!s && s !== 0) return '';
  let str = String(s).normalize('NFKD').toLowerCase();
  str = str.replace(/\p{M}/gu, '');
  const map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'İ': 'i' };
  str = str.replace(/[çğıöşüİ]/g, ch => map[ch] || ch);
  str = str.replace(/[^a-z0-9\s]/g, ' ');
  str = str.replace(/\s+/g, ' ').trim();
  return str;
};

const known = [
  { key: 'anadolu', aliases: ['anadolu'] },
  { key: 'caglayan', aliases: ['caglayan', 'cagla', 'caglayan icra', 'caglayan icra dairesi'] },
  { key: 'bakirkoy', aliases: ['bakirkoy', 'bakirky', 'bakirkoy icra'] },
  { key: 'izmir', aliases: ['izmir'] },
  { key: 'antalya', aliases: ['antalya'] },
  { key: 'adana', aliases: ['adana'] },
  { key: 'ankara', aliases: ['ankara'] },
  { key: 'ankara cakmak', aliases: ['cakmak'] }
];

function computeAdliye(icra_dairesi) {
  const raw = icra_dairesi || '';
  const d = normalizeText(raw);

  // Boş ise DİĞER
  if (!d) return 'DİĞER';

  // ÖNCELİK SIRASI - Excel mantığıyla aynı:
  
  // 1) ANADOLU - en öncelikli (anadolu geçiyorsa istanbul olsa bile ANADOLU)
  if (d.includes('anadolu')) return 'ANADOLU';

  // 2) İSTANBUL - anadolu geçmiyorsa istanbul geçiyorsa ÇAĞLAYAN
  if (d.includes('istanbul')) return 'ÇAĞLAYAN';

  // 3) İZMİR
  if (d.includes('izmir')) return 'İZMİR';

  // 4) ADANA
  if (d.includes('adana')) return 'ADANA';

  // 5) ANTALYA
  if (d.includes('antalya')) return 'ANTALYA';

  // 6) BURSA
  if (d.includes('bursa')) return 'BURSA';

  // 7) ANKARA
  if (d.includes('ankara')) return 'ANKARA';

  // 8) BAKIRKOY
  if (d.includes('bakirkoy') || d.includes('bakirky')) return 'BAKIRKOY';

  // Hiçbiri değilse
  return 'DİĞER';
}

module.exports = { computeAdliye, normalizeText };
