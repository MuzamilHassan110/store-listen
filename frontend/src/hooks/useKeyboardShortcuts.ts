import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function useKeyboardShortcuts(): void {
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (!event.altKey) return;
      if (event.key === "1") navigate("/");
      if (event.key === "2") navigate("/conversations");
      if (event.key === "3") navigate("/followups");
      if (event.key === "4") navigate("/reports");
      if (event.key === "5") navigate("/settings");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}
