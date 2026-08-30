import { ChevronRight, FileImage, Lightbulb, Type, Wrench } from "lucide-react";
import type { Model } from "@mosaic-dock/shared";

interface ModelCapabilityIconsProps {
  model: Model;
}

const capabilityLabels: Record<string, string> = {
  text: "文本",
  image: "图片",
};

const capabilityIcons: Record<string, typeof Type> = {
  text: Type,
  image: FileImage,
};

export function ModelCapabilityIcons({ model }: ModelCapabilityIconsProps) {
  const inputCapabilities = getCapabilities(model.config?.inputCapabilities, ["text"]);
  const outputCapabilities = getCapabilities(model.config?.outputCapabilities, ["text"]);
  const features = getCapabilities(model.config?.features, []);
  const hasTools = features.includes("tools") || features.includes("tool");
  const hasThinking = features.includes("thinking");
  const labelParts = [
    `${formatCapabilityList(inputCapabilities)}输入到${formatCapabilityList(outputCapabilities)}输出`,
    hasTools ? "工具" : null,
    hasThinking ? "思考" : null,
  ].filter(Boolean);

  return (
    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400" aria-label={`能力：${labelParts.join("、")}`}>
      <span className="inline-flex items-center gap-0.5 rounded border border-gray-100 bg-gray-50 px-1.5 py-0.5">
        {inputCapabilities.map((capability) => {
          const Icon = capabilityIcons[capability] ?? Type;
          return <Icon key={`input-${capability}`} className="h-3 w-3" aria-hidden="true" />;
        })}
        <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
        {outputCapabilities.map((capability) => {
          const Icon = capabilityIcons[capability] ?? Type;
          return <Icon key={`output-${capability}`} className="h-3 w-3" aria-hidden="true" />;
        })}
      </span>
      {hasTools ? <Wrench className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {hasThinking ? <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" /> : null}
    </div>
  );
}

function getCapabilities(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const capabilities = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return capabilities.length > 0 ? capabilities : fallback;
}

function formatCapabilityList(capabilities: string[]): string {
  return capabilities.map((capability) => capabilityLabels[capability] ?? capability).join("和");
}
