// MH-0 — Bağımsız hidrolik çözücü: EPANET 2.3 (epanet-js, WebAssembly).
// IrriGrow motoruyla aynı geometriyi EPANET'te ayrıca modeller. Modelleme varsayımları:
// docs/dogrulama/README.md → "EPANET modelleme varsayımları".
const { Project, Workspace, NodeType, LinkType, NodeProperty, LinkProperty, FlowUnits, HeadLossType, Option } = require('epanet-js');

let ready = null;
const ws = new Workspace();
function workspace() { if (!ready) ready = ws.loadModule().then(() => ws); return ready; }

const H0 = 1000;      // kaynak (rezervuar) toplam yükü, m — mutlak değeri sonucu etkilemez, kayıp = H0 − düğüm yükü
const EPS_PLASTIC = 0.0015; // mm — PE/PVC için Darcy-Weisbach mutlak pürüzlülüğü (EPANET 0 kabul etmez)
// Yakınsama: varsayılan ACCURACY 0,001 yerine 1e-7 (toplam debi değişimi / toplam debi) ve en çok 500 iterasyon
function tight(m) { m.setOption(Option.Accuracy, 1e-7); m.setOption(Option.Trials, 500); }
// EPANET dengelenemeyen (yakınsamayan) bir çözüm için yalnızca uyarı yazar; burada uyarı hataya çevrilir.
function solve(m) {
  const seen = [], wrap = f => (...a) => { const t = a.join(' '); if (/epanet/i.test(t)) seen.push(t); else f(...a); };
  const L = console.log, W = console.warn; console.log = wrap(L); console.warn = wrap(W);
  try { m.solveH(); } finally { console.log = L; console.warn = W; }
  if (seen.some(t => /unbalanced|warning/i.test(t))) throw new Error('EPANET çözümü güvenilir değil: ' + seen.join(' | '));
}

// Zincir boru (lateral / manifold): girişten itibaren çıkış konumları (m), çıkış debileri (l/s), çap (mm),
// her çıkışa giden borunun ek eşdeğer uzunluğu (m), çıkış kotları (m). Dönen: her çıkışta girişten kayıp (m).
async function chain({ x, qls, dmm, extraL = () => 0, z = () => 0, headloss = 'DW', C = 150 }) {
  await workspace();
  const m = new Project(ws);
  m.init('r.rpt', 'o.out', FlowUnits.LPS, headloss === 'HW' ? HeadLossType.HW : HeadLossType.DW); tight(m);
  const R = m.addNode('R', NodeType.Reservoir); m.setNodeValue(R, NodeProperty.Elevation, H0);
  const ids = []; let prev = 'R', px = 0;
  x.forEach((p, k) => {
    const id = 'J' + k, j = m.addNode(id, NodeType.Junction); m.setJunctionData(j, z(k, p), qls[k], '');
    const l = m.addLink('P' + k, LinkType.Pipe, prev, id); m.setPipeData(l, (p - px) + extraL(k), dmm, headloss === 'HW' ? C : EPS_PLASTIC, 0);
    ids.push(j); prev = id; px = p;
  });
  solve(m);
  const loss = ids.map(j => H0 - m.getNodeValue(j, NodeProperty.Head));
  m.close();
  return loss;
}

// Ana hat ağı (ağaç): IrriGrow r.main.net segmentlerinden; bir shift'teki alt ünite debileri, ünite bağlantı düğümlerine.
// Yerel kayıp: motorla aynı şekilde boru uzunluğu ×1,10 (eşdeğer uzunluk). Dönen: her ünite için girişten kayıp (m) ve kök debi (m³/h).
async function mainNetwork(r, groupIdx) {
  await workspace();
  const net = r.main.net, gr = r.sel.groups[groupIdx];
  const m = new Project(ws);
  m.init('r.rpt', 'o.out', FlowUnits.LPS, HeadLossType.HW); tight(m);
  const R = m.addNode('SRC', NodeType.Reservoir); m.setNodeValue(R, NodeProperty.Elevation, H0);
  // Yalnız bu shift'te su taşıyan (en az bir açık üniteyi besleyen) segmentler modellenir; motor da yalnız bunları hesaplar.
  // Kapalı kollar sıfır debili ölü uçlardır; basınca etkileri yoktur ve EPANET yakınsamasını bozar.
  const on = new Set(gr), act = net.map(sg => sg.down.some(k => on.has(k)));
  const nodeOf = i => i < 0 ? 'SRC' : 'N' + i, jid = {};
  net.forEach((sg, i) => { if (!act[i]) return; const n = m.addNode(nodeOf(i), NodeType.Junction); m.setJunctionData(n, 0, 0, ''); jid[i] = n; });
  const link = {};
  net.forEach((sg, i) => { if (!act[i]) return; const l = m.addLink('L' + i, LinkType.Pipe, nodeOf(sg.parent), nodeOf(i)); m.setPipeData(l, sg.L * 1.10, sg.ic, 150, 0); link[i] = l; });
  const at = k => { const u = r.units[k]; return u.segs.length ? u.segs[u.segs.length - 1] : -1; };
  const dem = {}; gr.forEach(k => { dem[at(k)] = (dem[at(k)] || 0) + r.units[k].Q / 3.6; });
  for (const [a, q] of Object.entries(dem)) if (+a >= 0) m.setJunctionData(jid[a], 0, q, '');
  solve(m);
  const loss = {}; gr.forEach(k => { loss[k] = at(k) < 0 ? 0 : H0 - m.getNodeValue(jid[at(k)], NodeProperty.Head); });
  // Kaynaktan çıkan debi: kaynağa doğrudan bağlı bütün kolların toplamı (m³/h)
  const rootQ = net.reduce((t, sg, i) => t + (act[i] && sg.parent < 0 ? m.getLinkValue(link[i], LinkProperty.Flow) * 3.6 : 0), 0);
  m.close();
  return { loss, rootQ };
}

// Tek boru, Darcy-Weisbach (EPANET'in kendi sürtünme katsayısı çözümü, ε = EPS_PLASTIC): kayıp (m)
async function singlePipeDW(Qls, dmm, L) {
  const loss = await chain({ x: [L], qls: [Qls], dmm, headloss: 'DW' });
  return loss[0];
}

module.exports = { chain, mainNetwork, singlePipeDW, EPS_PLASTIC, workspace };
