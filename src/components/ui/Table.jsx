import React from "react";
import { clsx } from "clsx";
import "./ui-table.css";

/**
 * The one table structure in the app.
 *
 * Every table — the console lists, the content editors, the vendor catalog —
 * is built from these parts, so they all look the same, behave the same on a
 * phone, and can be restyled in one place.
 *
 * The `ui-table--cards` modifier turns a wide table into a stack of cards
 * below 640px: the first cell is the card's headline and every other cell
 * keeps its column name as a label, so nothing has to scroll sideways.
 */
export const Table = React.forwardRef(({ className, ...props }, ref) => (
  <table ref={ref} className={clsx("ui-table", className)} {...props} />
));
Table.displayName = "Table";

export const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={clsx("ui-table-header", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={clsx("ui-table-body", className)} {...props} />
));
TableBody.displayName = "TableBody";

export const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr ref={ref} className={clsx("ui-table-row", className)} {...props} />
));
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th ref={ref} className={clsx("ui-table-head", className)} {...props} />
));
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td ref={ref} className={clsx("ui-table-cell", className)} {...props} />
));
TableCell.displayName = "TableCell";

export const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
  <caption ref={ref} className={clsx("ui-table-caption", className)} {...props} />
));
TableCaption.displayName = "TableCaption";
