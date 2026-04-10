import NodeEnvironment from "jest-environment-node";
import { Window } from "happy-dom";

export default class HappyDomEnvironment extends NodeEnvironment {
  private window?: Window;

  async setup() {
    await super.setup();
    this.window = new Window();
    const g = (this as any).global;
    g.window = this.window as any;
    g.document = this.window.document as any;
    g.navigator = this.window.navigator as any;
    g.HTMLElement = this.window.HTMLElement as any;
    g.Node = this.window.Node as any;
    g.getComputedStyle = this.window.getComputedStyle.bind(this.window);
    g.requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
    g.cancelAnimationFrame = (id: any) => clearTimeout(id);
  }

  async teardown() {
    this.window = undefined;
    await super.teardown();
  }
}
