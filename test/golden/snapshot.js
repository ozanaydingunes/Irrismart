// MH-0 — Altın referans anlık görüntüsü: hesap motoru, hidrolik tablo, Excel ve çizim çıktılarından
// karşılaştırılabilir (fonksiyon içermeyen, tarih bağımsız) bir JSON üretir.
const path = require('path'), crypto = require('crypto');
const lib = require('../_lib');
const { E, W } = lib;
require(W('pipelib.js'));
const HT = require(W('hydro-table.js'));
const RD = require(W('report-data.js'));
const Dr = require(W('drawing.js'));
const XLSX = require('xlsx');
const SC = require('./scenarios');

const TODAY = new Date().toLocaleDateString('tr-TR');
const noDate = v => typeof v === 'string' ? v.split(TODAY).join('<TARİH>') : v;
const pick = (o, keys) => { const r = {}; for (const k of keys) if (o && o[k] !== undefined) r[k] = o[k]; return r; };
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

function designOf(sc) {
  const opt = Object.assign({}, sc.opt || {});
  if (sc.manual) {
    // Elle shift ataması: otomatik çözümden türetilmiş, deterministik bir atama
    const base = E.design(sc.inp, null, opt);
    if (base.ok) {
      const n = base.units.length, assign = base.units.map((u, k) => Math.floor(k / 2) % Math.max(1, Math.ceil(n / 3)));
      opt.manual = { sig: base.layout.sig, assign };
    }
  }
  return { r: E.design(sc.inp, null, opt), opt };
}

function snapDesign(r) {
  if (!r.ok) return { ok: false, err: r.err, warn: r.warn, asm: r.asm };
  const alt = a => ({
    Ns: a.Ns, manual: !!a.manual, groups: a.groups, Qj: a.Qj, Qmax: a.Qmax, Qmin: a.Qmin, Hfix: a.Hfix, feasible: a.feasible,
    cycleHours: a.cycleHours, avail: a.avail, kWh: a.kWh, energyCost: a.energyCost, compare: a.compare, basis: a.basis, missing: a.missing,
    recommended: !!a.recommended, filter: a.filter.text, valve: a.valve.text,
    main: pick(a.main.sel, ['od', 'pn', 'ic', 'v', 'H', 'Hd', 'Hp', 'surplus', 'Pout', 'Pop', 'Pshut', 'hf', 'Hmax', 'kWh', 'energyCost', 'pipeCost', 'annual']),
    pump: pick(a.pump, ['need', 'fromCatalog', 'id', 'tip', 'Q', 'H', 'motor', 'Phyd', 'shaft', 'Pmax', 'over', 'kWh', 'Hshut', 'Pshut', 'pts', 'text']),
  });
  return {
    ok: true, asm: r.asm, warn: r.warn, recBasis: r.recBasis,
    field: r.field, emitter: r.emitter,
    lateral: pick(r.lateral, ['d', 'ic', 'Lmax', 'count', 'len', 'planted', 'lead', 'emitters', 'maxLen', 'maxDH', 'hfMax', 'vMax', 'hreqMax', 'hreqMin']),
    units: r.units.map(u => Object.assign(pick(u, ['band', 'ax', 'rows', 'nLat', 'Q', 'Lm', 'hf', 'varH', 'v', 'hIn', 'hInMax', 'hLatMax', 'yIn', 'yEnd', 'rise', 'path', 'segs']), { pipe: `${u.pipe.od}/${u.pipe.pn}/${u.pipe.ic}` })),
    manifold: Object.assign(pick(r.manifold, ['count', 'Qmax', 'hfMax', 'varMax', 'vMax', 'LmMax']), { byPipe: r.manifold.byPipe.map(b => ({ pipe: `${b.pipe.od}/${b.pipe.pn}`, len: b.len, count: b.count })) }),
    sectors: r.sectors,
    sectorAlts: r.sectorAlts.map(alt),
    main: {
      Lcrit: r.main.Lcrit, Lmain: r.main.Lmain, teleskop: r.main.teleskop, allPriced: r.main.allPriced,
      alts: r.main.alts.map(a => pick(a, ['od', 'pn', 'ic', 'v', 'H', 'Hmax', 'hf', 'kWh', 'energyCost', 'pipeCost', 'annual', 'tags', 'Pop', 'Pshut'])),
      net: r.main.net.map(s => pick(s, ['id', 'kind', 'a', 'b', 'L', 'parent', 'down', 'od', 'pn', 'ic', 'Q', 'Qmax', 'v', 'hf'])),
    },
    head: r.head, inlet: r.inlet,
    pump: pick(r.pump, ['need', 'fromCatalog', 'id', 'tip', 'Q', 'H', 'motor', 'Phyd', 'shaft', 'Pmax', 'over', 'kWh', 'Hshut', 'Pshut', 'pts', 'text', 'verified', 'count']),
    filter: { text: r.filter.text, missing: r.filter.missing, items: r.filter.items.map(x => ({ id: x.f.id, n: x.n })) },
    valve: { text: r.valve.text, over: !!r.valve.over },
    schedule: r.schedule, surge: r.surge,
    bom: r.bom, cost: r.cost,
  };
}

