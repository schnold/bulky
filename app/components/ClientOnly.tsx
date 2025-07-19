import { useEffect, useState } from "react";

interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  // Use a simple check for client-side rendering
  if (typeof window === "undefined") {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}