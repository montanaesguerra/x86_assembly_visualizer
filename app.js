console.log("app.js LOADED v10", new Date().toISOString());

// --- Minimal teaching model (not a real CPU) ---
const state = {
  eip: 0,
  regs: { EAX: 0, EBX: 0, ECX: 0, EDX: 0, ESI: 0, EDI: 0, EBP: 0x1000, ESP: 0x1000 },
  flags: { CF:0, ZF:0, SF:0, OF:0, PF:0, AF:0 },
  mem: new Map(),     // address:number -> byte (0..255)
  stack: [],          // array of 32-bit values
  program: []
};

// --- Demo library (add more later) ---
const demos = {
  arithmetic: [
    // '; Arithmetic demo – watch EAX and ZF',
    'mov eax, 0x00000005',
    'mov ebx, 0x00000003',
    'add eax, ebx',          // EAX = 8
    'add eax, 0xFFFFFFF8',   // EAX = 0 (wrap), ZF=1 in our simplified flags
    'cmp eax, 0x0',          // compare result to 0 -> ZF stays 1
    'je done',
    'nop',
    'done: nop'
  ],
  moves: [
    'mov eax, 0x10',
    'mov ebx, 0x32',
    'mov ecx, eax',
    'mov [eax], 0x40',
    'add [eax], 0x30',
    'mov [ebx], [eax]'
  ],
  test: [
    //Test instructions
    'mov eax, 0x20',
    'mov ebx, 0x30',
    'add eax, ebx',
    'nop',
    'nop',
    'sub eax, ebx',
    'done: nop'
  ],
  test2: [
    //Test2 instructions
    'mov eax, 0x20',
    'mov ebx, 0x30',
    'add eax, ebx',
    'nop',
    'nop',
    'sub eax, ebx',
    'inc ebx',
    'dec ebx',
    'mul eax',
    'done: nop'
  ],
  stack: [
    //Stack instructions
    'push ebp',
    'mov ebp, esp',
    'mov eax, 0x10',
    'mov ebx, 0x15',
    'mov ecx, 0x20',
    'mov edx, 0x25',
    'push eax',
    'push ebx',
    'push ecx',
    'push edx',
    'pop eax',
    'pop ebx',
    'pop ecx',
    'pop edx'
  ],
  Print: [
    //Print String Instructions
    //'; Write "Release the white paper\\n\\0" to memory starting at 0x2000',
    'mov edi, 0x2000', //destination cursor

    //"Release"
    'mov [edi], 0x52', 'inc edi', // R
    'mov [edi], 0x65', 'inc edi', //e
    'mov [edi], 0x6C', 'inc edi', // l
    'mov [edi], 0x65', 'inc edi', // e
    'mov [edi], 0x61', 'inc edi', // a
    'mov [edi], 0x73', 'inc edi', // s
    'mov [edi], 0x65', 'inc edi', // e

    // " " (space)
    'mov [edi], 0x20', 'inc edi',

    // "the"
    'mov [edi], 0x74', 'inc edi', // t
    'mov [edi], 0x68', 'inc edi', // h
    'mov [edi], 0x65', 'inc edi', // e

    // " "
    'mov [edi], 0x20', 'inc edi',

    // "white"
    'mov [edi], 0x77', 'inc edi', // w
    'mov [edi], 0x68', 'inc edi', // h
    'mov [edi], 0x69', 'inc edi', // i
    'mov [edi], 0x74', 'inc edi', // t
    'mov [edi], 0x65', 'inc edi', // e

    // " "
    'mov [edi], 0x20', 'inc edi',

    // "paper"
    'mov [edi], 0x70', 'inc edi', // p
    'mov [edi], 0x61', 'inc edi', // a
    'mov [edi], 0x70', 'inc edi', // p
    'mov [edi], 0x65', 'inc edi', // e
    'mov [edi], 0x72', 'inc edi', // r

    // newline + NUL terminator
    'mov [edi], 0x0A', 'inc edi', // '\n' (optional)
    'mov [edi], 0x00',            // '\0' string terminator

    'done: nop'
  ],
    Arithmetic_Basics: [
    '; Simple arithmetic warmup',
    'mov eax, 0x10',        // 16
    'add eax, 0x30',        // 16 + 48 = 64 (0x40)
    'sub eax, 0x01',        // 64 - 1 = 63 (0x3F)
    'inc eax',              // 64 (0x40)
    'dec eax',              // 63 (0x3F)
    'mov ebx, 7',
    'add ebx, 5',           // 12
    'sub ebx, 20',          // 12 - 20 = -8 (0xFFFFFFF8)
    'nop'
  ],
  Branching_Basics: [
    '; Compare two values and branch',
    'mov eax, 5',
    'mov ebx, 5',
    'cmp eax, ebx',
    'je equal',             // equal -> jump
    'mov ecx, 1',           // (skipped)
    'jmp done',
    'equal: mov ecx, 2',
    'done: nop'
  ],
  Loop: [
    '; Sum ECX..1 into EAX using a simple loop',
    'mov ecx, 5',           // 5,4,3,2,1
    'xor eax, eax',         // sum = 0
    'loop_start:',
    'add eax, ecx',         // add current ECX
    'dec ecx',              // ECX-- sets ZF when ECX==0
    'jnz loop_start',       // loop until ECX==0
    'nop'                   // EAX should be 15
  ],
    XOR_Basics: [
    '; XOR basics',
    'mov eax, 0x12345678',
    'xor eax, eax',    // should zero EAX, ZF=1
    'mov ebx, 0xF0F0F0F0',
    'xor ebx, 0x0F0F0F0F',  // expect EBX=0xFFFFFFFF
    'nop'
  ],
    LEA_Demo: [
    '; LEA = Load Effective Address (no memory read)',
    '; Example 1: base + displacement',
    'mov eax, 0x2000',

    'lea edi, [eax + 0x20]',          // EDI = 0x2020
    '; Example 2: base + index*scale + disp',
    'mov ebx, 3',
    'lea esi, [eax + ebx*4 + 8]',     // ESI = 0x2000 + 12 + 8 = 0x2014

    '; Example 3: index*scale only + disp',
    'lea ecx, [ebx*8 + 0x10]',        // ECX = 3*8 + 0x10 = 0x28

    '; Example 4: base only (pointer copy)',
    'lea edx, [esi]',                 // EDX = ESI

    'nop'
  ],

};

