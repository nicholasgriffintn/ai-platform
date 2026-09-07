import type { NoteMetadata } from "@ngriffin_uk/polychat-schemas";

export interface NoteSaveInput {
  title: string;
  content: string;
  metadata: NoteMetadata;
  options?: { refreshMetadata?: boolean };
}

export interface NoteSaverPorts {
  create: (input: NoteSaveInput) => Promise<{ id: string }>;
  update: (input: NoteSaveInput & { id: string }) => Promise<unknown>;
  onCreated?: (id: string) => void;
}

export interface NoteSaver {
  save: (routeNoteId: string | undefined, input: NoteSaveInput) => Promise<string>;
  reset: () => void;
}

export function createNoteSaver({ create, update, onCreated }: NoteSaverPorts): NoteSaver {
  let createdId: string | null = null;
  let creating: Promise<string> | null = null;

  return {
    reset: () => {
      createdId = null;
      creating = null;
    },
    save: async (routeNoteId, input) => {
      const existingId = routeNoteId ?? createdId;

      if (existingId) {
        await update({ id: existingId, ...input });

        return existingId;
      }

      if (creating) {
        const id = await creating;

        await update({ id, ...input });

        return id;
      }

      creating = create(input).then((created) => {
        createdId = created.id;
        onCreated?.(created.id);

        return created.id;
      });

      try {
        return await creating;
      } catch (error) {
        creating = null;
        throw error;
      }
    },
  };
}
