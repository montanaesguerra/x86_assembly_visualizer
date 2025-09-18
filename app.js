console.log("app.js LOADED v15", new Date().toISOString());

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
    'done:',
    'nop'
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
    'done:',
    'nop'
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
    'done:',
    'nop'
  ],
  stack: [
    //Stack instructions
    'push ebp ; Saves the callers base pointer',
    'mov ebp, esp ; Set the new base pointer to the current stack pointer',
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
    'pop edx',
    'mov esp, ebp ; Restore RSP to the value it had before local variables were allocated',
    'pop ebp ; Restore the callers EBP',
    'ret ; Return to the calling function'
  ],
  Print: [
    //Print String Instructions

    'mov edi, 0x2000', //destination cursor

    
    'mov [edi], 0x52', 'inc edi',
    'mov [edi], 0x65', 'inc edi',
    'mov [edi], 0x6C', 'inc edi',
    'mov [edi], 0x65', 'inc edi',
    'mov [edi], 0x61', 'inc edi',
    'mov [edi], 0x73', 'inc edi',
    'mov [edi], 0x65', 'inc edi',

    'mov [edi], 0x20', 'inc edi',

    'mov [edi], 0x74', 'inc edi',
    'mov [edi], 0x68', 'inc edi',
    'mov [edi], 0x65', 'inc edi',

    'mov [edi], 0x20', 'inc edi',

    'mov [edi], 0x77', 'inc edi',
    'mov [edi], 0x68', 'inc edi',
    'mov [edi], 0x69', 'inc edi',
    'mov [edi], 0x74', 'inc edi',
    'mov [edi], 0x65', 'inc edi',

    'mov [edi], 0x20', 'inc edi',

    'mov [edi], 0x70', 'inc edi',
    'mov [edi], 0x61', 'inc edi',
    'mov [edi], 0x70', 'inc edi',
    'mov [edi], 0x65', 'inc edi',
    'mov [edi], 0x72', 'inc edi',

    'mov [edi], 0x0A', 'inc edi',
    'mov [edi], 0x00',           

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
    'equal:',
    'mov ecx, 2',
    'done:',
    'nop'
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
  Calling_Functions_DEMO: [
    '; Caller sets a=4, b=7; This function adds a + b + 1. We expect EAX=12 on return',
    'main:',
    'mov ecx, 4               ; a ',
    'mov edx, 7               ; b ',
    'push 7                   ; push b',
    'push 4                   ; push a',
    'call sum_plus_one',
    'add  esp, 8              ; cdecl: caller cleans args',
    '; EAX should be 12 here',
    'jmp  done',

    'sum_plus_one:',
    'push ebp                 ; prologue',
    'mov  ebp, esp',
    'push ebx                 ; use the stack to save callee-saved EBX',
    'mov  ebx, ecx            ; ebx = a',
    'add  ebx, edx            ; ebx = a + b',
    'mov  eax, ebx            ; eax = a + b',
    'add  eax, 1              ; eax = a + b + 1',
    'pop  ebx                 ; restore callee-saved',
    'mov  esp, ebp            ; epilogue',
    'pop  ebp',
    'ret',

    'done:',
    'nop'
  ],
  CALL_RET_Basics: [
    '; CALL/RET basics: CALL pushes return address; RET pops it',
    'main:',
    'mov eax, 1',
    'call 1',             // pushes return index, jumps to foo
    'add eax, 1',           // resumes here after RET
    'jmp done',
    '1:',
    'mov ebx, 0xDEADBEEF',  // arbitrary work
    'mov eax, 41',
    'ret',
    'done:',
    'nop'
  ],
  CALL_RET_cdecl: [
    '; cdecl: caller pushes args and cleans stack with add esp, 8',
    'mov ecx, 2',
    'mov edx, 3',
    'push 3',               // arg2
    'push 2',               // arg1
    'call add2_cdecl',      // pushes return index
    'add esp, 8',           // caller cleans 2 args (and UI pops them if you added the ESP tweak)
    'jmp done',
    'add2_cdecl:',
    'push ebp',
    'mov ebp, esp',
    '; compute using ECX+EDX to keep focus on CALL/RET mechanics',
    'mov eax, ecx',
    'add eax, edx',
    'mov esp, ebp',
    'pop ebp',
    'ret',
    'done:', 
    'nop'
  ],
  CALL_RET_stdcall: [
    '; stdcall: callee cleans with ret 8',
    'mov ecx, 5',
    'mov edx, 7',
    'push 7',               // arg2
    'push 5',               // arg1
    'call add2_stdcall',
    'jmp done',
    'add2_stdcall:',
    'push ebp',
    'mov ebp, esp',
    'mov eax, ecx',
    'add eax, edx',
    'mov esp, ebp',
    'pop ebp',
    'ret 8',                // callee drops 2 args (8 bytes) + pops return index
    'done:',
    'nop'
  ],
  CTF_Bonus1_C_Addition: [
    '; equivalent to int add(int a, int b)',
    'mov ecx, 1',
    'mov edx, 2',
    'push 2',
    'push 1',
    'call add_demo',
    'add esp, 8 ; caller cleans (cdecl)',
    'jmp done',

    'add_demo:',
    'push ebp',
    'mov ebp, esp',
    'mov eax, ecx ;eax = a(1)',
    'add eax, edx ;eax = a+b (3)',
    'mov esp, ebp',
    'pop ebp',
    'ret',
    'done:',
    'nop'
  ],
  CTF_A1_Arithmetic_AddXorSub: [
    '; A1 — Arithmetic & MOV',
    '; Init: EAX=5, EBX=2. Q: final EAX, EBX, ZF?',
    'mov eax, 5',
    'mov ebx, 2',
    'add eax, ebx',
    'xor ebx, ebx',
    'sub eax, 1',
    'done:',
    'nop'
  ],
  // CTF_A1_Arithmetic_AddXorSub_ANS: [
  //   '; A1 — ANSWER',
  //   'mov eax, 5',
  //   'mov ebx, 2',
  //   'add eax, ebx',
  //   'xor ebx, ebx',
  //   'sub eax, 1',
  //   '; ANSWER: EAX=6, EBX=0, ZF=0',
  //   'done: nop'
  // ],

  CTF_A2_Arithmetic_LEA: [
    '; A2 — LEA address math',
    '; Init: EAX=0x10, ECX=3. Q: EDX (hex)?',
    'mov eax, 0x10',
    'mov ecx, 3',
    'lea edx, [eax + ecx*4 + 8]',
    'done:',
    'nop'
  ],
  // CTF_A2_Arithmetic_LEA_ANS: [
  //   '; A2 — ANSWER',
  //   'mov eax, 0x10',
  //   'mov ecx, 3',
  //   'lea edx, [eax + ecx*4 + 8]',
  //   '; ANSWER: EDX=0x24',
  //   'done: nop'
  // ],

  CTF_A3_IncFlags: [
    '; A3 — INC wraps and sets ZF',
    '; Init: EAX=0xFFFFFFFF. Q: EAX, ZF?',
    'mov eax, 0xFFFFFFFF',
    'inc eax',
    'done:',
    'nop'
  ],
  // CTF_A3_IncFlags_ANS: [
  //   '; A3 — ANSWER',
  //   'mov eax, 0xFFFFFFFF',
  //   'inc eax',
  //   '; ANSWER: EAX=0x00000000, ZF=1',
  //   'done: nop'
  // ],

  CTF_A4_CmpFlags: [
    '; A4 — CMP flags',
    '; Init: EAX=2, EBX=5. Q: ZF, SF, CF after cmp?',
    'mov eax, 2',
    'mov ebx, 5',
    'cmp eax, ebx',
    'done:',
    'nop'
  ],
  // CTF_A4_CmpFlags_ANS: [
  //   '; A4 — ANSWER',
  //   'mov eax, 2',
  //   'mov ebx, 5',
  //   'cmp eax, ebx',
  //   '; ANSWER: ZF=0, SF=1, CF=1',
  //   'done: nop'
  // ],

  /* --- Stack Basics --- */
  CTF_B1_PushStore: [
    '; B1 — PUSH stores value on stack',
    '; Init: ESP=0x1000, EAX=0xDEADBEEF. Q: ESP and [ESP]?',
    'mov esp, 0x1000',
    'mov eax, 0xDEADBEEF',
    'push eax',
    'done:',
    'nop'
  ],
  // CTF_B1_PushStore_ANS: [
  //   '; B1 — ANSWER',
  //   'mov esp, 0x1000',
  //   'mov eax, 0xDEADBEEF',
  //   'push eax',
  //   '; ANSWER: ESP=0x0FFC, [ESP]=0xDEADBEEF',
  //   'done: nop'
  // ],

  CTF_B2_PushImmPop: [
    '; B2 — push imm, pop into EBX',
    '; Continues idea: Q: EBX and ESP?',
    'mov esp, 0x0FFC',
    'push 0x11223344',
    'pop ebx',
    'done:',
    'nop'
  ],
  // CTF_B2_PushImmPop_ANS: [
  //   '; B2 — ANSWER',
  //   'mov esp, 0x0FFC',
  //   'push 0x11223344',
  //   'pop ebx',
  //   '; ANSWER: EBX=0x11223344, ESP=0x0FFC',
  //   'done: nop'
  // ],

  CTF_B3_PushPushPopPop: [
    '; B3 — order of pops',
    '; Init: ESP=0x2000. Q: EAX, EBX, ESP?',
    'mov esp, 0x2000',
    'push 1',
    'push 2',
    'pop eax',
    'pop ebx',
    'done:',
    'nop'
  ],
  // CTF_B3_PushPushPopPop_ANS: [
  //   '; B3 — ANSWER',
  //   'mov esp, 0x2000',
  //   'push 1',
  //   'push 2',
  //   'pop eax',
  //   'pop ebx',
  //   '; ANSWER: EAX=2, EBX=1, ESP=0x2000',
  //   'done: nop'
  // ],

  CTF_B4_AddESP: [
    '; B4 — add esp, N',
    '; Init: ESP=0x3000. Q: ESP?',
    'mov esp, 0x3000',
    'add esp, 12',
    'done:',
    'nop'
  ],
  // CTF_B4_AddESP_ANS: [
  //   '; B4 — ANSWER',
  //   'mov esp, 0x3000',
  //   'add esp, 12',
  //   '; ANSWER: ESP=0x300C',
  //   'done: nop'
  // ],

  /* --- CALL/RET & Frames --- */
  CTF_C1_cdecl_BeforeCleanup: [
    '; C1 — cdecl: inspect state right after RET (before add esp,8)',
    '; Start ESP=0x1000. Q: EAX, ESP right after RET returns?',
    'mov esp, 0x1000',
    'push 2',
    'push 1',
    'call add_demo',
    'jmp after_ret',        // skip caller cleanup so we can inspect
    'add esp, 8',
    'after_ret:',
    'nop',
    'add_demo:',
    'push ebp',
    'mov ebp, esp',
    '; (using constants to focus on CALL/RET mechanics)',
    'mov eax, 1',
    'add eax, 2',
    'mov esp, ebp',
    'pop ebp',
    'ret'
  ],
  // CTF_C1_cdecl_BeforeCleanup_ANS: [
  //   '; C1 — ANSWER',
  //   'mov esp, 0x1000',
  //   'push 2',
  //   'push 1',
  //   'call add_demo',
  //   'jmp after_ret',
  //   'add esp, 8',
  //   'after_ret: nop',
  //   'add_demo:',
  //   'push ebp',
  //   'mov ebp, esp',
  //   'mov eax, 1',
  //   'add eax, 2',
  //   'mov esp, ebp',
  //   'pop ebp',
  //   'ret',
  //   '; ANSWER: after RET: EAX=3, ESP=0x0FF8',
  // ],

  CTF_C2_stdcall_Ret8: [
    '; C2 — stdcall: callee cleans with ret 8',
    '; Start ESP=0x1000. Q: ESP after return?',
    'mov esp, 0x1000',
    'push 2',
    'push 1',
    'call add_stdcall',
    'done:',
    'nop',
    'add_stdcall:',
    'push ebp',
    'mov ebp, esp',
    'mov eax, 1',
    'add eax, 2',
    'mov esp, ebp',
    'pop ebp',
    'ret 8'
  ],
  // CTF_C2_stdcall_Ret8_ANS: [
  //   '; C2 — ANSWER',
  //   'mov esp, 0x1000',
  //   'push 2',
  //   'push 1',
  //   'call add_stdcall',
  //   'done: nop',
  //   'add_stdcall:',
  //   'push ebp',
  //   'mov ebp, esp',
  //   'mov eax, 1',
  //   'add eax, 2',
  //   'mov esp, ebp',
  //   'pop ebp',
  //   'ret 8',
  //   '; ANSWER: ESP=0x1000 after RET 8',
  // ],

  CTF_C3_LeaveRetExplain: [
    '; C3 — leave + ret behavior',
    '; Q: In words, what does leave do to ESP/EBP?',
    'push ebp',
    'mov ebp, esp',
    'sub esp, 0x10',
    '; ... (work)',
    'leave',
    'ret'
  ],
  // CTF_C3_LeaveRetExplain_ANS: [
  //   '; C3 — ANSWER',
  //   'push ebp',
  //   'mov ebp, esp',
  //   'sub esp, 0x10',
  //   'leave',
  //   'ret',
  //   '; ANSWER: leave = mov esp, ebp; pop ebp',
  // ],

  /* --- Branching / Conditionals --- */
  CTF_D1_JG_Jmp: [
    '; D1 — jg path',
    '; Init: EAX=5, EBX=7. Q: ECX?',
    'mov eax, 5',
    'mov ebx, 7',
    'cmp eax, ebx',
    'jg greater',
    'mov ecx, 1',
    'jmp done',
    'greater:',
    'mov ecx, 2',
    'done:',
    'nop'
  ],
  // CTF_D1_JG_Jmp_ANS: [
  //   '; D1 — ANSWER',
  //   'mov eax, 5',
  //   'mov ebx, 7',
  //   'cmp eax, ebx',
  //   'jg greater',
  //   'mov ecx, 1',
  //   'jmp done',
  //   'greater:',
  //   'mov ecx, 2',
  //   'done: nop',
  //   '; ANSWER: ECX=1',
  // ],

  CTF_D2_JNE_Equal: [
    '; D2 — jne not taken if equal',
    '; Init: EAX=7, EBX=7. Q: EDX?',
    'mov eax, 7',
    'mov ebx, 7',
    'cmp eax, ebx',
    'jne noteq',
    'mov edx, 0xAA',
    'jmp done',
    'noteq:',
    'mov edx, 0xBB',
    'done:',
    'nop'
  ],
  // CTF_D2_JNE_Equal_ANS: [
  //   '; D2 — ANSWER',
  //   'mov eax, 7',
  //   'mov ebx, 7',
  //   'cmp eax, ebx',
  //   'jne noteq',
  //   'mov edx, 0xAA',
  //   'jmp done',
  //   'noteq:',
  //   'mov edx, 0xBB',
  //   'done: nop',
  //   '; ANSWER: EDX=0xAA',
  // ],

  CTF_D3_TEST_JZ: [
    '; D3 — test/jz',
    '; Init: EAX=0. Q: EBX?',
    'mov eax, 0',
    'test eax, eax',
    'jz zero',
    'mov ebx, 1',
    'jmp end',
    'zero:',
    'mov ebx, 0',
    'end:',
    'nop'
  ],
  // CTF_D3_TEST_JZ_ANS: [
  //   '; D3 — ANSWER',
  //   'mov eax, 0',
  //   'test eax, eax',
  //   'jz zero',
  //   'mov ebx, 1',
  //   'jmp end',
  //   'zero:',
  //   'mov ebx, 0',
  //   'end: nop',
  //   '; ANSWER: EBX=0',
  // ],

  CTF_D4_Signed_JG: [
    '; D4 (signed) — cmp -1 vs 0, jg?',
    '; Init: EAX=0xFFFFFFFF (-1 signed), EBX=0. Q: is jg taken?',
    'mov eax, 0xFFFFFFFF',
    'mov ebx, 0',
    'cmp eax, ebx',
    'jg signed_greater',
    'mov esi, 0',           // not taken path
    'jmp done',
    'signed_greater:',
    'mov esi, 1',           // taken path
    'done:',
    'nop'
  ],
  // CTF_D4_Signed_JG_ANS: [
  //   '; D4 (signed) — ANSWER: jg NOT taken',
  //   'mov eax, 0xFFFFFFFF',
  //   'mov ebx, 0',
  //   'cmp eax, ebx',
  //   'jg signed_greater',
  //   'mov esi, 0',
  //   'jmp done',
  //   'signed_greater:',
  //   'mov esi, 1',
  //   'done: nop',
  //   '; ANSWER: ESI=0 (since -1 > 0 is false)'
  // ],

  CTF_D4_Unsigned_JA: [
    '; D4 (unsigned) — cmp 0xFFFFFFFF vs 0, ja?',
    '; Init: same values, unsigned compare. Q: is ja taken?',
    'mov eax, 0xFFFFFFFF',
    'mov ebx, 0',
    'cmp eax, ebx',
    'ja unsigned_above',
    'mov edi, 0',
    'jmp done',
    'unsigned_above:',
    'mov edi, 1',
    'done:',
    'nop'
  ],
  // CTF_D4_Unsigned_JA_ANS: [
  //   '; D4 (unsigned) — ANSWER: ja taken',
  //   'mov eax, 0xFFFFFFFF',
  //   'mov ebx, 0',
  //   'cmp eax, ebx',
  //   'ja unsigned_above',
  //   'mov edi, 0',
  //   'jmp done',
  //   'unsigned_above:',
  //   'mov edi, 1',
  //   'done: nop',
  //   '; ANSWER: EDI=1 (0xFFFFFFFF > 0 unsigned)'
  // ],

  /* --- Addressing & LEA (kept memory-free for compatibility) --- */
  CTF_E1_LEA_ScalePlus: [
    '; E1 — emulate [ebp+8]=4 via immediate; focus on LEA math',
    '; Init: a=4. Q: EAX=a (=4), EDX=(a*4+8)=?',
    'mov eax, 4',
    'lea edx, [eax*4 + 8]',
    'done:',
    'nop'
  ],
  // CTF_E1_LEA_ScalePlus_ANS: [
  //   '; E1 — ANSWER',
  //   'mov eax, 4',
  //   'lea edx, [eax*4 + 8]',
  //   '; ANSWER: EAX=4, EDX=24',
  //   'done: nop'
  // ],

  CTF_E2_LEA_BaseIndexDisp: [
    '; E2 — LEA with base+index*4+disp (no memory read)',
    '; Init: EAX=0x1000, ECX=3. Q: EDX address?',
    'mov eax, 0x1000',
    'mov ecx, 3',
    'lea edx, [eax + ecx*4 + 8]',
    'done:',
    'nop'
  ],
  // CTF_E2_LEA_BaseIndexDisp_ANS: [
  //   '; E2 — ANSWER',
  //   'mov eax, 0x1000',
  //   'mov ecx, 3',
  //   'lea edx, [eax + ecx*4 + 8]',
  //   '; ANSWER: EDX=0x1014',
  //   'done: nop'
  // ],

  /* --- Flags Focus --- */
  CTF_F1_AddOverflow: [
    '; F1 — signed overflow example',
    '; Init: EAX=0x7FFFFFFF. Q: EAX, OF, CF, SF, ZF?',
    'mov eax, 0x7FFFFFFF',
    'add eax, 1',
    'done:',
    'nop'
  ],
  // CTF_F1_AddOverflow_ANS: [
  //   '; F1 — ANSWER',
  //   'mov eax, 0x7FFFFFFF',
  //   'add eax, 1',
  //   '; ANSWER: EAX=0x80000000, OF=1, CF=0, SF=1, ZF=0',
  //   'done: nop'
  // ],

  CTF_F2_SubBorrow: [
    '; F2 — borrow on SUB',
    '; Init: EAX=0x00000000. Q: EAX, CF, OF, SF, ZF?',
    'mov eax, 0x00000000',
    'sub eax, 1',
    'done:',
    'nop'
  ],
  // CTF_F2_SubBorrow_ANS: [
  //   '; F2 — ANSWER',
  //   'mov eax, 0x00000000',
  //   'sub eax, 1',
  //   '; ANSWER: EAX=0xFFFFFFFF, CF=1, OF=0, SF=1, ZF=0',
  //   'done: nop'
  // ],

  /* --- Mini CTF Puzzles --- */
  CTF_G1_Sum1to3: [
    '; G1 — sum 1..3 with a loop',
    '; Q: final EAX?',
    'mov eax, 0',
    'mov ecx, 1',
    'loop:',
    'add eax, ecx',
    'inc ecx',
    'cmp ecx, 4',
    'jl loop',
    'done:',
    'nop'
  ],
  // CTF_G1_Sum1to3_ANS: [
  //   '; G1 — ANSWER',
  //   'mov eax, 0',
  //   'mov ecx, 1',
  //   'loop:',
  //   'add eax, ecx',
  //   'inc ecx',
  //   'cmp ecx, 4',
  //   'jl loop',
  //   '; ANSWER: EAX=6',
  //   'done: nop'
  // ],

  CTF_G2_EqualityBranch: [
    '; G2 — two outcomes by equality',
    '; Init: EBX=5. Q: EDX?',
    'mov ebx, 5',
    'cmp ebx, 5',
    'jne notfive',
    'mov edx, 0xBEEF',
    'jmp done',
    'notfive:',
    'mov edx, 0xFEED',
    'done:',
    'nop'
  ],
  // CTF_G2_EqualityBranch_ANS: [
  //   '; G2 — ANSWER',
  //   'mov ebx, 5',
  //   'cmp ebx, 5',
  //   'jne notfive',
  //   'mov edx, 0xBEEF',
  //   'jmp done',
  //   'notfive:',
  //   'mov edx, 0xFEED',
  //   'done: nop',
  //   '; ANSWER: EDX=0xBEEF'
  // ],

  CTF_G3_CallRet_Inspect: [
    '; G3 — CALL/RET, inspect before caller cleanup',
    '; Start ESP=0x4000. Q: after RET (before add esp,8), EAX and ESP?',
    'mov esp, 0x4000',
    'push 3',
    'push 4',
    'call add_two',
    'jmp after_ret',       // inspect here before cleanup
    'add esp, 8',
    'after_ret:',
    'nop',
    'add_two:',
    'push ebp',
    'mov ebp, esp',
    'mov eax, 4',
    'add eax, 3',
    'mov esp, ebp',
    'pop ebp',
    'ret'
  ],
  // CTF_G3_CallRet_Inspect_ANS: [
  //   '; G3 — ANSWER',
  //   'mov esp, 0x4000',
  //   'push 3',
  //   'push 4',
  //   'call add_two',
  //   'jmp after_ret',
  //   'add esp, 8',
  //   'after_ret: nop',
  //   'add_two:',
  //   'push ebp',
  //   'mov ebp, esp',
  //   'mov eax, 4',
  //   'add eax, 3',
  //   'mov esp, ebp',
  //   'pop ebp',
  //   'ret',
  //   '; ANSWER: EAX=7, ESP=0x3FF8 after RET (caller later does add esp,8)',
  // ]


};

