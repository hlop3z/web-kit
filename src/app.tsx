import { useEffect, useRef } from "preact/hooks";
import "./app.css";

declare const Xkin: any;

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let editor: any;
    let cancelled = false;

    const init = () => {
      if (cancelled || !containerRef.current) return;
      editor = Xkin.editor({
        element: containerRef.current,
        value: `
function App() {
  return (
  <div>
    Hello, World!
    <ui-box>Button</ui-box>
  </div>
  );
}
        `.trim(),
        language: "typescript",
        theme: "vs-dark",
        read_only: false,
        minimap: false,
        font_size: 14,
      });
    };

    if (typeof Xkin !== "undefined") {
      init();
    } else {
      window.addEventListener("load", init, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", init);
      editor?.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="container"
      style={{ width: "100%", height: "100vh" }}
    />
  );
}