function snapExports(p, r) {
  if (!r.ok) return null;
  const wb = RD.workbook(XLSX, p, r);
  const sheets = {};
  for (const n of wb.SheetNames) sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }).map(row => row.map(noDate));
  const M = Dr.build(p, r), S = Dr.sheet(M, { format: 'A3', scale: 'auto' });
  const dxf = Buffer.from(Dr.toDXF(M).bytes).toString('latin1');
  const svg = noDate(Dr.toSVG(S));
  return { excel: sheets, pafta: { format: S.format || 'A3', scale: S.scale, W: S.W, H: S.H, svgSha256: sha(svg) }, dxf: { length: dxf.length, sha256: sha(dxf) } };
}

function snapScenario(sc) {
  const { r, opt } = designOf(sc);
  const p = { name: sc.id, inp: sc.inp, poly: (sc.opt || {}).poly || [], src: (sc.opt || {}).src || null, station: (sc.opt || {}).station, route: (sc.opt || {}).route, rev: 1 };
  const out = { id: sc.id, kapsam: sc.kapsam, inp: sc.inp, manual: opt.manual || null, design: snapDesign(r), exports: snapExports(p, r) };
  if (['S01-duz-arazi', 'S17-zeytin-yuzey-suyu'].includes(sc.id)) {
    const la = E.layoutAlternatives(sc.inp, null, sc.opt || {});
    out.layoutAlternatives = { priced: la.priced, basis: la.basis, picks: Object.fromEntries(Object.entries(la.picks).map(([k, v]) => [k, `${v.rowDir}/${v.latD}`])),
      list: la.list.map(v => pick(v, ['rowDir', 'latD', 'ok', 'err', 'Ns', 'feasible', 'inv', 'invPart', 'missing', 'kWh', 'energyCost', 'pipeLen', 'motor', 'H', 'margin', 'life'])) };
  }
  return out;
}

function snapHydroTable() {
  const h = SC.hydroTable;
  const fric = {}; for (const [k, rows] of Object.entries(h.fric)) fric[k] = HT.friction(rows);
  const wb = RD.hydroWorkbook(XLSX, { hydro: h });
  const sheets = {};
  for (const n of wb.SheetNames) { const ws = wb.Sheets[n]; const cells = {}; for (const a of Object.keys(ws).filter(k => k[0] !== '!').sort()) cells[a] = { f: ws[a].f || null, v: ws[a].v === undefined ? null : ws[a].v, z: ws[a].z || null }; sheets[n] = cells; }
  return { id: 'H01-hidrolik-hesap-tablosu', system: h.fields.map(f => HT.systemField(f)), fric, excel: sheets };
}

module.exports = { scenarios: SC, snapScenario, snapHydroTable, sha };
