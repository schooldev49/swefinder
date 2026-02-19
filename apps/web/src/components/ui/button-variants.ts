import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#238636] text-white border border-[#2ea043]/60 hover:bg-[#2ea043]",
        secondary: "bg-secondary text-secondary-foreground border border-border hover:bg-[#30363d]",
        outline: "border border-border bg-transparent text-foreground hover:bg-[#21262d]",
        ghost: "text-muted-foreground hover:bg-[#21262d] hover:text-foreground",
        destructive: "bg-destructive text-destructive-foreground border border-[#f85149]/60 hover:bg-[#da3633]",
        subtle: "bg-muted text-muted-foreground border border-border hover:bg-[#30363d]",
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
