import { notFound } from "next/navigation";
import { MODELS, SAAS_MODELS } from "@/models";
import { CalculatorClient } from "@/components/CalculatorClient";
import { SaasCalculatorClient } from "@/components/SaasCalculatorClient";

export default function CalculatorPage({ params }: { params: { modelId: string } }) {
  const id = params.modelId;
  if (SAAS_MODELS[id]) {
    return <SaasCalculatorClient modelId={id} />;
  }
  if (MODELS[id]) {
    return <CalculatorClient modelId={id} />;
  }
  notFound();
}