// --- Utilities & rendering ---
function toHex(v, pad=8) { return '0x' + (v >>> 0).toString(16).toUpperCase().padStart(pad,'0'); }

function renderAll() {
  console.log("renderAll()");
  renderProgram();
  renderRegs();
  renderFlags();
  renderMem();
  renderStack();
  stepBtn.disabled = state.program.length === 0 || state.eip >= state.program.length;
  resetBtn.disabled = state.program.length === 0;
}

// Column 1: program
const asmList = document.getElementById('asmList');
function renderProgram() {
  asmList.innerHTML = '';
  state.program.forEach((op, i) => {
    const li = document.createElement('li');
    li.className = 'asm-item' + (i === state.eip ? ' active' : '');
    li.innerHTML = `<span class="ln">${i+1}</span><span class="op">${op}</span>`;
    asmList.appendChild(li);
  });
}

// Column 2: registers & flags
const regsBody = document.getElementById('regsBody');
// Snapshot of last-rendered register values (including EIP) for change-detection
let _prevRegsSnapshot = null;

function renderRegs() {
  const keys = ['EAX','EBX','ECX','EDX','ESI','EDI','EBP','ESP','EIP'];
  const values = { ...state.regs, EIP: state.eip };
  const frag = document.createDocumentFragment();


  if (_prevRegsSnapshot === null) {
    _prevRegsSnapshot = { ...values };
  }

  keys.forEach(k => {
    const row = document.createElement('div');
    const changed = _prevRegsSnapshot[k] !== (values[k] ?? 0);

    row.className = 'kv' + (changed ? ' changed' : '');
    row.innerHTML = `<b>${k}</b><span>${toHex(values[k]||0)}</span>`;
    frag.appendChild(row);
  });

  const preservedFlagsEl = document.getElementById('flags');
  regsBody.innerHTML = '';
  regsBody.appendChild(frag);
  regsBody.appendChild(preservedFlagsEl);
  _prevRegsSnapshot = { ...values };
}