// --- Utilities & rendering ---
function toHex(v, pad=8) { return '0x' + (v >>> 0).toString(16).toUpperCase().padStart(pad,'0'); }

// --- Flag helpers with real carry/borrow semantics ---
function setFlagsAdd32(a, b, res) {
  a >>>= 0; b >>>= 0; res >>>= 0;
  state.flags.ZF = (res === 0) ? 1 : 0;
  state.flags.SF = (res >>> 31) & 1;
  state.flags.CF = (res < a) ? 1 : 0;                 // unsigned carry out
  const sa = (a >>> 31) & 1, sb = (b >>> 31) & 1, sr = (res >>> 31) & 1;
  state.flags.OF = ((~(sa ^ sb) & (sa ^ sr)) & 1);    // signed overflow
  state.flags.PF = 0; state.flags.AF = 0;
}

function setFlagsSub32(a, b, res) {
  a >>>= 0; b >>>= 0; res >>>= 0;
  state.flags.ZF = (res === 0) ? 1 : 0;
  state.flags.SF = (res >>> 31) & 1;
  state.flags.CF = (a < b) ? 1 : 0;                   // unsigned borrow
  const sa = (a >>> 31) & 1, sb = (b >>> 31) & 1, sr = (res >>> 31) & 1;
  state.flags.OF = (((sa ^ sb) & (sa ^ sr)) & 1);     // signed overflow
  state.flags.PF = 0; state.flags.AF = 0;
}

