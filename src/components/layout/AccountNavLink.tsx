"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";

export function AccountNavLink() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiGet<{ authenticated: boolean }>("/api/me")
      .then((result) => {
        if (!cancelled) {
          setAuthenticated(result.authenticated);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthenticated(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (authenticated === null) {
    return (
      <span className="invisible text-sm" aria-hidden>
        ورود
      </span>
    );
  }

  if (authenticated) {
    return (
      <Link
        href="/account/assessments"
        className="text-sm text-emerald-700 hover:text-emerald-800"
      >
        تست‌های من
      </Link>
    );
  }

  return (
    <Link
      href="/account/login"
      className="text-sm text-emerald-700 hover:text-emerald-800"
    >
      ورود
    </Link>
  );
}
