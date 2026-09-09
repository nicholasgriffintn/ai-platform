import type { ReactNode } from "react";

export interface PetPerchProps {
  pet: ReactNode;
  status: string;
}

export function PetPerch({ pet, status }: PetPerchProps) {
  return (
    <div className="flex justify-end pr-2 pb-1" data-pet-perch="dock">
      <div className="flex items-end gap-2">
        <output className="sr-only" aria-live="polite">
          {status}
        </output>
        {pet}
      </div>
    </div>
  );
}
