import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide", {
  variants: {
    variant: {
      default: "bg-primary/10 text-primary",
      outline: "border border-border text-muted-foreground",
      success: "bg-emerald-500/10 text-emerald-300",
      warning: "bg-amber-500/10 text-amber-300",
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
