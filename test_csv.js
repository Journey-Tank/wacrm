const fs = require('fs');

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseTagCell(value) {
  if (!value || !value.trim()) return [];
  const seen = new Set();
  const names = [];
  for (const part of value.split(/[,;]/)) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function parseContactCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], hasTagsColumn: false, hasCompanyColumn: false };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/["']/g, ''));
  const phoneIdx = headers.indexOf('phone');
  if (phoneIdx === -1) return { rows: [], hasTagsColumn: false, hasCompanyColumn: false };
  const nameIdx = headers.indexOf('name');
  const tagsIdx = headers.indexOf('tags');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const phone = values[phoneIdx]?.replace(/["']/g, '').trim();
    if (!phone) continue;
    rows.push({
      phone,
      name: nameIdx >= 0 ? values[nameIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      tagNames: tagsIdx >= 0 ? parseTagCell(values[tagsIdx]?.replace(/["']/g, '')) : [],
    });
  }
  return { rows };
}

const csv = `phone,name,tags\n1234567890,"John, Doe", "tag1, tag2"`;
console.log(JSON.stringify(parseContactCsv(csv), null, 2));