// function renderRegs() {
//   const keys = ['EAX','EBX','ECX','EDX','ESI','EDI','EBP','ESP','EIP'];
//   const values = { ...state.regs, EIP: state.eip };
//   const frag = document.createDocumentFragment();
//   keys.forEach(k => {
//     const row = document.createElement('div');
//     row.className = 'kv';
//     row.innerHTML = `<b>${k}</b><span>${toHex(values[k]||0)}</span>`;
//     frag.appendChild(row);
//   });
//   const preservedFlagsEl = document.getElementById('flags');
//   regsBody.innerHTML = '';
//   regsBody.appendChild(frag);
//   regsBody.appendChild(preservedFlagsEl);
// }

function renderFlags() {
  const flagsEl = document.getElementById('flags');
  flagsEl.innerHTML = '';
  Object.entries(state.flags).forEach(([k,v]) => {
    const d = document.createElement('div');
    d.className = 'flag' + (v ? ' on' : '');
    d.textContent = `${k}=${v}`;
    flagsEl.appendChild(d);
  });
}

// Column 3: memory
const memTableBody = document.querySelector('#memTable tbody');
function renderMem() {
  memTableBody.innerHTML = '';
  const addrs = [...state.mem.keys()].sort((a,b)=>a-b).slice(0, 64);
  addrs.forEach(addr => {
    const b = readByte(addr);
    const tr = document.createElement('tr');
    tr.innerHTML =
    `<td class="addr">${toHex(addr, 8)}</td>` +
    `<td>${b}</td>` +
    `<td>0x${b.toString(16).toUpperCase().padStart(2, '0')}</td>`;
    memTableBody.appendChild(tr);
  });
  }

// helpers to write memory (byte array)
function writeMem(addr, bytes) { bytes.forEach((b,i)=> state.mem.set(addr+i, b & 0xFF)); }

// Byte helpers
function readByte(addr) { return (state.mem.get(addr >>> 0) ?? 0) & 0xFF;}
function writeByte(addr, v) {state.mem.set(addr >>> 0, v& 0xFF);}

// Parse [REG] -> effective address (simple base-only addressing)
function parseMemAddr(t) {
  if (!t) return null;
  const m = t.trim().match(/^\[\s*([A-Za-z]{2,3})\s*\]$/);
  if (!m) return null;

  const r = m[1].toUpperCase();

  if (!REG_NAMES.has(r)) return null;

  return state.regs[r] >>> 0;
}

// Compute effective address from a memory expression like [eax + ebx*4 + 8]
// Supports: base reg, optional index*scale (scale in {1,2,4,8}), optional +/- displacement (hex or dec).
function computeEA(expr) {
  if (!expr) return 0 >>> 0;
  const m = expr.trim().match(/^\[\s*([^\]]+)\s*\]$/);
  if (!m) {
    console.warn("LEA computeEA: not a [ ... ] expr:", expr);
    return 0 >>> 0;
  }
  // tokenization: split by '+' and normalize minus signs into +(-X)
  const inside = m[1]
    .replace(/-/g, '+-')      // turn "a - b" into "a +-b"
    .replace(/\s+/g, '');     // remove spaces

  let sum = 0 >>> 0;
  const tokens = inside.split('+').filter(Boolean);

  for (const t of tokens) {
    // hex or decimal immediate (possibly signed)
    if (/^[+-]?0x[0-9a-fA-F]+$/.test(t)) {
      const v = parseInt(t, 16) >>> 0;
      sum = (sum + v) >>> 0;
      continue;
    }
    if (/^[+-]?\d+$/.test(t)) {
      const v = (parseInt(t, 10) >>> 0);
      sum = (sum + v) >>> 0;
      continue;
    }

    // index*scale (e.g., EAX*4), case-insensitive
    const ms = t.match(/^([A-Za-z]{2,3})\*(1|2|4|8)$/);
    if (ms) {
      const reg = ms[1].toUpperCase();
      const scale = parseInt(ms[2], 10);
      if (REG_NAMES.has(reg)) {
        const part = (state.regs[reg] * scale) >>> 0;
        sum = (sum + part) >>> 0;
        continue;
      }
    }

    // base register only
    const r = t.toUpperCase();
    if (REG_NAMES.has(r)) {
      sum = (sum + (state.regs[r] >>> 0)) >>> 0;
      continue;
    }

    console.warn("LEA computeEA: unrecognized token:", t);
  }

  return sum >>> 0;
}

