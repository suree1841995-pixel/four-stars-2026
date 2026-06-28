/**
 * ============================================================
 *  FOUR STARS - ระบบจับคู่และคำนวณผล Math Week 2026
 *  โรงเรียนพูลเจริญวิทยาคม
 * ============================================================
 *  โครงสร้าง Google Sheet ที่ต้องมี:
 *  - แท็บ "Players"   : A=รหัส, B=ชื่อ-สกุล, C=ระดับ(มต้น/มปลาย), D=ห้อง
 *  - แท็บ "Games"     : เก็บผลทุกคู่ทุกเกม (สร้าง/จัดการให้อัตโนมัติ)
 *  - แท็บ "Standings" : ตารางอันดับ (คำนวณอัตโนมัติ ไม่ต้องกรอกมือ)
 *  - แท็บ "Finals"    : ผลรอบชิงชนะเลิศ (ที่ 1-2 และที่ 3-4)
 *  - แท็บ "TableAssignments" : เก็บการจัดโต๊ะของแต่ละเกม (ระบบสร้างให้)
 * ============================================================
 *  กติกาสรุป (ตามเอกสาร Four Stars Ver.15/5/2569 + กำหนดการ Math Week 2026):
 *  - แยกระดับชั้น มต้น / มปลาย อิสระจากกันทั้งหมด เดี่ยว 20 คนต่อสาย (ยืดหยุ่นได้)
 *  - 6 เกมรอบคัดเลือก: เกม1 Random, เกม2 ไขว้, เกม3 Swiss, เกม4 ไขว้, เกม5 Swiss, เกม6 King of the Hill
 *  - โต๊ะละ 4 คน (2 คู่ A/B) ถ้าเหลือไม่ครบ 4 ให้เป็นคู่เดี่ยว/bye
 *  - ใน 1 เกม แข่ง 3 รอบย่อย ใครชนะ 2 ใน 3 ถือว่าชนะเกมนั้น
 *    กรรมการกรอกแค่ "จำนวนรอบย่อยที่ชนะของแต่ละฝั่ง" (0-3, รวมกันต้อง=3) ไม่ต้องกรอกทีละรอบย่อย
 *  - แต้ม W=2,T=1,L=0 ; เรียงอันดับด้วยแต้มสะสม แล้วผลต่างสะสม (ผลต่าง = จำนวนรอบย่อยที่ชนะ-แพ้สะสม)
 *  - Gibsonize เกมสุดท้าย: ถ้าคะแนนลอยลำเข้ารอบชิงแน่นอนแล้ว ให้ไปรอแข่งรอบชิงได้เลย ไม่ต้องแข่งเกม 6
 *  - ชนะบาย +2 แต้มดิบ, แพ้บาย -2 แต้มดิบ (เกมนั้นถือว่า W/L ปกติ) -> กรอก roundsA=2,roundsB=0 (หรือกลับกัน)
 *  - 4 อันดับแรกเข้ารอบชิงชนะเลิศ: 1 vs 2 (ชิงที่ 1-2), 3 vs 4 (ชิงที่ 3-4) แข่ง 1 เกม (2 เกมย่อยผลัดกันเริ่ม)
 *  - Tie-breaker (รอบคัดเลือกและรอบชิง): 1.หาผล head-to-head 2.ถ้าไม่เคยแข่งกันดูผลรวมคะแนนสะสม 3.ถ้ายังเท่ากันต้องเล่นเพิ่ม (กรรมการตัดสิน)
 *  - เกียรติบัตร: อันดับ 1-3 ได้รางวัล+เกียรติบัตร, ที่เหลือทุกคนได้เกียรติบัตรเข้าร่วม
 * ============================================================
 *  หมายเหตุการอัปเดต (รอบนี้):
 *  - เก็บ "รหัส|ชื่อ" คู่กันใน TableAssignments เพื่อให้ admin/display โชว์ชื่อได้ทันทีไม่ต้อง join ซ้ำ
 *  - เพิ่ม fsNormalizeLevel() ใช้เทียบ/บันทึก level ทุกจุด กัน unicode/เคาะวรรคเพี้ยน
 *  - เพิ่มระบบ bye ครบ 2 รูปแบบ: bye เต็มโต๊ะ (เหลือ 1 คน) และ rightBye (เหลือ 3 คน ฝั่ง B ไม่มีคู่)
 *    ทั้งสองแบบ บันทึกผล W +2 ให้อัตโนมัติทันทีที่จัดโต๊ะ ไม่ต้องรอกรอกที่หน้า scoring
 *  - เพิ่ม fsIsGameComplete() บล็อกการจัดโต๊ะเกมถัดไปจนกว่าจะกรอกผลครบทุกโต๊ะ (bye นับว่าครบอัตโนมัติ)
 *  - เพิ่ม fsGetUnlockedGames() คำนวณสถานะปลดล็อกปุ่มเกม 1-6 ในคราวเดียว (ไม่ต้องเรียก 6 รอบ)
 *  - เพิ่ม fsGetTableMapForLevel() ส่งแผนผังโต๊ะทั้งหมดของระดับชั้นในคราวเดียว ให้หน้า scoring
 *    ทำ auto-fill แบบ client-side ทันที (0ms) ไม่ต้องยิง server ทุกตัวอักษรที่พิมพ์
 *  - เพิ่ม sheet-read cache ภายในรอบการทำงานเดียวกัน ลดการอ่านชีทซ้ำซ้อน
 * ============================================================
 */

const FS_LEVELS = ['มต้น', 'มปลาย'];

// แต้มผลต่างมาตรฐานสำหรับผู้เล่นที่ได้ bye (ไม่มีคู่แข่งจริงในเกมนั้น)
// ตามกติกา "ชนะบาย +2 แต้มดิบ" -> เทียบเท่ากรอก roundsA=2, roundsB=0 (ชนะเกม 2-0)
const FS_BYE_ROUNDS_WIN = 2;
const FS_BYE_ROUNDS_LOSE = 0;

/**
 * Normalize ค่าระดับชั้น (level) ก่อนเทียบ/บันทึก ป้องกันปัญหา:
 * - เคาะวรรค (space) เกินมาหน้า-หลัง หรือเคาะซ้ำตรงกลาง (เผื่อพิมพ์ "ม ต้น")
 * - Unicode normalize (NFC) กันกรณีพิมพ์สระ/วรรณยุกต์ผ่านคนละ input method
 *   ได้ตัวอักษรหน้าตาเหมือนกันแต่จริงๆ เป็นรหัส Unicode คนละชุด (เช่น combining mark
 *   แยกกับสระประสม) ทำให้ string เทียบกันไม่ตรงทั้งที่ตาเห็นเหมือนกันเป๊ะ
 * ใช้ฟังก์ชันนี้ทุกจุดที่ต้องเทียบหรือบันทึก level (ไม่ใช่แค่ตอนอ่าน Players อย่างเดียว)
 * เพื่อให้ "มต้น" ที่กรอกมาไม่ว่าจะมีช่องว่างแปลกๆ หรือ encoding ต่างกันแค่ไหน
 * ก็ map กลับมาเป็นค่ามาตรฐานเดียวกันเสมอ
 */
function fsNormalizeLevel(level) {
  let s = String(level == null ? '' : level);
  if (typeof s.normalize === 'function') s = s.normalize('NFC'); // รวม unicode รูปแบบเทียบเท่าให้เป็นชุดเดียว
  // ตัดทั้ง whitespace ปกติ (เคาะวรรค/แท็บ/ขึ้นบรรทัด) และอักขระที่มองไม่เห็น
  // (zero-width space/joiner, BOM) ที่มักแอบติดมาจากการ copy-paste โดยไม่รู้ตัว
  s = s.replace(/[\s\u200b\u200c\u200d\ufeff]+/g, '').trim();
  return s;
}

/* ===================== Routing ===================== */

function doGet(e) {
  const page = e.parameter.page;
  if (page === 'admin') return HtmlService.createHtmlOutputFromFile('admin').setTitle('Four Stars Admin');
  if (page === 'scoring') return HtmlService.createHtmlOutputFromFile('scoring').setTitle('Four Stars Scoring');
  if (page === 'display') return HtmlService.createHtmlOutputFromFile('display').setTitle('Four Stars Display');

  const action = e.parameter.action;
  if (action === 'fullState') {
    return fsJsonOut(fsGetFullState(fsNormalizeLevel(e.parameter.level || 'มต้น')));
  }
  return HtmlService.createHtmlOutputFromFile('admin').setTitle('Four Stars Admin');
}

function fsJsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function fsGetSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/* ===================== Cache การอ่านชีท (ใช้ภายใน execution เดียวกัน) ===================== */

