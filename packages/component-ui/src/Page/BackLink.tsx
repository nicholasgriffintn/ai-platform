import { ArrowLeft } from "lucide-react";

import { Button } from "../Button";
import { Link } from "../Link";

const backLinkClassName =
  "no-underline flex items-center text-active-work mb-2 hover:underline group";

const backLinkIcon = (
  <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
);

export function BackLink({
  href,
  label,
  onClick,
}: {
  href?: string;
  label: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <Button type="button" onClick={onClick} className={backLinkClassName}>
        {backLinkIcon}
        <span>{label}</span>
      </Button>
    );
  }

  return (
    <Link href={href || "/"} className={backLinkClassName}>
      {backLinkIcon}
      <span>{label}</span>
    </Link>
  );
}