// Column 4: stack
// Update to include memory address column TODO
const stackEl = document.getElementById('stack');
function renderStack() {
  stackEl.innerHTML = '';

  // Build rows (top-of-stack is the *last* value in state.stack)
  state.stack.forEach((val, i) => {
    const addr = (0x1000 - 4 * (i + 1)) >>> 0; // memory address of this item (compute first)
    const isTop = i === state.stack.length - 1;
    const isBase = addr === (state.regs.EBP >>> 0); // Base Pointer
    const d = document.createElement('div');

    d.className = 'stack-item' + (isTop ? ' top' : '') + (isBase ? ' base' : '');
    d.innerHTML = `
      <div class="stack-col addr">${toHex(addr)}</div>
      <div class="stack-col data">${toHex(val)}</div>
      <div class="stack-col chips">
        ${isTop ? `<span class="esp-chip">ESP → ${toHex(addr)}</span>` : ''}
        ${isBase ? `<span class="ebp-chip">EBP</span>` : ''}
      </div>
      `;
      stackEl.appendChild(d);
  });

  // Header goes last so with column-reverse it stays on top.
  const header = document.createElement('div');
  header.className = 'stack-item stack-header';
  header.innerHTML = `
    <div class="stack-col-h">Address</div>
    <div class="stack-col-h">Data</div>
    <div class="stack-col-h"></div>
    `;
  stackEl.appendChild(header);

  // state.stack.forEach((val) => {
  //   const d = document.createElement('div');
  //   d.className = 'stack-item';
  //   d.innerHTML = `<div>${toHex(val)}</div>`;
  //   stackEl.appendChild(d);
  // });
}

// ========= Case-insensitive operand handling =========
const REG_NAMES = new Set(['EAX','EBX','ECX','EDX','ESI','EDI','EBP','ESP','EIP']);
const norm = s => (s ?? '').trim().toUpperCase();

// Case-insensitive register write
function setReg(r, v) {
  const R = norm(r);
  const val = v >>> 0;
  if (REG_NAMES.has(R)) {
    console.log("setReg:", R, "=", toHex(val));
    state.regs[R] = val;
  } else {
    console.warn("setReg: unknown register", r);
  }
}

// Case-insensitive operand read (immediates, regs, demo [DATA])
function getVal(t) {
  if (!t) return 0;
  const T = t.trim();

  // immediates
  if (/^0x[0-9a-fA-F]+$/.test(T)) return parseInt(T, 16);
  if (/^\d+$/.test(T)) return parseInt(T, 10);

  // registers (case-insensitive)
  const R = norm(T);
  if (REG_NAMES.has(R)) return state.regs[R];

  // byte deref: [REG]
  const memAddr = parseMemAddr(T);
  if (memAddr !== null) return readByte(memAddr);

  // symbolic memory demo: [data]
  if (R === '[DATA]') {
    let v = 0; for (let i=0;i<4;i++) v |= (state.mem.get(0x2000+i)??0) << (8*i);
    return v >>> 0;
  }

  console.warn("getVal: unknown operand", t);
  return 0;
}

