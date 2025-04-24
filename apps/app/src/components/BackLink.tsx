import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Button } from "./ui";

export function BackLink({
  to,
  label,
  onClick,
}: {
  to: string;
  label: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <Button
        type="button"
        variant="link"
        onClick={onClick}
        className="no-underline flex items-center text-blue-500 dark:text-blue-400 mb-2 hover:underline group"
      >
        <ArrowLeft
          size={16}
          className="mr-1 group-hover:-translate-x-1 transition-transform"
        />
        <span>{label}</span>
      </Button>
    );
  }

  return (
    <Link
      to={to}
      className="no-underline flex items-center text-blue-500 dark:text-blue-400 mb-2 hover:underline group"
    >
      <ArrowLeft
        size={16}
        className="mr-1 group-hover:-translate-x-1 transition-transform"
      />
      <span>{label}</span>
    </Link>
  );
}
