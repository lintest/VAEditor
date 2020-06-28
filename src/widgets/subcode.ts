import { RuntimeProcessManager, IBreakpoint, Breakpoint } from "../debug";
import { BaseWidget } from "./base";

const glyphClassBreakpoint: string = "debug-breakpoint-glyph";
const glyphClassUnverified: string = "debug-breakpoint-unverified-glyph";
const glyphClassCurrent: string = "debug-current-step-glyph";

export class SubcodeWidget extends BaseWidget {

  public id: number;
  public content: string[];
  public decoration: string;
  private textNode: HTMLElement;
  private leftNode: HTMLElement;
  private current: number = 0;

  private runtime: RuntimeProcessManager;
  private _breakpoints = {};

  private onBreakpointClick(e: MouseEvent) {
    let lineNumber = 1;
    let child = e.target as HTMLElement;
    while ((child = child.previousSibling as HTMLElement) != null) lineNumber++;
    let node = e.target as HTMLElement;
    if (node.classList.contains(glyphClassBreakpoint)) {
      node.classList.remove(glyphClassBreakpoint);
      delete this._breakpoints[lineNumber];
    } else if (node.classList.contains(glyphClassUnverified)) {
      node.classList.remove(glyphClassUnverified);
      delete this._breakpoints[lineNumber];
    } else {
      node.classList.add(glyphClassUnverified);
      this._breakpoints[lineNumber] = true;
    }
    this.runtime.updateBreakpoints();
  }

  constructor(runtime: RuntimeProcessManager, content: string) {
    super();
    this.runtime = runtime;
    this.content = content.split(/\r\n|\r|\n/);
    this.domNode = this.div('vanessa-code-widget');
    this.textNode = this.div('vanessa-code-lines', this.domNode);
    this.leftNode = this.div('vanessa-code-border', this.domNode);
    this.marginDomNode = this.div('vanessa-code-margin', this.domNode);
    this.heightInLines = this.content.length;
    for (let i = 0; i < this.heightInLines; i++) {
      let node = this.div("", this.leftNode);
      node.addEventListener("click", this.onBreakpointClick.bind(this));
    }
    monaco.editor.colorize(content, "turbo-gherkin", {})
      .then((html: string) => this.textNode.innerHTML = html);
  }

  public show(editor: monaco.editor.IStandaloneCodeEditor, lineNumber: number): number {
    this.afterLineNumber = lineNumber;
    editor.changeViewZones(changeAccessor => {
      this.id = changeAccessor.addZone(this)
    });
    this.domNode.dataset.id = String(this.id);
    this.leftNode.dataset.id = String(this.id);
    this.decoration = editor.deltaDecorations([], [{
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {},
    }])[0];
    return this.id;
  }

  public lineNumber(editor: monaco.editor.IStandaloneCodeEditor): number {
    return editor.getModel().getDecorationRange(this.decoration).endLineNumber;
  }

  public getContent(): string {
    return this.content.join("\r\n");
  }

  public getLineContent(lineNumber: number): string {
    return this.content[lineNumber - 1];
  }

  public getCurrent(): number {
    return this.current;
  }

  public next(): number {
    return this.setCurrent(this.getCurrent() + 1);
  }

  get breakpoints(): Array<IBreakpoint> {
    let breakpoints = [];
    for (let lineNumber in this._breakpoints) breakpoints.push(
      new Breakpoint(lineNumber, this.id, this._breakpoints[lineNumber])
    );
    return breakpoints;
  }

  set breakpoints(breakpoints: Array<IBreakpoint>) {
    this._breakpoints = {};
    this.leftNode.querySelectorAll("." + glyphClassBreakpoint).forEach((e: HTMLElement) => e.classList.remove(glyphClassBreakpoint));
    this.leftNode.querySelectorAll("." + glyphClassUnverified).forEach((e: HTMLElement) => e.classList.remove(glyphClassUnverified));
    if (breakpoints.length == 0) return;
    this.leftNode.querySelectorAll('div').forEach((e: HTMLElement, i: number) => {
      let b = breakpoints.find(b => b.lineNumber == i + 1 && b.codeWidget == this.id);
      if (b) {
        e.classList.add(b.enable ? glyphClassBreakpoint : glyphClassUnverified);
        this._breakpoints[b.lineNumber] = b.enable;
      }
    });
  }

  public setCurrent(lineNumber: number): number {
    this.leftNode.querySelectorAll('div').forEach((e: HTMLElement, i: number) => {
      if (i + 1 == lineNumber) e.classList.add(glyphClassCurrent);
      else e.classList.remove(glyphClassCurrent);
    });
    this.domNode.querySelectorAll('.vanessa-code-lines > span').forEach((e, i) => {
      if (i + 1 == lineNumber) e.className = "debug-current-step";
      else e.classList.remove("debug-current-step");
    });
    return this.current = 0 < lineNumber && lineNumber <= this.leftNode.childNodes.length ? lineNumber : 0;
  }

  public setStatus(status: string, lines: Array<number>) {
    this.domNode.querySelectorAll('.vanessa-code-lines > span').forEach((e, i) => {
      if (lines.indexOf(i + 1) != -1) e.className = `debug-${status}-step`;
    });
  }
}