// 8-bit variant for byte memory ops, if you want CF correct there too
function setFlagsAdd8(a, b, res) {
  a &= 0xFF; b &= 0xFF; res &= 0xFF;
  state.flags.ZF = (res === 0) ? 1 : 0;
  state.flags.SF = (res >>> 7) & 1;
  state.flags.CF = (a + b > 0xFF) ? 1 : 0;
  const sa = (a >>> 7) & 1, sb = (b >>> 7) & 1, sr = (res >>> 7) & 1;
  state.flags.OF = ((~(sa ^ sb) & (sa ^ sr)) & 1);
  state.flags.PF = 0; state.flags.AF = 0;
}

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
    // case 'add': {
    //   const [dst, src] = args;
    //   const memAddr = parseMemAddr(dst);

    //   if (memAddr !== null) {
    //     const cur = readByte(memAddr);
    //     const next = (cur + (getVal(src) & 0xFF)) & 0xFF;

    //     console.log("ADD BYTE [", dst, "] =", toHex(next, 2), "(from", toHex(cur,2), "+", toHex(getVal(src)&0xFF,2),")");
    //     writeByte(memAddr, next);

    //     // flags from byte result (teaching simplification)

    //     state.flags.ZF = next === 0 ? 1 : 0;
    //     state.flags.SF = (next & 0x80) ? 1:0;
    //     state.flags.OF = 0; state.flags.CF = 0; state.flags.PF = 0; state.flags.AF = 0;
    //   } else {
    //     const val = (getVal(dst) + getVal(src)) >>> 0;
    //     console.log("Add", dst, "=", toHex(val));
    //     setReg(dst, val);

    //     // If adding to ESP, also pop N/4 items from the stack UI
    //     const dstUpper = (dst || '').trim().toUpperCase();
    //     if (dstUpper === 'ESP') {
    //       const inc = getVal(src) >>> 0;
    //       const drop = Math.floor(inc / 4);
    //       for (let i = 0; i < drop; i++) state.stack.pop();
    //     }
    //     state.flags.ZF = (val>>>0) === 0 ? 1:0;
    //     state.flags.SF = (val & 0x80000000) ? 1:0;
    //     state.flags.OF = 0; state.flags.CF = 0; state.flags.PF = 0; state.flags.AF = 0;
    //   }
    //   state.eip++; break;
    // }
    case 'add': {
      const [dst, src] = args;
      const memAddr = parseMemAddr(dst);

      if (memAddr !== null) {
        const cur = readByte(memAddr) & 0xFF;
        const inc = getVal(src) & 0xFF;
        const next = (cur + inc) & 0xFF;
        console.log("ADD BYTE [", dst, "] =", toHex(next, 2), "(from", toHex(cur,2), "+", toHex(inc,2),")");
        writeByte(memAddr, next);
        setFlagsAdd8(cur, inc, next);   // <-- real 8-bit CF/OF/ZF/SF
      } else {
        const a = getVal(dst) >>> 0;
        const b = getVal(src) >>> 0;
        const val = (a + b) >>> 0;
        console.log("ADD", dst, "=", toHex(val));
        setReg(dst, val);

        // Visual stack tidy for "add esp, N"
        const dstUpper = (dst || '').trim().toUpperCase();
        if (dstUpper === 'ESP') {
          const inc = b >>> 0;
          const drop = Math.floor(inc / 4);
          for (let i = 0; i < drop; i++) state.stack.pop();
        }

        setFlagsAdd32(a, b, val);       // <-- real 32-bit CF/OF/ZF/SF
      }
      state.eip++; break;
    }
    // case 'sub': {
    //   const [dst, src] = args;
    //   const val = (getVal(dst) - getVal(src)) >>> 0; // 32-bit unsigned result
    //   console.log("SUB", dst, "=", toHex(val));
    //   setReg(dst, val);
    //   aluFlags(val);
    //   state.eip++; break;
    // }
    case 'sub': {
      const [dst, src] = args;
      const a = getVal(dst) >>> 0;
      const b = getVal(src) >>> 0;
      const val = (a - b) >>> 0;
      console.log("SUB", dst, "=", toHex(val));
      setReg(dst, val);
      setFlagsSub32(a, b, val);     // <-- sets CF for borrow when a<b
      state.eip++; break;
    }
    // case 'inc': {
    //   const [dst] = args;
    //   const val = (getVal(dst) + 1) >>> 0;
    //   console.log("INC", dst)
    //   setReg(dst, val); aluFlags(val); state.eip++; break;
    // }
    // case 'dec': {
    //   const [dst] = args;
    //   const val = (getVal(dst) - 1) >>> 0;
    //   console.log("DEC", dst)
    //   setReg(dst, val); aluFlags(val); state.eip++; break;

    // }
    case 'inc': {
      const [dst] = args;
      const a = getVal(dst) >>> 0;
      const val = (a + 1) >>> 0;
      setReg(dst, val);
      state.flags.ZF = (val === 0) ? 1 : 0;
      state.flags.SF = (val >>> 31) & 1;
      state.flags.OF = (a === 0x7FFFFFFF) ? 1 : 0; // only case where signed +1 overflows
      // CF unchanged
      state.flags.PF = 0; state.flags.AF = 0;
      state.eip++; break;
    }
    case 'dec': {
      const [dst] = args;
      const a = getVal(dst) >>> 0;
      const val = (a - 1) >>> 0;
      setReg(dst, val);
      state.flags.ZF = (val === 0) ? 1 : 0;
      state.flags.SF = (val >>> 31) & 1;
      state.flags.OF = (a === 0x80000000) ? 1 : 0; // only case where signed -1 overflows
      // CF unchanged
      state.flags.PF = 0; state.flags.AF = 0;
      state.eip++; break;
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
    // case 'cmp': {
    //   const [a,b] = args;
    //   const res = (getVal(a) - getVal(b)) >>> 0;
    //   console.log("CMP", a, "vs", b, "res", toHex(res));
    //   aluFlags(res);
    //   state.eip++; break;
    // }
    case 'cmp': {
      const [aOp, bOp] = args;
      const a = getVal(aOp) >>> 0;
      const b = getVal(bOp) >>> 0;
      const res = (a - b) >>> 0;
      console.log("CMP", aOp, "vs", bOp, "res", toHex(res));
      setFlagsSub32(a, b, res);     // <-- identical flags to SUB (no write-back)
      state.eip++; break;
    }
    case 'call': {
      // CALL label: push return index, adjust ESP, then jump to label
      const [target] = args;
      const retIdx = (state.eip + 1) >>> 0;   // “return address” = next instruction index
      state.stack.push(retIdx);
      state.regs.ESP = (state.regs.ESP - 4) >>> 0;
      console.log('CALL', target, 'push ret', retIdx);
      jumpTo(target);
      break;
    }
    case 'ret': {
      // RET [imm16]: pop return index into EIP; if imm, callee cleans args
      const imm = args && args[0] ? (getVal(args[0]) >>> 0) : 0;
      const ret = state.stack.pop() ?? 0;
      state.regs.ESP = (state.regs.ESP + 4) >>> 0;
      console.log('RET to', ret, 'clean', imm, 'bytes');

      if (imm) {
        const drop = Math.floor(imm / 4);
        for (let i = 0; i < drop; i++) state.stack.pop(); // pop visuals for args
        state.regs.ESP = (state.regs.ESP + imm) >>> 0;    // ESP += imm
      }
      state.eip = ret >>> 0;   // jump back to caller
      break;
    }
    case 'jmp': {
      const [label] = args;
      console.log("JMP to", label);
      jumpTo(label);   // uses your existing label resolver
      break;
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
    case 'leave': {
      // leave == mov esp, ebp; pop ebp
      setReg('ESP', state.regs.EBP >>> 0);
      const v = state.stack.pop() ?? 0;
      setReg('EBP', v >>> 0);
      state.regs.ESP = (state.regs.ESP + 4) >>> 0;
      state.eip++;
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
