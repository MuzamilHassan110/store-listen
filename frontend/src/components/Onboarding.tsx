import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const KEY = "storelisten_onboarded";

const STEPS = [
  { title: "Welcome to StoreListen", body: "Record store conversations on the desktop app. This dashboard shows AI analysis, leads, and scores." },
  { title: "Connect a store", body: "Add stores and devices, then record from the Windows app. Audio never needs a Gemini key on the desktop." },
  { title: "Follow the leads", body: "High-intent conversations become follow-ups. Use WhatsApp only after the customer consents." },
];

export function Onboarding() {
  const [open, setOpen] = useState(() => localStorage.getItem(KEY) !== "1");
  const [step, setStep] = useState(0);

  if (!open) return null;
  const current = STEPS[step] ?? STEPS[0];

  return (
    <Card className="mb-4 border-emerald-800">
      <CardHeader>
        <CardTitle>{current?.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-300">{current?.body}</p>
        <div className="flex flex-wrap gap-2">
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((value) => value + 1)}>Next</Button>
          ) : (
            <Button
              onClick={() => {
                localStorage.setItem(KEY, "1");
                setOpen(false);
              }}
            >
              Start using StoreListen
            </Button>
          )}
          <Link to="/stores" className="inline-flex min-h-11 items-center text-sm text-emerald-400">
            Add a store
          </Link>
          <Button
            variant="ghost"
            onClick={() => {
              localStorage.setItem(KEY, "1");
              setOpen(false);
            }}
          >
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
