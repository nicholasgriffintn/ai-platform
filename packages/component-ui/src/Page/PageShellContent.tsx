import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../utils";

export const pageShellContentClassName = "container mx-auto p-4";

export function PageShellContent({ className, ...props }: ComponentPropsWithoutRef<"main">) {
	return <main className={cn(pageShellContentClassName, className)} {...props} />;
}
