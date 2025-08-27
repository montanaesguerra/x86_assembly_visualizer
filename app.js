<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Assembly Visualizer – Starter</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <header>
      <h1>Assembly Visualizer • x86 (32‑bit) – Starter</h1>
      <div class="controls">
        <button id="loadDemo">Load demo</button>
        <button id="stepBtn" disabled>Step ▶</button>
        <button id="resetBtn" class="btn-secondary" disabled>Reset ↺</button>
      </div>
    </header>

    <main class="grid">
      <!-- Column 1: Instructions -->
      <section class="panel" id="col-asm">
        <header><h2>Instructions</h2></header>
        <div class="panel-body">
          <ol class="asm-list" id="asmList"></ol>
          <p class="hint">Tip: highlight shows the current instruction (EIP). Add/edit instructions in <code>program</code> inside the script.</p>
        </div>
      </section>

      <!-- Column 2: Registers & Flags -->
      <section class="panel" id="col-regs">
        <header><h2>Registers & Flags</h2></header>
        <div class="panel-body" id="regsBody">
          <!-- Registers injected by JS -->
          <div class="flags" id="flags"></div>
          <p class="hint">Flags light up when set. (CF, ZF, SF, OF, PF, AF)</p>
        </div>
      </section>

      <!-- Column 3: Memory Placeholder -->
      <section class="panel" id="col-mem">
        <header><h2>Memory (placeholder)</h2></header>
        <div class="panel-body">
          <table class="mem-table" id="memTable">
            <thead>
              <tr><th>Address</th><th>Bytes</th><th>Ascii</th></tr>
            </thead>
            <tbody></tbody>
          </table>
          <p class="hint">This is a simple linear view (not real paging). Use <code>writeMem(addr, bytes)</code> in JS to demo effects like <code>mov ebx, [eax]</code>.</p>
        </div>
      </section>

      <!-- Column 4: Stack -->
      <section class="panel" id="col-stack">
        <header><h2>Stack (conceptual)</h2></header>
        <div class="panel-body">
          <div class="stack-meta">Top of stack is at the bottom. <code>push</code> adds, <code>pop</code> removes.</div>
          <div class="stack" id="stack"></div>
          <p class="hint">In x86, the stack grows downward in memory. Here we visualize growth downward but display the top-most element at the bottom for readability.</p>
        </div>
      </section>
    </main>

    <script src="app.js"></script>
  </body>
</html>
