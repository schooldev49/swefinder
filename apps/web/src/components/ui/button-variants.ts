import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-primary/60 bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/85",
        outline: "border border-border bg-transparent text-foreground hover:bg-accent/60",
        ghost: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        destructive: "border border-destructive/60 bg-destructive text-destructive-foreground hover:bg-destructive/90",
        subtle: "border border-border bg-muted text-muted-foreground hover:bg-muted/85",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
