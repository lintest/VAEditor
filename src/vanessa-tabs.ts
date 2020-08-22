import * as dom from 'monaco-editor/esm/vs/base/browser/dom';
import { VanessaEditor } from "./vanessa-editor";
import { VanessaDiffEditor } from "./vanessa-diff-editor";
import { IVanessaEditor, createModel, VanessaEditorEvent, EventsManager } from "./common";

const $ = dom.$;

class VanessaTabItem {
  public editor: IVanessaEditor;
  public key: string;
  private title: string;
  private filename: string;
  private encoding: number;
  private owner: VanessaTabs;
  private domNode: HTMLElement;
  private domItem: HTMLElement;
  private domTitle: HTMLElement;
  private domClose: HTMLElement;

  constructor(
    owner: VanessaTabs,
    editor: IVanessaEditor,
    key: string,
    title: string,
    filename: string,
    encoding: number,
  ) {
    this.owner = owner;
    this.editor = editor;
    this.key = key;
    this.encoding = encoding;
    this.filename = filename;
    this.title = title;
    this.domNode = $("div.vanessa-tab-box");
    this.domItem = $("div.vanessa-tab-item", { title: title });
    this.domClose = $("div.vanessa-tab-close", { title: "Close" });
    this.domTitle = $("div.vanessa-tab-title");
    this.domItem.addEventListener("click", this.onSelect.bind(this), true);
    this.domClose.addEventListener("click", this.onClose.bind(this), true);
    this.domClose.innerText = "\uEA76";
    this.domTitle.innerText = title;
    this.domItem.append(this.domTitle, this.domClose);
    this.domNode.append(this.domItem);
    this.owner.domTabPanel.append(this.domNode);
    this.select();
  }

  public open(
    editor: IVanessaEditor,
    key: string,
    title: string,
    filename: string,
    encoding: number,
  ): VanessaTabItem {
    this.editor.dispose();
    this.editor = editor;
    this.key = key;
    this.title = title;
    this.encoding = encoding;
    this.filename = filename;
    this.domTitle.innerText = title;
    this.domItem.setAttribute("title", title);
    return this;
  }

  public onSelect() {
    this.select();
  }

  public onClose() {
    this.close();
  }

  public select(): IVanessaEditor {
    const className = "vanessa-tab-select";
    this.domNode.parentElement.querySelectorAll("." + className).forEach(e => e.classList.remove(className));
    this.domNode.classList.add(className);
    this.domNode.scrollIntoView();
    let domEditor = this.editor.domNode();
    domEditor.parentElement.appendChild(domEditor);
    const index = this.owner.tabStack.findIndex(e => e === this);
    if (index >= 0) this.owner.tabStack.splice(index, 1);
    this.owner.tabStack.push(this);
    return this.editor;
  }

  private close() {
    const index = this.owner.tabStack.findIndex(e => e === this);
    if (index >= 0) this.owner.tabStack.splice(index, 1);
    const next = this.owner.tabStack.pop();
    if (next) next.select();
    this.editor.dispose();
    this.dispose();
  }

  dispose() {
    this.domNode.remove();
    this.editor = null;
    this.owner = null;
  }

  public get data() {
    return {
      editor: this.editor,
      model: this.editor.getModel(),
      title: this.title,
      filename: this.filename,
      encoding: this.encoding,
    }
  };
}

export class VanessaTabs {

  private static standaloneInstance: VanessaTabs;
  public domContainer: HTMLElement;
  public domTabPanel: HTMLElement;
  public tabStack: Array<VanessaTabItem> = [];

  public static createStandalone() {
    if (this.standaloneInstance) return this.standaloneInstance;
    VanessaEditor.disposeStandalone();
    VanessaDiffEditor.disposeStandalone();
    return this.standaloneInstance = new VanessaTabs;
  }

  public static getStandalone() { return this.standaloneInstance; }

  public static disposeStandalone() {
    if (this.standaloneInstance) {
      this.standaloneInstance.dispose();
      this.standaloneInstance = null;
    }
  }

  private constructor() {
    this.domContainer = document.getElementById("VanessaTabsContainer");
    this.domContainer.classList.remove("vanessa-hidden");
    this.domTabPanel = $("div.vanessa-tab-panel");
    this.domContainer.append(this.domTabPanel);
  }

  public dispose() {
    if (VanessaTabs.standaloneInstance === this) VanessaTabs.standaloneInstance = null;
    while (this.tabStack.length) this.tabStack.pop().dispose();
    this.domContainer.classList.add("vanessa-hidden");
  }

  public get current() {
    if (this.tabStack.length) return this.tabStack[this.tabStack.length - 1];
  }

  private key(original: string, modified: string = undefined) {
    return modified ? original + "\n" + modified : original;
  }

  public find = (
    original: string = "",
    modified: string = "",
  ): IVanessaEditor => {
    const key = this.key(original, modified);
    let tab = this.tabStack.find(t => t.key === key);
    if (tab) return tab.select();
  }

  private open(
    editor: IVanessaEditor,
    key: string,
    title: string,
    filename: string,
    encoding: number,
    newTab: boolean,
  ): IVanessaEditor {
    let tab: VanessaTabItem;
    if (!newTab && this.current) {
      tab = this.current.open(editor, key, title, filename, encoding);
    } else {
      tab = new VanessaTabItem(this, editor, key, title, filename, encoding);
    }
    return editor;
  }

  public edit = (
    content: string,
    filename: string,
    filepath: string,
    title: string,
    encoding: number,
    readOnly: boolean,
    newTab: boolean,
  ): IVanessaEditor => {
    let key = this.key(filepath);
    let tab = this.tabStack.find(t => t.key === key);
    if (tab) return tab.select();
    const uri = monaco.Uri.parse(filepath);
    let model = monaco.editor.getModel(uri);
    if (!model) model = createModel(content, filename, uri);
    const editor = new VanessaEditor(model, readOnly);
    return this.open(editor, key, title, filename, encoding, true);
  }

  public diff = (
    oldContent: string,
    oldFileName: string,
    oldFilePath: string,
    newContent: string,
    newFileName: string,
    newFilePath: string,
    title: string,
    encoding: number,
    readOnly: boolean,
    newTab: boolean,
  ) => {
    const key = this.key(oldFilePath, newFilePath);
    let tab = this.tabStack.find(t => t.key === key);
    if (tab) return tab.select();
    const uriOriginal = monaco.Uri.parse(oldFilePath);
    const uriModified = monaco.Uri.parse(newFilePath);
    const model: monaco.editor.IDiffEditorModel = {
      original: monaco.editor.getModel(uriOriginal),
      modified: monaco.editor.getModel(uriModified),
    };
    if (!model.original) model.original = createModel(oldContent, oldFileName, uriOriginal);
    if (!model.modified) model.modified = createModel(newContent, newFileName, uriModified);
    const editor = new VanessaDiffEditor(model, readOnly);
    return this.open(editor, key, title, newFileName, encoding, true);
  }

  public onFileSave = () => {
    const tab = this.current;
    if (tab) EventsManager.fireEvent(tab.editor, VanessaEditorEvent.PRESS_CTRL_S, tab.data);
  };

  public closeAll = () => {
    while (this.tabStack.length) this.tabStack.pop().dispose();
  }
  public getModel = () => this.current ? this.current.editor.getModel() : null;
}