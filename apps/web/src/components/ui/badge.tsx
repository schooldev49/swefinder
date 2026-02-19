import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide", {
  variants: {
    variant: {
      default: "border border-[#1f6feb]/40 bg-[#1f6feb]/15 text-[#79c0ff]",
      outline: "border border-border bg-transparent text-muted-foreground",
      success: "border border-[#2ea043]/40 bg-[#2ea043]/15 text-[#7ee787]",
      warning: "border border-[#d29922]/40 bg-[#d29922]/15 text-[#f2cc60]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