// เก็บ raw values ของแต่ละชีทไว้ชั่วคราว เพื่อไม่ต้องเปิดอ่าน (getRange/getValues) ซ้ำหลายรอบ
// ภายในการทำงานครั้งเดียว (เช่น กดปุ่มจัดโต๊ะ 1 ครั้ง อาจมีหลายฟังก์ชันต้องใช้ข้อมูลชีทเดียวกัน)
// ตัวแปรนี้อยู่ใน global scope ของ Apps Script ซึ่ง "รีเซ็ตใหม่ทุกครั้ง" ที่เริ่ม execution ใหม่
// (Apps Script ไม่คงค่า global ข้าม request ปกติ) จึงไม่มีปัญหาข้อมูลค้างเก่าข้าม request
let _fsSheetCache = {};

/**
 * อ่าน raw values ทั้งชีท (ตั้งแต่แถว 2 เป็นต้นไป ข้าม header) แบบ cache ไว้ในรอบการทำงานนี้
 * ถ้าเคยอ่านชีทนี้ไปแล้วในรอบเดียวกัน จะคืนค่าที่ cache ไว้ทันที ไม่เปิดอ่านซ้ำ
 * numCols ต้องระบุให้ตรงกับจำนวนคอลัมน์ที่ต้องใช้ของชีทนั้น (เผื่อชีทมีคอลัมน์เกินที่ใช้งานจริง)
 */
function fsReadSheetCached(sheetName, numCols) {
  if (_fsSheetCache[sheetName]) return _fsSheetCache[sheetName];

  const sh = fsGetSS().getSheetByName(sheetName);
  const lastRow = sh.getLastRow();
  const data = lastRow < 2 ? [] : sh.getRange(2, 1, lastRow - 1, numCols).getValues();
  _fsSheetCache[sheetName] = data;
  return data;
}

/** ล้าง cache ของชีทหนึ่ง (เรียกหลังเขียน/ลบแถวในชีทนั้น เพื่อให้รอบอ่านถัดไปในรอบเดียวกันได้ข้อมูลล่าสุด) */
function fsInvalidateSheetCache(sheetName) {
  delete _fsSheetCache[sheetName];
}

/* ===================== Sheet setup ===================== */

function fsSetupSheets() {
  const ss = fsGetSS();

  let playersSh = ss.getSheetByName('Players');
  if (!playersSh) playersSh = ss.insertSheet('Players');
  playersSh.getRange(1, 1, 1, 4).setValues([['รหัส', 'ชื่อ-สกุล', 'ระดับ (มต้น/มปลาย)', 'ห้อง']]);
  playersSh.setFrozenRows(1);

  let gamesSh = ss.getSheetByName('Games');
  if (!gamesSh) gamesSh = ss.insertSheet('Games');
  gamesSh.getRange(1, 1, 1, 9).setValues([[
    'เกม', 'ระดับ', 'โต๊ะ', 'โต๊ะย่อย', 'รหัสนักกีฬาที่1', 'รอบย่อยที่ชนะ(1)', 'รหัสนักกีฬาที่2', 'รอบย่อยที่ชนะ(2)', 'บันทึกเมื่อ'
  ]]);
  gamesSh.setFrozenRows(1);

  let standSh = ss.getSheetByName('Standings');
  if (!standSh) standSh = ss.insertSheet('Standings');

  let finalsSh = ss.getSheetByName('Finals');
  if (!finalsSh) finalsSh = ss.insertSheet('Finals');
  finalsSh.getRange(1, 1, 1, 8).setValues([[
    'ระดับ', 'คู่ชิง', 'รหัสนักกีฬาที่1', 'รอบย่อยที่ชนะ(1)', 'รหัสนักกีฬาที่2', 'รอบย่อยที่ชนะ(2)', 'หมายเหตุ', 'บันทึกเมื่อ'
  ]]);
  finalsSh.setFrozenRows(1);

  let tableSh = ss.getSheetByName('TableAssignments');
  if (!tableSh) tableSh = ss.insertSheet('TableAssignments');
  tableSh.getRange(1, 1, 1, 6).setValues([[
    'เกม', 'ระดับ', 'โต๊ะ', 'คู่โต๊ะย่อย A (เช่น 1A)', 'คู่โต๊ะย่อย B (เช่น 1B)', 'หมายเหตุ'
  ]]);
  tableSh.setFrozenRows(1);
}

/* ===================== Players ===================== */

function fsGetPlayers(level) {
  const normLevel = fsNormalizeLevel(level);
  const data = fsReadSheetCached('Players', 4);
  return data
    .filter(r => String(r[0] || '').trim() && fsNormalizeLevel(r[2]) === normLevel)
    .map(r => ({ id: String(r[0]).trim(), name: r[1] || ('นักเรียนรหัส ' + r[0]), level: r[2], room: r[3] || '' }));
}

/* ===================== Games sheet read/write ===================== */

function fsGetGamesRaw(level) {
  const normLevel = fsNormalizeLevel(level);
  const data = fsReadSheetCached('Games', 9);
  return data
    .filter(r => fsNormalizeLevel(r[1]) === normLevel && r[0] !== '')
    .map(r => ({
      game: r[0], level: r[1], table: r[2], subTable: r[3],
      idA: String(r[4] || '').trim(), roundsA: r[5],
      idB: String(r[6] || '').trim(), roundsB: r[7],
      savedAt: r[8]
    }));
}

/**
 * บันทึกผลของคู่หนึ่ง (เรียกจาก scoring.html)
 * subTable คือรหัสโต๊ะย่อย เช่น "1A", "1B" (เลขโต๊ะ + A หรือ B)
 * roundsA/roundsB คือจำนวนรอบย่อยที่ชนะของแต่ละฝั่ง (0-3, ปกติรวมกัน=3)
 * กรณีชนะบาย/แพ้บาย ให้ใส่ roundsA=2,roundsB=0 (หรือกลับกัน) ตามกติกา +2/-2
 * ถ้ามีแถวเกม+โต๊ะย่อยนี้อยู่แล้ว จะอัปเดต "ทับ" ของเดิม ไม่สร้างซ้ำ (บันทึกซ้ำ = แก้ไขผลเดิม)
 */
function fsSaveMatchResult(level, game, subTable, idA, roundsA, idB, roundsB) {
  const normLevel = fsNormalizeLevel(level);
  const sh = fsGetSS().getSheetByName('Games');
  const lastRow = sh.getLastRow();

  const table = parseInt(String(subTable).replace(/[^0-9.]/g, ''), 10);

  let foundRow = -1;
  if (lastRow >= 2) {
    const data = sh.getRange(2, 1, lastRow - 1, 4).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(game) && fsNormalizeLevel(data[i][1]) === normLevel &&
          String(data[i][3]) === String(subTable)) {
        foundRow = i + 2;
        break;
      }
    }
  }

  const targetRow = foundRow === -1 ? lastRow + 1 : foundRow;
  const now = new Date();
  sh.getRange(targetRow, 1, 1, 9).setValues([[
    game, normLevel, table, subTable, idA, roundsA, idB, roundsB, now
  ]]);
  fsInvalidateSheetCache('Games'); // ล้าง cache เก่าทิ้ง เผื่อมีฟังก์ชันอื่นเรียก fsGetGamesRaw ต่อในรอบเดียวกัน
  return { ok: true };
}

/* ===================== คำนวณคะแนนเกมเดียว → W/T/L + diff ===================== */

/**
 * คำนวณผล W/T/L ของผู้เล่น A และ B ในแมตช์เดียว จากจำนวนรอบย่อยที่ชนะ
 * (รวมถึงกรณีชนะบาย/แพ้บายที่กรอกมาเป็น roundsA/roundsB ตรงๆ +2/-2 ตามกติกา)
 * คืนค่า {resultA, resultB, diffA, diffB}
 */
function fsComputeMatchResult(roundsA, roundsB) {
  const effA = (roundsA === '' || roundsA === null || roundsA === undefined) ? 0 : Number(roundsA);
  const effB = (roundsB === '' || roundsB === null || roundsB === undefined) ? 0 : Number(roundsB);

  let resultA, resultB;
  if (effA > effB) { resultA = 'W'; resultB = 'L'; }
  else if (effA < effB) { resultA = 'L'; resultB = 'W'; }
  else { resultA = 'T'; resultB = 'T'; }

  return {
    resultA, resultB,
    diffA: effA - effB, diffB: effB - effA
  };
}

/* ===================== Standings (ตารางอันดับ) ===================== */

/**
 * คำนวณตารางอันดับของระดับชั้นหนึ่ง จากทุกเกมที่กรอกมาแล้ว (รอบคัดเลือก เกม 1-6)
 * คืนค่า array ของผู้เล่น พร้อม points, diffSum, W/T/L, head-to-head map, จัดเรียงแล้ว
 */
