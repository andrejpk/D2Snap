// Adapted from shadcn/ui's official new-york-v4 table registry source.
// Copyright (c) 2023 shadcn. MIT: see ../../../public/LICENSE.shadcn.md.
// Tailwind classes replaced with local Clawpilot CSS; unused exports omitted.
import type { ComponentProps } from "react";

function cn(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base;
}

function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="table-container">
      <table data-slot="table" className={cn("table", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("table-header", className)} {...props} />;
}

function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("table-body", className)} {...props} />;
}

function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("table-row", className)} {...props} />;
}

function TableHead({ className, ...props }: ComponentProps<"th">) {
  return <th data-slot="table-head" className={cn("table-head", className)} {...props} />;
}

function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("table-cell", className)} {...props} />;
}

function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("table-caption", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption };
