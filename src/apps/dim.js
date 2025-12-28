// DimApp: test application showing screen dimensions and borders
// Displays:
//   - Repeating 1-0 digits along first/last rows and columns
//   - Current rows x cols in the center
//   - Updates on resize
//   - Exit with Ctrl+C
export class DimApp {
  constructor() {
    this.rows = 24;
    this.cols = 80;
  }

  onStart(ctx) {
    this.ctx = ctx;
    this.rows = ctx.term.rows;
    this.cols = ctx.term.cols;
    ctx.ansi(ctx.ANSI.altScreenOn());
    ctx.ansi(ctx.ANSI.clear() + ctx.ANSI.home());
    this._render();
    ctx.term.scheduleRender();
  }

  onResize(info) {
    this.rows = info.rows;
    this.cols = info.cols;
    this.ctx.ansi(this.ctx.ANSI.clear() + this.ctx.ANSI.home());
    this._render();
    this.ctx.term.scheduleRender();
  }

  _render() {
    // Top and bottom rows: digits 1-0 repeated across columns
    for (let c = 1; c <= this.cols; c++) {
      const d = String(c % 10 || 0);
      this.ctx.ansi(this.ctx.ANSI.moveTo(1, c));
      this.ctx.ansi(d);
    }

    // Left and right columns: digits 1-0 repeated down rows
    for (let r = 2; r <= this.rows ; r++) {
      const d = String(r % 10 || 0);
      this.ctx.ansi(this.ctx.ANSI.moveTo(r, 1));
      this.ctx.ansi(d);
    }

    // Bottom-right corner: 'X'
    this.ctx.ansi(this.ctx.ANSI.moveTo(this.rows, this.cols));
    this.ctx.ansi('X');

    // Center: dimensions display
    const centerRow = Math.floor(this.rows / 2);
    const dimensionStr = this.rows + " lines x " + this.cols + " chars";
    const centerCol = Math.floor((this.cols - dimensionStr.length) / 2) + 1;
    this.ctx.ansi(this.ctx.ANSI.moveTo(centerRow, centerCol));
    this.ctx.ansi(this.ctx.ANSI.cyan());
    this.ctx.ansi(dimensionStr);
    this.ctx.ansi(this.ctx.ANSI.reset());

    // Hide cursor
    this.ctx.ansi(this.ctx.ANSI.hideCursor());
  }

  onKey(e) {
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && (key === "c" || key === "C")) {
      e.preventDefault();
      this.ctx.exit();
      return;
    }
  }

  onExit() {
    this.ctx.ansi(this.ctx.ANSI.showCursor());
    this.ctx.ansi(this.ctx.ANSI.altScreenOff());
  }
}