function fsComputeStandings(level) {
  const normLevel = fsNormalizeLevel(level);
  const players = fsGetPlayers(normLevel);
  const games = fsGetGamesRaw(normLevel);

  let stat = {};
  players.forEach(p => {
    stat[p.id] = { id: p.id, name: p.name, room: p.room, points: 0, diffSum: 0, w: 0, t: 0, l: 0, gamesPlayed: 0, headToHead: {} };
  });

  games.forEach(g => {
    if (!g.idA || !g.idB) return; // แถว bye (idB ว่าง) จัดการแยกด้านล่าง
    const r = fsComputeMatchResult(g.roundsA, g.roundsB);

    if (stat[g.idA]) {
      stat[g.idA].diffSum += r.diffA;
      stat[g.idA].gamesPlayed++;
      stat[g.idA].headToHead[g.idB] = r.resultA; // เก็บผลเจอกันตรงไว้ใช้ตัดสิน tie
      if (r.resultA === 'W') { stat[g.idA].w++; stat[g.idA].points += 2; }
      else if (r.resultA === 'T') { stat[g.idA].t++; stat[g.idA].points += 1; }
      else { stat[g.idA].l++; }
    }
    if (stat[g.idB]) {
      stat[g.idB].diffSum += r.diffB;
      stat[g.idB].gamesPlayed++;
      stat[g.idB].headToHead[g.idA] = r.resultB;
      if (r.resultB === 'W') { stat[g.idB].w++; stat[g.idB].points += 2; }
      else if (r.resultB === 'T') { stat[g.idB].t++; stat[g.idB].points += 1; }
      else { stat[g.idB].l++; }
    }
  });

  // แถว bye (idB ว่าง = ไม่มีคู่แข่งจริง) -> ผู้เล่นฝั่ง A ได้ผลตามที่กรอกไว้ตรงๆ (ปกติ W +2 ตามกติกาบาย)
  games.forEach(g => {
    if (!g.idA || g.idB) return;
    if (!stat[g.idA]) return;
    const effA = (g.roundsA === '' || g.roundsA === null || g.roundsA === undefined) ? 0 : Number(g.roundsA);
    const effB = (g.roundsB === '' || g.roundsB === null || g.roundsB === undefined) ? 0 : Number(g.roundsB);
    stat[g.idA].diffSum += (effA - effB);
    stat[g.idA].gamesPlayed++;
    if (effA > effB) { stat[g.idA].w++; stat[g.idA].points += 2; }
    else if (effA < effB) { stat[g.idA].l++; }
    else { stat[g.idA].t++; stat[g.idA].points += 1; }
  });

  let list = Object.values(stat);
  list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.diffSum - a.diffSum;
  });

  list.forEach((s, i) => { s.rank = i + 1; });
  return list;
}

/* ===================== ตรวจสอบว่ากรอกผลครบทุกโต๊ะของเกมหนึ่งแล้วหรือยัง ===================== */

/**
 * หาเลขเกมล่าสุดที่จัดโต๊ะไปแล้วของระดับชั้นหนึ่ง (ดูจาก TableAssignments เท่านั้น เบากว่า fsGetFullState
 * เพราะไม่ต้องคำนวณ standings/parse คู่ทุกโต๊ะ) ใช้สำหรับ auto-select เกม + badge ในหน้า scoring.html
 * คืนค่า 0 ถ้ายังไม่มีการจัดโต๊ะเลยในระดับชั้นนั้น
 */
function fsGetLatestGame(level) {
  const normLevel = fsNormalizeLevel(level);
  const data = fsReadSheetCached('TableAssignments', 6);
  let latestGame = 0;
  data.forEach(r => {
    if (fsNormalizeLevel(r[1]) === normLevel && Number(r[0]) > latestGame) latestGame = Number(r[0]);
  });
  return latestGame;
}

/**
 * ตรวจว่าเกมหนึ่ง (ของระดับชั้นหนึ่ง) กรอกผลครบทุกโต๊ะที่มีคู่แข่งจริงแล้วหรือยัง
 * - โต๊ะ/ฝั่งที่เป็น "bye" (ไม่มีคู่เล่นในเกมนั้น) ไม่ต้องกรอกอะไรเพิ่ม ถือว่าสมบูรณ์อัตโนมัติ ข้ามไปเลย
 *   (ระบบเขียนผล W+2 ให้อัตโนมัติตั้งแต่ตอนจัดโต๊ะแล้ว — ดู fsSaveTableAssignments)
 * - โต๊ะที่มีคู่ A (และคู่ B ถ้ามี) ต้องมีแถวผลใน Games ที่กรอกครบทั้งสองฝั่งแล้ว (ไม่ใช่ค่าว่าง)
 *   ถึงจะถือว่าโต๊ะนั้น "ครบ"
 * - ถ้าเกมนั้นยังไม่มีการจัดโต๊ะเลย (ไม่เจอใน TableAssignments) ถือว่า "ยังไม่ครบ"
 * คืนค่า { complete: boolean, missing: [รายชื่อโต๊ะย่อยที่ยังไม่กรอก] }
 */
function fsIsGameComplete(level, game) {
  const normLevel = fsNormalizeLevel(level);
  const data = fsReadSheetCached('TableAssignments', 6);
  if (data.length === 0) return { complete: false, missing: ['ยังไม่มีการจัดโต๊ะเกมนี้'] };

  const gameRows = data.filter(r => String(r[0]) === String(game) && fsNormalizeLevel(r[1]) === normLevel);
  if (gameRows.length === 0) {
    return { complete: false, missing: ['ยังไม่มีการจัดโต๊ะเกมนี้'] };
  }

  const games = fsGetGamesRaw(normLevel).filter(g => String(g.game) === String(game));

  function subTableFilled(tableNum, suffix) {
    const row = games.find(g => Number(g.table) === Number(tableNum) && String(g.subTable).slice(-1) === suffix);
    if (!row) return false;
    return row.roundsA !== '' && row.roundsA !== null && row.roundsA !== undefined &&
           row.roundsB !== '' && row.roundsB !== null && row.roundsB !== undefined;
  }

  let missing = [];
  gameRows.forEach(r => {
    const tableNum = r[2];
    const leftRaw = r[3], rightRaw = r[4];
    const note = r[5] || '';

    // เคสทั้งโต๊ะ bye (เศษ 1 คนพอดี): left เป็น token เดี่ยว, right ว่างเปล่า -> ไม่มีอะไรต้องกรอก ข้ามทั้งแถว
    const leftIsSingleToken = leftRaw && String(leftRaw).indexOf(' vs ') === -1;
    if (note.indexOf('bye') !== -1 && !rightRaw && leftIsSingleToken) return;

    // ฝั่ง A: ถ้าเป็นคู่จริง ("tokA vs tokB") ต้องเช็คว่ากรอกผลครบหรือยัง
    if (leftRaw && !leftIsSingleToken) {
      if (!subTableFilled(tableNum, 'A')) missing.push(tableNum + 'A');
    }

    // ฝั่ง B: ถ้าเป็นคู่จริง ต้องเช็คครบ / ถ้าเป็น token เดี่ยว (rightBye) ไม่ต้องกรอก ข้ามไปเลย (กรอกอัตโนมัติแล้ว)
    const rightIsSingleToken = rightRaw && String(rightRaw).indexOf(' vs ') === -1;
    if (rightRaw && !rightIsSingleToken) {
      if (!subTableFilled(tableNum, 'B')) missing.push(tableNum + 'B');
    }
  });

  return { complete: missing.length === 0, missing };
}

/**
 * คำนวณสถานะปลดล็อกของปุ่มเกม 1-6 ทั้งหมดในการเรียกครั้งเดียว (ดีกว่าเรียก fsIsGameComplete 6 รอบ
 * เพราะอ่านชีท TableAssignments/Games ผ่าน cache ร่วมกันแค่ครั้งเดียวในรอบนี้)
 * - unlocked(1) = true เสมอ (เกมแรกไม่มีเงื่อนไขก่อนหน้า)
 * - unlocked(N) = เกม N-1 กรอกผลครบทุกโต๊ะแล้ว (สำหรับ N = 2..6)
 * - done(N) = เกม N มีการจัดโต๊ะไปแล้ว (ปุ่มควรโชว์ติ๊กว่าทำแล้ว แต่ไม่ได้แปลว่ากรอกผลครบ)
 * คืนค่า array: [{ game, unlocked, done, missing }, ...] และ unlockedFinals (กรอกเกม 6 ครบหรือยัง)
 */
function fsGetUnlockedGames(level) {
  const normLevel = fsNormalizeLevel(level);
  let result = [];
  let prevComplete = { complete: true, missing: [] }; // เกม 1 ไม่มีเงื่อนไขก่อนหน้า

  for (let g = 1; g <= 6; g++) {
    const tableData = fsReadSheetCached('TableAssignments', 6);
    const done = tableData.some(r => String(r[0]) === String(g) && fsNormalizeLevel(r[1]) === normLevel);
    const unlocked = (g === 1) ? true : prevComplete.complete;
    const thisComplete = fsIsGameComplete(normLevel, g);

    result.push({ game: g, unlocked, done, missing: thisComplete.missing });
    prevComplete = thisComplete;
  }

  return { games: result, unlockedFinals: prevComplete.complete };
}

/* ===================== จัดโต๊ะ: เกม 1 (Random) ===================== */

function fsShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * สร้างการจัดโต๊ะเกม 1: สุ่ม 4 คนต่อโต๊ะ (2 คู่ A/B)
 * คนเหลือไม่ครบ 4 → จัดเป็น bye ตามจำนวนที่เหลือ (ดู fsSplitIntoTables)
 */
function fsGenerateGame1Tables(level) {
  const players = fsGetPlayers(level);
  const shuffled = fsShuffle(players);
  return fsSplitIntoTables(shuffled);
}

/**
 * แบ่ง array ผู้เล่น (เรียงมาแล้วตามต้องการ) ออกเป็นโต๊ะละ 4 คน (2 คู่ ซ้าย=A ขวา=B)
 * เศษที่ไม่ครบ 4 คน:
 * - เหลือ 3 คน: คู่แรกเป็นฝั่ง A ตามปกติ คนที่ 3 ไม่มีคู่ฝั่ง B ให้จับ -> ใส่เป็น "rightBye" ของโต๊ะเดียวกัน
 *   (ฝั่ง B ของโต๊ะนั้นได้ bye แทนที่จะแยกเป็นโต๊ะใหม่)
 * - เหลือ 2 คน: เป็นคู่เดี่ยว (โต๊ะมีแค่ฝั่ง A ไม่มีฝั่ง B)
 * - เหลือ 1 คน: ได้ bye เต็มโต๊ะ (ไม่มีคู่แข่งเลยในเกมนี้)
 */
function fsSplitIntoTables(orderedPlayers) {
  let tables = [];
  let tableNum = 1;
  for (let i = 0; i < orderedPlayers.length; i += 4) {
    const group = orderedPlayers.slice(i, i + 4);
    if (group.length === 4) {
      tables.push({
        table: tableNum,
        left: { idA: group[0].id, nameA: group[0].name, idB: group[1].id, nameB: group[1].name },
        right: { idA: group[2].id, nameA: group[2].name, idB: group[3].id, nameB: group[3].name },
        note: ''
      });
    } else if (group.length === 2) {
      tables.push({
        table: tableNum,
        left: { idA: group[0].id, nameA: group[0].name, idB: group[1].id, nameB: group[1].name },
        right: null,
        note: 'โต๊ะคู่เดี่ยว (ผู้เล่นไม่ครบ 4 คน)'
      });
    } else if (group.length === 3) {
      tables.push({
        table: tableNum,
        left: { idA: group[0].id, nameA: group[0].name, idB: group[1].id, nameB: group[1].name },
        right: null,
        rightBye: { id: group[2].id, name: group[2].name },
        note: 'ฝั่ง B ไม่มีคู่ ได้ bye'
      });
    } else if (group.length === 1) {
      tables.push({
        table: tableNum,
        left: null, right: null,
        bye: { id: group[0].id, name: group[0].name },
        note: 'ผู้เล่นได้ bye (ไม่มีคู่ในเกมนี้)'
      });
    }
    tableNum++;
  }
  return tables;
}

/**
 * บันทึกการจัดโต๊ะลง TableAssignments sheet
 * เก็บชื่อนักเรียนคู่กับรหัสในชีทด้วย รูปแบบ "รหัส|ชื่อ vs รหัส|ชื่อ" เพื่อให้หน้า admin/display
 * แสดงชื่อได้ทันทีโดยไม่ต้อง join กับ Players sheet ซ้ำทุกครั้งที่อ่าน
 * กรณี rightBye (ฝั่ง B ไม่มีคู่ ในโต๊ะที่ฝั่ง A เป็นคู่จริง): เก็บ token เดี่ยวไว้ในคอลัมน์ right
 * แทน "tokA vs tokB" ปกติ เพื่อให้ parser ฝั่งอ่าน (fsGetFullState ฯลฯ) แยกแยะออกจากคู่ปกติได้
 */
function fsSaveTableAssignments(level, game, tables) {
  const normLevel = fsNormalizeLevel(level);
  const sh = fsGetSS().getSheetByName('TableAssignments');
  const lastRow = sh.getLastRow();

  // ลบของเดิมที่เป็นเกม+ระดับเดียวกันก่อน (ถ้ามี) เพื่อไม่ให้ซ้ำ — กดจัดโต๊ะซ้ำ = แทนที่ของเดิม
  if (lastRow >= 2) {
    const data = sh.getRange(2, 1, lastRow - 1, 2).getValues();
    let rowsToDelete = [];
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(game) && fsNormalizeLevel(data[i][1]) === normLevel) rowsToDelete.push(i + 2);
    }
    rowsToDelete.sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
  }

  const rows = tables.map(t => {
    if (t.bye) {
      return [game, normLevel, t.table, t.bye.id + '|' + (t.bye.name || ''), '', t.note];
    }
    const leftStr = t.left ? (t.left.idA + '|' + (t.left.nameA || '') + ' vs ' + t.left.idB + '|' + (t.left.nameB || '')) : '';
    const rightStr = t.right ? (t.right.idA + '|' + (t.right.nameA || '') + ' vs ' + t.right.idB + '|' + (t.right.nameB || '')) :
                     (t.rightBye ? (t.rightBye.id + '|' + (t.rightBye.name || '')) : '');
    return [game, normLevel, t.table, leftStr, rightStr, t.note];
  });

  if (rows.length > 0) {
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, rows.length, 6).setValues(rows);
  }
  fsInvalidateSheetCache('TableAssignments'); // เพิ่งเขียน/ลบแถวไป ต้องล้าง cache เก่าทิ้ง

  // เขียนผล bye ลง Games sheet ให้อัตโนมัติทันที (ไม่ต้องรอกรอกผ่านหน้า scoring)
  // เพราะกฎ +2/-2 เป็นค่าตายตัว ไม่มีอะไรต้องตัดสินใจ — ผู้เล่นที่ได้ bye ในเกมนี้ได้ผล W (2-0) เลย
  // ครอบคลุมทั้ง 2 รูปแบบ: t.bye (ทั้งโต๊ะได้ bye, ใช้ subTable "<table>A")
  // และ t.rightBye (เฉพาะฝั่ง B ได้ bye ในโต๊ะที่ฝั่ง A เป็นคู่จริง, ใช้ subTable "<table>B")
  const byeEntries = [];
  tables.forEach(t => {
    if (t.bye) byeEntries.push({ table: t.table, suffix: 'A', player: t.bye });
    if (t.rightBye) byeEntries.push({ table: t.table, suffix: 'B', player: t.rightBye });
  });

  if (byeEntries.length > 0) {
    const gamesSh = fsGetSS().getSheetByName('Games');
    const gLastRow = gamesSh.getLastRow();

    // ลบแถวผล bye เดิมของเกม+ระดับนี้ก่อน (เผื่อมีการจัดโต๊ะซ้ำทับเกมเดิม จะได้ไม่ซ้ำแถว)
    // จับด้วย idB ว่าง + game + level ตรงกัน เพื่อไม่ไปลบแถวคู่ปกติที่กรอกไว้แล้วโดยไม่ตั้งใจ
    if (gLastRow >= 2) {
      const gData = gamesSh.getRange(2, 1, gLastRow - 1, 9).getValues();
      let gRowsToDelete = [];
      for (let i = 0; i < gData.length; i++) {
        const rowIsBye = String(gData[i][6] || '').trim() === '';
        if (String(gData[i][0]) === String(game) && fsNormalizeLevel(gData[i][1]) === normLevel && rowIsBye) {
          gRowsToDelete.push(i + 2);
        }
      }
      gRowsToDelete.sort((a, b) => b - a).forEach(r => gamesSh.deleteRow(r));
    }

    const now = new Date();
    const byeRows = byeEntries.map(e => [
      game, normLevel, e.table, e.table + e.suffix, e.player.id, FS_BYE_ROUNDS_WIN, '', FS_BYE_ROUNDS_LOSE, now
    ]);
    const gStartRow = gamesSh.getLastRow() + 1;
    gamesSh.getRange(gStartRow, 1, byeRows.length, 9).setValues(byeRows);
    fsInvalidateSheetCache('Games');
  }

  return { ok: true };
}

/* ===================== เกม 2 และ 4: ไขว้ในโต๊ะเดิม ===================== */

/**
 * สร้างการจับคู่เกมไขว้ จากผลเกมก่อนหน้าของโต๊ะเดิม
 * ไขว้: ผู้ชนะฝั่ง A เจอผู้ชนะฝั่ง B, ผู้แพ้เจอผู้แพ้ (เสมอจับกับเสมอถ้ามี ไม่งั้นจับตามลำดับเดิม)
 * โต๊ะคู่เดี่ยว -> รีแมตช์เดิม
 * บล็อกการจัดโต๊ะถ้ายังกรอกผลเกมก่อนหน้าไม่ครบ (ไม่งั้นหาผู้ชนะ/ผู้แพ้ผิดทันที)
 */
function fsGenerateCrossoverTables(level, previousGame) {
  const normLevel = fsNormalizeLevel(level);

  const check = fsIsGameComplete(normLevel, previousGame);
  if (!check.complete) {
    throw new Error('กรอกผลเกม ' + previousGame + ' ยังไม่ครบ (เหลือโต๊ะ: ' + check.missing.join(', ') + ') กรุณากรอกผลให้ครบก่อนจัดโต๊ะเกมถัดไป');
  }

  const data = fsReadSheetCached('TableAssignments', 6);
  const prevTables = data.filter(r => String(r[0]) === String(previousGame) && fsNormalizeLevel(r[1]) === normLevel);

  const prevGames = fsGetGamesRaw(normLevel).filter(g => String(g.game) === String(previousGame));

  // lookup รหัส -> ชื่อปัจจุบันจาก Players เพื่อเติมชื่อกลับเข้าไปในทุกคู่ที่สร้างใหม่
  // (กันกรณีชื่อใน Players ถูกแก้ทีหลัง จะได้ใช้ชื่อล่าสุดเสมอ)
  const playersMap = {};
  fsGetPlayers(normLevel).forEach(p => { playersMap[p.id] = p.name; });
  function nameOf(id) { return playersMap[id] || ''; }

  function parseIdName(token) {
    const parts = String(token).split('|');
    const id = parts[0];
    return { id, name: nameOf(id) || parts[1] || '' };
  }

  let newTables = [];
  prevTables.forEach(row => {
    const tableNum = row[2];
    const leftStr = row[3];
    const rightStr = row[4];
    const note = row[5];

    if (note && note.indexOf('bye') !== -1 && !rightStr) {
      // เคสทั้งโต๊ะ bye (เศษ 1 คนพอดีจากรอบก่อน) -> ส่งต่อ bye อีกครั้งไปก่อน
      const byePlayer = parseIdName(leftStr);
      newTables.push({ table: tableNum, left: null, right: null, bye: { id: byePlayer.id, name: byePlayer.name }, note: 'ผู้เล่นได้ bye (ไม่มีคู่ในเกมนี้)' });
      return;
    }

    // เคส rightBye (เศษ 3 คนจากรอบก่อน): left เป็นคู่จริง, right เป็น token เดี่ยว (ไม่มี ' vs ')
    const rightIsSingleToken = rightStr && String(rightStr).indexOf(' vs ') === -1;
    if (rightIsSingleToken) {
      const [tokA, tokB] = leftStr.split(' vs ');
      const a = parseIdName(tokA), b = parseIdName(tokB);
      const byePlayer = parseIdName(rightStr);
      newTables.push({
        table: tableNum,
        left: { idA: a.id, nameA: a.name, idB: b.id, nameB: b.name },
        right: null,
        rightBye: { id: byePlayer.id, name: byePlayer.name },
        note: 'ฝั่ง A รีแมตช์เดิม (ไม่มีคู่ให้ไขว้) / ฝั่ง B ได้ bye ต่อเนื่อง'
      });
      return;
    }

    if (!rightStr) {
      // โต๊ะคู่เดี่ยว -> รีแมตช์เดิม
      const [tokA, tokB] = leftStr.split(' vs ');
      const a = parseIdName(tokA), b = parseIdName(tokB);
      newTables.push({
        table: tableNum,
        left: { idA: a.id, nameA: a.name, idB: b.id, nameB: b.name },
        right: null,
        note: 'โต๊ะคู่เดี่ยว (รีแมตช์ เนื่องจากไม่มีคู่ให้ไขว้)'
      });
      return;
    }

    const leftA_B = leftStr.split(' vs ');
    const leftA = parseIdName(leftA_B[0]).id, leftB = parseIdName(leftA_B[1]).id;
    const rightA_B = rightStr.split(' vs ');
    const rightA = parseIdName(rightA_B[0]).id, rightB = parseIdName(rightA_B[1]).id;

    const tableGames = prevGames.filter(g => Number(g.table) === Number(tableNum));
    const leftGame = tableGames.find(g => String(g.subTable).slice(-1) === 'A');
    const rightGame = tableGames.find(g => String(g.subTable).slice(-1) === 'B');

    let leftWinner = leftA, leftLoser = leftB, leftTie = false;
    if (leftGame) {
      const r = fsComputeMatchResult(leftGame.roundsA, leftGame.roundsB);
      if (r.resultA === 'W') { leftWinner = leftGame.idA; leftLoser = leftGame.idB; }
      else if (r.resultB === 'W') { leftWinner = leftGame.idB; leftLoser = leftGame.idA; }
      else { leftTie = true; }
    }

    let rightWinner = rightA, rightLoser = rightB, rightTie = false;
    if (rightGame) {
      const r = fsComputeMatchResult(rightGame.roundsA, rightGame.roundsB);
      if (r.resultA === 'W') { rightWinner = rightGame.idA; rightLoser = rightGame.idB; }
      else if (r.resultB === 'W') { rightWinner = rightGame.idB; rightLoser = rightGame.idA; }
      else { rightTie = true; }
    }

    newTables.push({
      table: tableNum,
      left: { idA: leftWinner, nameA: nameOf(leftWinner), idB: rightWinner, nameB: nameOf(rightWinner) },
      right: { idA: leftLoser, nameA: nameOf(leftLoser), idB: rightLoser, nameB: nameOf(rightLoser) },
      note: (leftTie || rightTie) ? 'มีผลเสมอในเกมก่อนหน้า จับคู่ตามลำดับที่มี' : ''
    });
  });

  return newTables;
}

/* ===================== เกม 3 และ 5: Swiss จัดโต๊ะใหม่ทั้งสาย ===================== */

/**
 * จัดโต๊ะใหม่ตาม Swiss pairing: เรียงตามแต้มสะสม (มากไปน้อย) แล้วผลต่างสะสม (มากไปน้อย) เป็นเกณฑ์รอง
 * ผู้เล่นที่ทั้งแต้มและผลต่างเท่ากันเป๊ะ ถึงจะใช้การสุ่มเป็นเกณฑ์สุดท้าย
 * thisGameNum ใช้บอกว่ากำลังจัดเกมไหน (3 หรือ 5) เพื่อเช็คว่ากรอกผลเกมก่อนหน้าครบหมดหรือยัง
 * (เกม 3 ต้องกรอกเกม 1-2 ครบ, เกม 5 ต้องกรอกเกม 1-4 ครบ) ไม่งั้น standings ที่ใช้จัดโต๊ะจะผิด
 */
