type Row = unknown[];

const NAME_HEADERS = ['fullname', 'name', 'participant', 'participantname', 'nameofparticipant', 'trainee', 'traineename'];
const LAST_HEADERS = ['lastname', 'surname', 'familyname'];
const FIRST_HEADERS = ['firstname', 'givenname'];
const GROUP_HEADERS = ['group', 'batch', 'grouporbatch', 'training', 'trainingname', 'team'];

const key = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export interface RosterImport {
  entries: { name: string; group: string }[];
  skipped: number;
}

/** Finds the header row (within the first 20 rows) and reads names and optional groups. */
export function parseRosterRows(rows: Row[]): RosterImport {
  const headerIndex = rows
    .slice(0, 20)
    .findIndex((r) => r.some((c) => NAME_HEADERS.includes(key(c)) || LAST_HEADERS.includes(key(c))));
  if (headerIndex < 0) {
    throw new Error('No name column found. Add a header named "Full Name" (or "Last Name" and "First Name").');
  }
  const header = rows[headerIndex].map(key);
  const col = (names: string[]) => header.findIndex((h) => names.includes(h));
  const nameCol = col(NAME_HEADERS);
  const lastCol = col(LAST_HEADERS);
  const firstCol = col(FIRST_HEADERS);
  const groupCol = col(GROUP_HEADERS);
  const cell = (r: Row, i: number) => (i < 0 ? '' : String(r[i] ?? '').replace(/\s+/g, ' ').trim());

  const entries: { name: string; group: string }[] = [];
  let skipped = 0;
  for (const r of rows.slice(headerIndex + 1)) {
    if (r.every((c) => String(c ?? '').trim() === '')) continue;
    let name = cell(r, nameCol);
    if (!name && lastCol >= 0) name = [cell(r, firstCol), cell(r, lastCol)].filter(Boolean).join(' ');
    if (!name) {
      skipped += 1;
      continue;
    }
    entries.push({ name, group: cell(r, groupCol) });
  }
  return { entries, skipped };
}

function cellText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    const v = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.text) return v.text;
    if (v.result != null) return String(v.result);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value);
}

export async function readRosterFile(file: File): Promise<RosterImport> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose a file smaller than 5 MB.');
  if (/\.csv$/i.test(file.name)) {
    const { default: Papa } = await import('papaparse');
    const parsed = Papa.parse<string[]>(await file.text(), { skipEmptyLines: 'greedy' });
    return parseRosterRows(parsed.data);
  }
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Choose a .csv or .xlsx file. Save older .xls files as .xlsx first.');
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets.find((s) => s.state === 'visible') ?? workbook.worksheets[0];
  if (!sheet) throw new Error('The file has no sheets.');
  const rows: Row[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    rows.push(values.map(cellText));
  });
  return parseRosterRows(rows);
}

export const ROSTER_TEMPLATE = 'Full Name,Group or Batch\r\nJuan Dela Cruz,Batch 1\r\nMaria Santos,Batch 1\r\n';
