// Ortak test altyapısı: modülleri tarayıcıdaki sırayla yükler
const path = require('path');
const W = f => path.join(__dirname, '..', 'www', 'js', f);
globalThis.IRRI_DATA = require(W('data.js'));
globalThis.IRRI_CATALOG = require(W('catalog-data.js'));
for (const f of ['hydraulics.js', 'geom.js', 'layout.js', 'catalog.js', 'validate.js']) require(W(f));
const E = require(W('engine.js'));
const tests = [];
function test(name, fn) { tests.push({ name, fn, file: path.basename(module.parent ? module.parent.filename : '') }); }
function near(a, b, tol, msg) { if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg}: ${a} ≠ ${b} (±${tol})`); }
function rel(a, b, tol, msg) { if (!(Math.abs(a - b) <= tol * Math.abs(b))) throw new Error(`${msg}: ${a} ≠ ${b} (±%${tol * 100})`); }
function ok(c, msg) { if (!c) throw new Error(msg); }
module.exports = { E, Hy: globalThis.IrriHyd, Gm: globalThis.IrriGeom, Ly: globalThis.IrriLayout, Ct: globalThis.IrriCatalog, Vd: globalThis.IrriValidate, D: globalThis.IRRI_DATA, CAT: globalThis.IRRI_CATALOG, test, tests, near, rel, ok, W };
