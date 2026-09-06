import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export interface TeammateEditorSectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function TeammateEditorSection({
  title,
  description,
  children,
}: TeammateEditorSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
