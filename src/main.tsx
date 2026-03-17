import { render } from "preact";
import { App } from "./app.tsx";
import "./index.css";

// JSX language support for Monaco Editor
import "./monaco.ts";

render(<App />, document.getElementById("app")!);
