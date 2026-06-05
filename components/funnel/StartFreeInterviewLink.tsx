"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function StartFreeInterviewLink({
  className = "",
  children = "Start Free Interview",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link href="/pricing?intent=interview" className={className}>
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
