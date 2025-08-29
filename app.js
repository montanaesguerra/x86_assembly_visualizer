console.log("app.js LOADED v10", new Date().toISOString());

// --- Minimal teaching model (not a real CPU) ---
const state = {
  eip: 0,
  regs: { EAX: 0, EBX: 0, ECX: 0, EDX: 0, ESI: 0, EDI: 0, EBP: 0, ESP: 0x1000 },
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
  ]
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
function renderRegs() {
  const keys = ['EAX','EBX','ECX','EDX','ESI','EDI','EBP','ESP','EIP'];
  const values = { ...state.regs, EIP: state.eip };
  const frag = document.createDocumentFragment();
  keys.forEach(k => {
    const row = document.createElement('div');
    row.className = 'kv';
    row.innerHTML = `<b>${k}</b><span>${toHex(values[k]||0)}</span>`;
    frag.appendChild(row);
  });
  const preservedFlagsEl = document.getElementById('flags');
  regsBody.innerHTML = '';
  regsBody.appendChild(frag);
  regsBody.appendChild(preservedFlagsEl);
}

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
  const addrs = [...state.mem.keys()].sort((a,b)=>a-b).slice(0, 32);
  for (let i = 0; i < addrs.length; i += 8) {
    const rowAddrs = addrs.slice(i, i+8);
    if (rowAddrs.length === 0) break;
    const start = rowAddrs[0];
    const bytes = rowAddrs.map(a => state.mem.get(a) ?? 0);
    const ascii = bytes.map(b => (b>=32&&b<127)?String.fromCharCode(b):'.').join('');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="addr">${toHex(start, 8)}</td><td>${bytes.map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ')}</td><td>${ascii}</td>`;
    memTableBody.appendChild(tr);
  }
}

// helpers to write memory (byte array)
function writeMem(addr, bytes) { bytes.forEach((b,i)=> state.mem.set(addr+i, b & 0xFF)); }

// Column 4: stack
const stackEl = document.getElementById('stack');
function renderStack() {
  stackEl.innerHTML = '';
  state.stack.forEach((val) => {
    const d = document.createElement('div');
    d.className = 'stack-item';
    d.innerHTML = `<div>${toHex(val)}</div>`;
    stackEl.appendChild(d);
  });
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
      const val = getVal(src);
      console.log("MOV", dst, "<-", toHex(val));
      setReg(dst, val);
      state.eip++; break;
    }
    case 'add': {
      const [dst, src] = args;
      const val = (getVal(dst) + getVal(src)) >>> 0;
      console.log("ADD", dst, "=", toHex(val));
      setReg(dst, val);
      aluFlags(val);
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
    regs: { EAX:0, EBX:0, ECX:0, EDX:0, ESI:0, EDI:0, EBP:0, ESP:0x1000 },
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