// --- Tiny executor (subset) ---
// supports: mov, add, push, pop, cmp, je, nop, labels, [data]
function step() {
  if (state.eip >= state.program.length) return;
  const raw = state.program[state.eip];
  const op = raw.split(';')[0].trim();
  console.log("STEP @", state.eip, "raw:", JSON.stringify(raw), "op:", JSON.stringify(op));
  if (!op) { state.eip++; return renderAll(); }

  // label like "done:"
  if (/^[a-zA-Z_][\w]*:\s*$/.test(op)) { state.eip++; return renderAll(); }

  //split on whitespace and stop after 2 pieces
  // const [mn, rest] = op.split(/\s+/, 2);
  // const args = rest ? rest.split(',').map(s=>s.trim()) : [];

  const m = op.match(/^([A-Za-z]+)\s+(.*)$/);
  const mn = m ? m[1] : op;
  const rest = m ? m[2] : '';
  const args = rest.split(',').map(s => s.trim()).filter(Boolean);



  console.log("mn:", mn, "args:", args);

  const aluFlags = (res) => {
    state.flags.ZF = (res>>>0) === 0 ? 1:0;
    state.flags.SF = (res & 0x80000000) ? 1:0;
    // simplified flags for teaching
    state.flags.OF = 0; state.flags.CF = 0; state.flags.PF = 0; state.flags.AF = 0;
  };

  // Our Instruction implementations
  switch ((mn||'').toLowerCase()) {
    case 'mov': {
      const [dst, src] = args;
      const val = getVal(src) & 0xFF; // treat [reg] form as byte-wide
      const memAddr = parseMemAddr(dst);

      if (memAddr !== null) {
        console.log("MOV BYTE [", dst, "] <-", toHex(val, 2));
        writeByte(memAddr, val);
      } else {
        console.log("MOV", dst, "<-", toHex(getVal(src)));
        setReg(dst, getVal(src));
      }
      
      state.eip++; break;
    }
    case 'add': {
      const [dst, src] = args;
      const memAddr = parseMemAddr(dst);

      if (memAddr !== null) {
        const cur = readByte(memAddr);
        const next = (cur + (getVal(src) & 0xFF)) & 0xFF;

        console.log("ADD BYTE [", dst, "] =", toHex(next, 2), "(from", toHex(cur,2), "+", toHex(getVal(src)&0xFF,2),")");
        writeByte(memAddr, next);

        // flags from byte result (teaching simplification)

        state.flags.ZF = next === 0 ? 1 : 0;
        state.flags.SF = (next & 0x80) ? 1:0;
        state.flags.OF = 0; state.flags.CF = 0; state.flags.PF = 0; state.flags.AF = 0;
      } else {
        const val = (getVal(dst) + getVal(src)) >>> 0;
        console.log("Add", dst, "=", toHex(val));
        setReg(dst, val);
        state.flags.ZF = (val>>>0) === 0 ? 1:0;
        state.flags.SF = (val & 0x80000000) ? 1:0;
        state.flags.OF = 0; state.flags.CF = 0; state.flags.PF = 0; state.flags.AF = 0;
      }
      state.eip++; break;
    }
    case 'sub': {
      const [dst, src] = args;
      const val = (getVal(dst) - getVal(src)) >>> 0; // 32-bit unsigned result
      console.log("SUB", dst, "=", toHex(val));
      setReg(dst, val);
      aluFlags(val);
      state.eip++; break;
    }
    case 'inc': {
      const [dst] = args;
      const val = (getVal(dst) + 1) >>> 0;
      console.log("INC", dst)
      setReg(dst, val); aluFlags(val); state.eip++; break;
    }
    case 'dec': {
      const [dst] = args;
      const val = (getVal(dst) - 1) >>> 0;
      console.log("DEC", dst)
      setReg(dst, val); aluFlags(val); state.eip++; break;

    }
    case 'mul': {
      // x86 semantics (32-bit): EDX:EAX = EAX * src (unsigned)
      const [src] = args;

      // Read operands as unsigned 32-bit, then convert to BigInt
      const a = toBigU32(state.regs.EAX);
      const b = toBigU32(getVal(src));

      const prod = a* b; //BigInt (up to 64 bits)
      const lo = Number(prod & U32_MASK);
      const hi = Number((prod >> 32n) & U32_MASK);

      setReg('EAX', lo);
      setReg('EDX', hi);

      const wide = hi !== 0;
      state.flags.CF = wide ?1 : 0;
      state.flags.OF = wide ? 1: 0;
      state.flags.ZF = 0; state.flags.SF = 0; state.flags.PF = 0; state.flags.AF = 0;

      state.eip++;
      break;
    }
    case 'xor': {
      const [dst, src] = args;
      const val = (getVal(dst) ^ getVal(src)) >>> 0; // 32-bit result
      console.log("XOR", dst, ",", src, "=", toHex(val));
      setReg(dst, val);
      aluFlags(val); // update ZF/SF, clear OF/CF/PF/AF for teaching
      state.eip++;
      break;
    }
    case 'lea': {
      const [dst, src] = args;
      // LEA does NOT touch flags in our teaching model
      const addr = computeEA(src);
      console.log("LEA", dst, ",", src, "->", toHex(addr));
      setReg(dst, addr);
      state.eip++;
      break;
    }
    case 'push': {
      const [src] = args; const val = getVal(src);
      console.log("PUSH", toHex(val));
      state.stack.push(val >>> 0);
      state.regs.ESP = (state.regs.ESP - 4) >>> 0;
      state.eip++; break;
    }
    case 'pop': {
      const [dst] = args; const val = state.stack.pop() ?? 0;
      console.log("POP ->", dst, toHex(val));
      setReg(dst, val >>> 0);
      state.regs.ESP = (state.regs.ESP + 4) >>> 0;
      state.eip++; break;
    }
    case 'cmp': {
      const [a,b] = args;
      const res = (getVal(a) - getVal(b)) >>> 0;
      console.log("CMP", a, "vs", b, "res", toHex(res));
      aluFlags(res);
      state.eip++; break;
    }
    case 'je': {
      const [label] = args;
      console.log("JE (ZF=", state.flags.ZF, ") to", label);
      if (state.flags.ZF===1) { jumpTo(label); } else { state.eip++; }
      break;
    }
    case 'jnz': {
      const [label] = args;
      console.log("JNZ (ZF=", state.flags.ZF, ") to", label);
      if (state.flags.ZF === 0) {
        jumpTo(label);
      } else {
        state.eip++;
      }
      break;
    }
    case 'nop': { console.log("NOP"); state.eip++; break; }
    default: { console.warn("Unknown mn:", mn); state.eip++; }
  }
  renderAll(); // redraw after each step
}

