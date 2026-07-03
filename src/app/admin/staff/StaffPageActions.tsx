"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StaffForm } from "./StaffForm";

export function StaffPageActions() {
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <StaffForm
        onCreated={() => setShowForm(false)}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  return (
    <div className="mb-6 flex justify-end">
      <Button type="button" onClick={() => setShowForm(true)}>
        افزودن کاربر
      </Button>
    </div>
  );
}