function fsGenerateSwissTables(level, thisGameNum) {
  const normLevel = fsNormalizeLevel(level);

  for (let g = 1; g < thisGameNum; g++) {
    const check = fsIsGameComplete(normLevel, g);
    if (!check.complete) {
      throw new Error('กรอกผลเกม ' + g + ' ยังไม่ครบ (เหลือโต๊ะ: ' + check.missing.join(', ') + ') กรุณากรอกผลให้ครบก่อนจัดโต๊ะเกม ' + thisGameNum);
    }
  }

  const standings = fsComputeStandings(normLevel);

  let groups = {};
  standings.forEach(s => {
    const key = s.points;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  let ordered = [];
  Object.keys(groups).sort((a, b) => b - a).forEach(key => {
    const group = groups[key];

    let diffSubGroups = {};
    group.forEach(s => {
      const diffKey = s.diffSum;
      if (!diffSubGroups[diffKey]) diffSubGroups[diffKey] = [];
      diffSubGroups[diffKey].push(s);
    });

    Object.keys(diffSubGroups).sort((a, b) => b - a).forEach(diffKey => {
      ordered = ordered.concat(fsShuffle(diffSubGroups[diffKey]));
    });
  });

  const orderedAsPlayers = ordered.map(s => ({ id: s.id, name: s.name }));
  return fsSplitIntoTables(orderedAsPlayers);
}

/* ===================== Gibsonize: แนะนำอัตโนมัติ (เกม 6 เท่านั้น) ===================== */

/**
 * คำนวณแนะนำว่าใครควรถูก Gibsonize (คะแนนลอยลำเข้ารอบชิงแน่นอนแล้ว ไม่ต้องแข่งเกม 6)
 * หลักการ: คนอันดับ N (1-4) ปลอดภัยแน่นอน ถ้า "แต้มปัจจุบันของตัวเอง" (สมมติแพ้เกม6 = +0)
 *          ยังมากกว่า "แต้มสูงสุดที่เป็นไปได้ของคนอันดับ 5" (สมมติชนะเกม6 = +2)
 * เช็คแค่จุดตัดระหว่างอันดับ 4 กับอันดับ 5 พอ เพราะถ้าอันดับ 5 ไล่อันดับ 4 ไม่ทัน
 * ก็ไล่อันดับ 1-3 (ที่แต้ม >= อันดับ 4) ไม่ทันโดยอัตโนมัติเช่นกัน
 * คืนค่า { suggested: [{id,name,rank,points,reason}], hasEnoughPlayers: bool }
 * นี่เป็นแค่ "คำแนะนำ" — กรรมการต้องตรวจทานและยืนยันก่อนใช้จริงเสมอ ไม่ auto-apply
 */
function fsSuggestGibsonize(level) {
  const standings = fsComputeStandings(level);
  if (standings.length < 5) {
    return { suggested: [], hasEnoughPlayers: false, note: 'มีผู้เล่นไม่ถึง 5 คน ไม่ต้องคำนวณ Gibsonize' };
  }

  const WIN_POINTS = 2; // ตามกติกา W=2,T=1,L=0
  const fifthPlacePoints = standings[4].points; // อันดับ 5 (index 4)
  const maxPossibleForFifth = fifthPlacePoints + WIN_POINTS;

  let suggested = [];
  for (let i = 0; i < 4 && i < standings.length; i++) {
    const candidate = standings[i];
    const worstCaseForCandidate = candidate.points;
    if (worstCaseForCandidate > maxPossibleForFifth) {
      suggested.push({
        id: candidate.id,
        name: candidate.name,
        rank: candidate.rank,
        points: candidate.points,
        reason: `แม้แพ้เกม 6 (คงที่ ${candidate.points} แต้ม) ก็ยังมากกว่าแต้มสูงสุดที่อันดับ 5 ทำได้ (${fifthPlacePoints}+${WIN_POINTS}=${maxPossibleForFifth} แต้ม)`
      });
    }
  }

  return { suggested, hasEnoughPlayers: true, fifthPlacePoints, maxPossibleForFifth };
}

/* ===================== เกม 6: King of the Hill ===================== */

/**
 * King of the Hill: เรียงลำดับคนทั้งสายใหม่ (เหมือน Swiss) แล้วจับ "อันดับติดกัน" เป็นโต๊ะเดียวกัน
 * ต่างจาก Swiss ตรงที่ไม่ได้ไขว้แค่ในโต๊ะเดิม แต่จัดภาพรวมทั้งสายใหม่ทุกครั้งเพื่อความแม่นยำสูงสุด
 * ก่อนจัด ระบบจะแนะนำ Gibsonize ให้อัตโนมัติผ่าน fsSuggestGibsonize() แต่กรรมการต้องตรวจทาน
 * และยืนยันเองก่อนส่ง gibsonizedIds เข้าฟังก์ชันนี้ (ไม่ auto-apply ให้ทันที)
 * (ใส่ gibsonizedIds เป็น array ของรหัสที่ไม่ต้องแข่ง ถ้าไม่มีใคร Gibsonize ส่ง [] ธรรมดา)
 * บล็อกการจัดโต๊ะถ้ายังกรอกผลเกม 1-5 ไม่ครบ เพราะ standings ที่ใช้จัดอันดับจะผิด
 */
function fsGenerateKingOfHillTables(level, gibsonizedIds) {
  const normLevel = fsNormalizeLevel(level);

  for (let g = 1; g <= 5; g++) {
    const check = fsIsGameComplete(normLevel, g);
    if (!check.complete) {
      throw new Error('กรอกผลเกม ' + g + ' ยังไม่ครบ (เหลือโต๊ะ: ' + check.missing.join(', ') + ') กรุณากรอกผลรอบคัดเลือกให้ครบ 1-5 ก่อนจัดโต๊ะเกม 6');
    }
  }

  const standings = fsComputeStandings(normLevel);
  const excluded = new Set((gibsonizedIds || []).map(String));

  const eligible = standings.filter(s => !excluded.has(s.id));

  let groups = {};
  eligible.forEach(s => {
    const key = s.points;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  let ordered = [];
  Object.keys(groups).sort((a, b) => b - a).forEach(key => {
    const group = groups[key];
    let diffSubGroups = {};
    group.forEach(s => {
      const diffKey = s.diffSum;
      if (!diffSubGroups[diffKey]) diffSubGroups[diffKey] = [];
      diffSubGroups[diffKey].push(s);
    });
    Object.keys(diffSubGroups).sort((a, b) => b - a).forEach(diffKey => {
      ordered = ordered.concat(fsShuffle(diffSubGroups[diffKey]));
    });
  });

  const orderedAsPlayers = ordered.map(s => ({ id: s.id, name: s.name }));
  return fsSplitIntoTables(orderedAsPlayers);
}

/* ===================== Tie-breaker สำหรับอันดับ 1-4 ก่อนเข้ารอบชิง ===================== */

/**
 * เช็คว่าอันดับที่ติดกัน (เช่น 4 vs 5) เสมอกันจริงไหม (แต้ม+ผลต่างเท่ากันเป๊ะ)
 * ถ้าเสมอ ให้ใช้ tie-breaker ตามลำดับ: head-to-head -> (เท่ากันแล้วเพราะคำนวณจากคะแนนสะสมไปแล้ว) -> ต้องเล่นเพิ่ม
 * คืนค่า { needsPlayoff: bool, reason, candidateIds: [...] } ถ้า needsPlayoff=true ให้กรรมการจัดการแข่งเพิ่มเอง
 */
function fsCheckTieAtCutoff(level, cutoffRank) {
  const standings = fsComputeStandings(level);
  if (standings.length <= cutoffRank) return { needsPlayoff: false };

  const atCutoff = standings[cutoffRank - 1]; // คนสุดท้ายที่ "เข้า" (เช่น อันดับ 4)
  const justBelow = standings[cutoffRank];    // คนแรกที่ "ตกรอบ" (เช่น อันดับ 5)

  if (atCutoff.points !== justBelow.points || atCutoff.diffSum !== justBelow.diffSum) {
    return { needsPlayoff: false }; // ไม่เสมอกัน ไม่มีปัญหา
  }

  const games = fsGetGamesRaw(level);
  const everPlayed = games.some(g =>
    (g.idA === atCutoff.id && g.idB === justBelow.id) ||
    (g.idA === justBelow.id && g.idB === atCutoff.id)
  );

  if (everPlayed) {
    return { needsPlayoff: false, note: 'เคยแข่งกันแล้ว ใช้ผล head-to-head ตัดสินอัตโนมัติ (ดูจาก headToHead ใน standings)' };
  }

  return {
    needsPlayoff: true,
    reason: `อันดับ ${cutoffRank} (${atCutoff.name}) และอันดับ ${cutoffRank + 1} (${justBelow.name}) คะแนนเท่ากันเป๊ะ และไม่เคยแข่งกันมาก่อน ต้องให้เล่นเพิ่ม 1 เกมเพื่อตัดสิน`,
    candidateIds: [atCutoff.id, justBelow.id]
  };
}

/* ===================== Finals (รอบชิงชนะเลิศ: ที่ 1-2 และที่ 3-4) ===================== */

/**
 * สร้างคู่ชิงจาก 4 อันดับแรกของ standings: 1 vs 2 (ชิงที่ 1-2), 3 vs 4 (ชิงที่ 3-4)
 * บล็อกการสร้างคู่ชิงถ้ายังกรอกผลรอบคัดเลือกไม่ครบทั้ง 6 เกม (อันดับ 1-4 ที่ใช้จัดคู่อาจยังไม่นิ่ง)
 * หมายเหตุ: ผู้เล่นที่ถูก Gibsonize ในเกม 6 จะไม่ถูกนับว่า "ขาด" เพราะไม่ได้ถูกจัดที่นั่งในเกม 6 เลย
 * (fsIsGameComplete เช็คจาก TableAssignments ของเกม 6 อยู่แล้ว ซึ่งไม่มีชื่อคนที่ Gibsonize)
 */
function fsGenerateFinals(level) {
  const normLevel = fsNormalizeLevel(level);

  const check = fsIsGameComplete(normLevel, 6);
  if (!check.complete) {
    throw new Error('กรอกผลเกม 6 ยังไม่ครบ (เหลือโต๊ะ: ' + check.missing.join(', ') + ') กรุณากรอกผลรอบคัดเลือกให้ครบทั้ง 6 เกมก่อนสร้างคู่ชิงชนะเลิศ');
  }

  const standings = fsComputeStandings(normLevel);
  const top4 = standings.slice(0, 4);
  if (top4.length < 4) throw new Error('ผู้เล่นในระดับนี้ไม่ครบ 4 คนสำหรับเข้ารอบชิงชนะเลิศ');

  const sh = fsGetSS().getSheetByName('Finals');
  const rows = [
    [normLevel, 'ชิงที่ 1-2', top4[0].id, '', top4[1].id, '', '', ''],
    [normLevel, 'ชิงที่ 3-4', top4[2].id, '', top4[3].id, '', '', '']
  ];
  const startRow = sh.getLastRow() + 1;
  sh.getRange(startRow, 1, rows.length, 8).setValues(rows);
  fsInvalidateSheetCache('Finals');
  return { ok: true, pairs: [
    { pairLabel: 'ชิงที่ 1-2', idA: top4[0].id, nameA: top4[0].name, idB: top4[1].id, nameB: top4[1].name },
    { pairLabel: 'ชิงที่ 3-4', idA: top4[2].id, nameA: top4[2].name, idB: top4[3].id, nameB: top4[3].name }
  ]};
}

/** บันทึกผลรอบชิง (ใช้จำนวนรอบย่อยที่ชนะเหมือนรอบคัดเลือก เพราะ 1 เกม = 2 เกมย่อยผลัดกันเริ่ม)
 *  บันทึกซ้ำอีกรอบ = ทับผลเดิม (เหมือน fsSaveMatchResult) */
function fsSaveFinalResult(level, pairLabel, idA, roundsA, idB, roundsB) {
  const normLevel = fsNormalizeLevel(level);
  const sh = fsGetSS().getSheetByName('Finals');
  const lastRow = sh.getLastRow();

  let foundRow = -1;
  if (lastRow >= 2) {
    const data = sh.getRange(2, 1, lastRow - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (fsNormalizeLevel(data[i][0]) === normLevel && String(data[i][1]) === pairLabel) {
        foundRow = i + 2;
        break;
      }
    }
  }

  const targetRow = foundRow === -1 ? lastRow + 1 : foundRow;
  const now = new Date();
  sh.getRange(targetRow, 1, 1, 8).setValues([[
    normLevel, pairLabel, idA, roundsA, idB, roundsB, '', now
  ]]);
  fsInvalidateSheetCache('Finals');
  return { ok: true };
}

/* ===================== สรุปผลรางวัล (อันดับ 1-3 + เกียรติบัตรเข้าร่วมทุกคน) ===================== */

/**
 * สรุปผลรางวัลของระดับชั้นหนึ่ง ตามเกณฑ์ PDF Four Stars ข้อ 9:
 * "นักเรียนที่ได้อันดับ 1-3 ได้รับของรางวัล พร้อมเกียรติบัตร และผู้ที่ไม่ได้อันดับที่ 1-3
 *  จะได้รับเกียรติบัตรในการเข้าร่วมการแข่งขัน" (ทุกคน ไม่มีเกณฑ์ร้อยละ 60 แบบ Goldfinger)
 * - อันดับ 1, 2 มาจากผลคู่ "ชิงที่ 1-2"
 * - อันดับ 3 มาจากผลคู่ "ชิงที่ 3-4" (ผู้ชนะคู่นี้ได้อันดับ 3 ส่วนผู้แพ้ได้อันดับ 4 แต่อันดับ 4 ก็ได้แค่เกียรติบัตรเข้าร่วมเหมือนคนอื่น)
 * - ทุกคนที่เหลือ (ไม่ใช่อันดับ 1-3) ได้ "เกียรติบัตรเข้าร่วมการแข่งขัน" หมดทุกคน
 */
function fsGetAwardsSummary(level) {
  const normLevel = fsNormalizeLevel(level);
  const standings = fsComputeStandings(normLevel);
  const totalPlayed = standings.length;

  /**
   * ตัดสินผู้ชนะเมื่อรอบชิงเสมอกันเป๊ะ ตามกติกา tie-breaker:
   * 1. ดูผล head-to-head ที่เคยแข่งกันในรอบคัดเลือก (เกม 1-6) — ถ้าเคยเจอกันและมีผลแพ้ชนะ จบที่นี่ทันที
   * 2. ถ้าไม่เคยแข่งกัน (หรือเคยเจอแล้วเสมอ) ดู "แต้มสะสม" (points: W=2,T=1,L=0) ตามตารางอันดับ
   * 3. ถ้าแต้มสะสมเท่ากันอีก ต้องให้กรรมการเล่นเพิ่ม 1 เกม (คืน needsPlayoff: true ไม่ auto-resolve)
   */
  function resolveTieBreak(idX, idY) {
    const sX = standings.find(s => s.id === idX);
    const sY = standings.find(s => s.id === idY);

    if (sX && sX.headToHead && sX.headToHead[idY]) {
      const h2h = sX.headToHead[idY];
      if (h2h === 'W') return { winnerId: idX, loserId: idY, method: 'head-to-head' };
      if (h2h === 'L') return { winnerId: idY, loserId: idX, method: 'head-to-head' };
    }

    if (sX && sY && sX.points !== sY.points) {
      return sX.points > sY.points
        ? { winnerId: idX, loserId: idY, method: 'แต้มสะสม' }
        : { winnerId: idY, loserId: idX, method: 'แต้มสะสม' };
    }

    return { needsPlayoff: true };
  }

  const finalsSh = fsGetSS().getSheetByName('Finals');
  const fLastRow = finalsSh.getLastRow();
  let first = null, second = null, third = null, fourth = null;
  let tieNotes = [];

  if (fLastRow >= 2) {
    const fdata = finalsSh.getRange(2, 1, fLastRow - 1, 8).getValues();
    const top12Row = fdata.find(r => fsNormalizeLevel(r[0]) === normLevel && String(r[1]) === 'ชิงที่ 1-2');
    const top34Row = fdata.find(r => fsNormalizeLevel(r[0]) === normLevel && String(r[1]) === 'ชิงที่ 3-4');

    if (top12Row && top12Row[3] !== '' && top12Row[5] !== '') {
      const r = fsComputeMatchResult(top12Row[3], top12Row[5]);
      if (r.resultA === 'W') { first = String(top12Row[2]); second = String(top12Row[4]); }
      else if (r.resultB === 'W') { first = String(top12Row[4]); second = String(top12Row[2]); }
      else {
        const tb = resolveTieBreak(String(top12Row[2]), String(top12Row[4]));
        if (tb.needsPlayoff) {
          tieNotes.push('ชิงที่ 1-2 เสมอกันในรอบชิง และตัดสินด้วย tie-breaker ไม่ได้ (เท่ากันหมดทุกทาง) — ต้องให้กรรมการจัดเล่นเพิ่ม 1 เกมเพื่อตัดสินที่ 1-2');
        } else {
          first = tb.winnerId; second = tb.loserId;
          tieNotes.push('ชิงที่ 1-2 เสมอกันในรอบชิง ตัดสินด้วย ' + tb.method + ' (' + first + ' ชนะ)');
        }
      }
    }

    if (top34Row && top34Row[3] !== '' && top34Row[5] !== '') {
      const r = fsComputeMatchResult(top34Row[3], top34Row[5]);
      if (r.resultA === 'W') { third = String(top34Row[2]); fourth = String(top34Row[4]); }
      else if (r.resultB === 'W') { third = String(top34Row[4]); fourth = String(top34Row[2]); }
      else {
        const tb = resolveTieBreak(String(top34Row[2]), String(top34Row[4]));
        if (tb.needsPlayoff) {
          tieNotes.push('ชิงที่ 3-4 เสมอกันในรอบชิง และตัดสินด้วย tie-breaker ไม่ได้ (เท่ากันหมดทุกทาง) — ต้องให้กรรมการจัดเล่นเพิ่ม 1 เกมเพื่อตัดสินที่ 3-4');
        } else {
          third = tb.winnerId; fourth = tb.loserId;
          tieNotes.push('ชิงที่ 3-4 เสมอกันในรอบชิง ตัดสินด้วย ' + tb.method + ' (' + third + ' ได้อันดับ 3)');
        }
      }
    }
  }

  const podiumIds = new Set([first, second, third].filter(Boolean));
  const participants = standings
    .filter(s => !podiumIds.has(s.id))
    .map(s => ({ id: s.id, name: s.name, rank: s.rank }));

  function findInfo(id) {
    if (!id) return null;
    const s = standings.find(x => x.id === id);
    return s ? { id: s.id, name: s.name } : { id, name: '' };
  }

  return {
    first: findInfo(first),
    second: findInfo(second),
    third: findInfo(third),
    fourth: findInfo(fourth),
    totalPlayed,
    participants,
    tieNotes
  };
}

/* ===================== แผนผังโต๊ะรวมของระดับชั้น (สำหรับ auto-fill หน้า scoring) ===================== */

/**
 * ส่งแผนผังโต๊ะทั้งหมดของระดับชั้นหนึ่ง (ทุกเกม 1-6 ที่จัดไปแล้ว + คู่ชิงทั้งหมด) กลับไปในคราวเดียว
 * เพื่อให้หน้า scoring.html โหลดเก็บไว้ใน browser ครั้งเดียว แล้ว auto-fill รหัส+ชื่อนักกีฬา
 * แบบ client-side ทันทีที่พิมพ์เลขโต๊ะ (0ms, ไม่ต้องเรียก server ซ้ำทุกตัวอักษร)
 *
 * โครงสร้างที่คืนค่า:
 * {
 *   latestGame: เลขเกมล่าสุดที่จัดโต๊ะแล้ว (0 ถ้ายังไม่จัด),
 *   games: {
 *     "1": { "1A": {idA,nameA,idB,nameB,isBye}, "1B": {...}, ... },
 *     "2": { ... }, ...
 *   },
 *   finals: {
 *     "ชิงที่ 1-2": {idA,nameA,idB,nameB},
 *     "ชิงที่ 3-4": {idA,nameA,idB,nameB}
 *   }
 * }
 */
function fsGetTableMapForLevel(level) {
  const normLevel = fsNormalizeLevel(level);

  const playersMap = {};
  fsGetPlayers(normLevel).forEach(p => { playersMap[p.id] = p.name; });
  function nameOf(id, fallback) { return playersMap[id] || fallback || ''; }

  function parseIdName(token) {
    if (!token) return null;
    const parts = String(token).split('|');
    const id = parts[0];
    return { id, name: nameOf(id, parts[1]) };
  }

  const data = fsReadSheetCached('TableAssignments', 6);
  const levelRows = data.filter(r => fsNormalizeLevel(r[1]) === normLevel);

  let latestGame = 0;
  let games = {};

  levelRows.forEach(r => {
    const gameNum = String(r[0]);
    const tableNum = r[2];
    const leftRaw = r[3], rightRaw = r[4];
    const note = r[5] || '';

    if (Number(r[0]) > latestGame) latestGame = Number(r[0]);
    if (!games[gameNum]) games[gameNum] = {};

    const leftIsSingleToken = leftRaw && String(leftRaw).indexOf(' vs ') === -1;

    // เคสทั้งโต๊ะ bye (เศษ 1 คนพอดี)
    if (note.indexOf('bye') !== -1 && !rightRaw && leftIsSingleToken) {
      const byePlayer = parseIdName(leftRaw);
      games[gameNum][tableNum + 'A'] = { idA: byePlayer.id, nameA: byePlayer.name, idB: '', nameB: '', isBye: true };
      return;
    }

    // ฝั่ง A: คู่จริงเสมอในกรณีนี้ (ไม่ใช่ token เดี่ยว)
    if (leftRaw && !leftIsSingleToken) {
      const [tokA, tokB] = String(leftRaw).split(' vs ');
      const a = parseIdName(tokA), b = parseIdName(tokB);
      games[gameNum][tableNum + 'A'] = { idA: a.id, nameA: a.name, idB: b.id, nameB: b.name, isBye: false };
    }

    // ฝั่ง B: อาจเป็นคู่จริง หรือ rightBye (token เดี่ยว)
    const rightIsSingleToken = rightRaw && String(rightRaw).indexOf(' vs ') === -1;
    if (rightIsSingleToken) {
      const byePlayer = parseIdName(rightRaw);
      games[gameNum][tableNum + 'B'] = { idA: byePlayer.id, nameA: byePlayer.name, idB: '', nameB: '', isBye: true };
    } else if (rightRaw) {
      const [tokA, tokB] = String(rightRaw).split(' vs ');
      const a = parseIdName(tokA), b = parseIdName(tokB);
      games[gameNum][tableNum + 'B'] = { idA: a.id, nameA: a.name, idB: b.id, nameB: b.name, isBye: false };
    }
  });

  // คู่ชิงชนะเลิศ (Finals) — โหลดมาด้วยในคราวเดียวกัน เพื่อ auto-fill หน้า scoring ตอนเลือกคู่ชิงได้เหมือนกัน
  const finalsSh = fsGetSS().getSheetByName('Finals');
  const fLastRow = finalsSh.getLastRow();
  let finals = {};
  if (fLastRow >= 2) {
    const fdata = finalsSh.getRange(2, 1, fLastRow - 1, 8).getValues();
    fdata.filter(r => fsNormalizeLevel(r[0]) === normLevel).forEach(r => {
      const idA = String(r[2]), idB = String(r[4]);
      finals[String(r[1])] = { idA, nameA: nameOf(idA), idB, nameB: nameOf(idB) };
    });
  }

  return { latestGame, games, finals };
}

/* ===================== Full state สำหรับ display.html ===================== */

function fsGetFullState(level) {
  const normLevel = fsNormalizeLevel(level);
  const standings = fsComputeStandings(normLevel);

  const playersMap = {};
  fsGetPlayers(normLevel).forEach(p => { playersMap[p.id] = p.name; });

  function parseIdName(token) {
    if (!token) return null;
    const parts = String(token).split('|');
    const id = parts[0];
    return { id, name: playersMap[id] || parts[1] || '' };
  }

  function parsePairStr(pairStr) {
    if (!pairStr) return null;
    const [tokA, tokB] = String(pairStr).split(' vs ');
    const a = parseIdName(tokA), b = parseIdName(tokB);
    if (!a || !b) return null;
    return { idA: a.id, nameA: a.name, idB: b.id, nameB: b.name };
  }

  const data = fsReadSheetCached('TableAssignments', 6);
  let currentTables = [];
  let latestGame = 0;
  if (data.length > 0) {
    const levelRows = data.filter(r => fsNormalizeLevel(r[1]) === normLevel);
    levelRows.forEach(r => { if (Number(r[0]) > latestGame) latestGame = Number(r[0]); });
    currentTables = levelRows.filter(r => Number(r[0]) === latestGame).map(r => {
      const note = r[5] || '';
      const leftRaw = r[3], rightRaw = r[4];

      const leftIsSingleToken = leftRaw && String(leftRaw).indexOf(' vs ') === -1;
      if (note.indexOf('bye') !== -1 && !rightRaw && leftIsSingleToken) {
        const byePlayer = parseIdName(leftRaw);
        return { game: r[0], table: r[2], left: null, right: null, bye: byePlayer, note };
      }

      const rightIsSingleToken = rightRaw && String(rightRaw).indexOf(' vs ') === -1;
      if (rightIsSingleToken) {
        return {
          game: r[0], table: r[2],
          left: parsePairStr(leftRaw),
          right: null,
          rightBye: parseIdName(rightRaw),
          note
        };
      }

      return {
        game: r[0], table: r[2],
        left: parsePairStr(leftRaw),
        right: parsePairStr(rightRaw),
        note
      };
    });
  }

  const finalsSh = fsGetSS().getSheetByName('Finals');
  const fLastRow = finalsSh.getLastRow();
  let finals = [];
  if (fLastRow >= 2) {
    const fdata = finalsSh.getRange(2, 1, fLastRow - 1, 8).getValues();
    finals = fdata.filter(r => fsNormalizeLevel(r[0]) === normLevel).map(r => {
      const idA = String(r[2]), idB = String(r[4]);
      return {
        pairLabel: r[1], idA, nameA: playersMap[idA] || '', roundsA: r[3],
        idB, nameB: playersMap[idB] || '', roundsB: r[5]
      };
    });
  }

  const awards = fsGetAwardsSummary(normLevel);
  const unlockedGames = fsGetUnlockedGames(normLevel);

  return {
    status: 'success',
    level: normLevel,
    standings,
    currentTables,
    latestGame,
    finals,
    awards,
    unlockedGames
  };
}