function jumpTo(label) {
  const target = state.program.findIndex(l => l.trim().toLowerCase() === (label.toLowerCase()+':'));
  console.log("jumpTo", label, "->", target);
  state.eip = target >= 0 ? target+1 : state.eip+1;
}

// --- Demo loader wired to dropdown ---
function loadDemo() {
  const select = document.getElementById('demoSelect');
  const choice = (select && select.value) ? select.value : 'arithmetic';
  if (!demos[choice]) { alert('That demo is not available yet.'); return; }

  Object.assign(state, {
    eip: 0,
    regs: { EAX:0, EBX:0, ECX:0, EDX:0, ESI:0, EDI:0, EBP:0x1000, ESP:0x1000 },
    flags: { CF:0, ZF:0, SF:0, OF:0, PF:0, AF:0 },
    mem: new Map(),
    stack: [],
    program: demos[choice].slice()
  });

  console.log("Loaded demo:", choice, state.program);
  renderAll();
}

function reset() {
  console.log("Reset");
  state.eip = 0;
  state.stack = [];
  state.regs.ESP = 0x1000;
  renderAll();
}

// --- Wire controls (ensure these exist before calling renderAll) ---
const stepBtn = document.getElementById('stepBtn');
const resetBtn = document.getElementById('resetBtn');
document.getElementById('loadDemo').addEventListener('click', loadDemo);
stepBtn.addEventListener('click', step);
resetBtn.addEventListener('click', reset);

// Expose helpers for console poking
window._dbg = { state, step, loadDemo, renderAll };

// initial render (empty until you click Load)
renderAll();
