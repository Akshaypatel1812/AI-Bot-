"use client";
import {
  SandpackProvider,
  SandpackPreview,
  SandpackLayout,
} from "@codesandbox/sandpack-react";
import { Console } from "console";

type Props = {
  framework: string;
  code: string;
};

export default function CodePreview({ framework, code }: Props) {
  let template: "react" | "vue" | "angular" | "svelte" | "static" = "static";
  
  console.log(template, "TEMP", framework)

  switch (framework) {
    case "react":
      template = "react";
      break;
    case "vue":
      template = "vue";
      break;
    case "angular":
      template = "angular";
      break;
    case "svelte":
      template = "svelte";
      break;
    case "html-css-tailwind":
    case "html-css-bootstrap":
      template = "static";
      break;
  }

  let entryFile = "/App.js";
  if (template === "static") entryFile = "/index.html";
  if (template === "vue") entryFile = "/src/App.vue";
  if (template === "svelte") entryFile = "/App.svelte";
  if (template === "angular") entryFile = "/src/app/app.component.ts";

  return (
    <div className="h-full w-full flex flex-col bg-white">
      <SandpackProvider
        template={template}
        files={{
          [entryFile]: code,
        }}
        style={{ height: "100%" }}
      >
        <SandpackLayout className="h-full">
          <SandpackPreview
            showOpenInCodeSandbox={true}
            showRefreshButton={true}
            style={{ height: "100%" }}
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
