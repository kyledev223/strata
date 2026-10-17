import type { Metadata } from "next";
import { LaunchForm } from "@/components/launch/LaunchForm";

export const metadata: Metadata = {
  title: "Launch a token",
  description: "Launch a Solana token with its own SOL reserve and a floor that only goes up.",
};

export default function LaunchPage() {
  return (
    <div className="frame pt-6 md:pt-10">
      <h1 className="sr-only">Launch a token</h1>
      <LaunchForm />
    </div>
  );
}
