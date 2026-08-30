import {
  matchesComposerCommand,
  matchesComposerSlashCommand,
} from "@ngriffin_uk/polychat-library-chat/composer-commands";

import type { ComposerCommandAction } from "../composerCommandTypes";

export interface ComposerCommandMenuState {
  commands: ComposerCommandAction[];
  parent: ComposerCommandAction | null;
}

export function getComposerCommandMenuState(
  query: string,
  commands: ComposerCommandAction[],
): ComposerCommandMenuState {
  const separatorIndex = query.indexOf(" ");

  if (separatorIndex === -1) {
    return {
      commands: commands.filter((command) => matchesComposerSlashCommand(query, command.command)),
      parent: null,
    };
  }

  const parentCommand = query.slice(0, separatorIndex).trim().toLowerCase();
  const parent =
    commands.find(
      (command) =>
        command.command.toLowerCase() === parentCommand && (command.options?.length ?? 0) > 0,
    ) ?? null;

  if (!parent?.options) {
    return { commands: [], parent: null };
  }

  const optionQuery = query.slice(separatorIndex + 1);

  return {
    commands: parent.options.filter((option) => {
      const commandPrefix = `${parent.command} `;
      const optionCommand = option.command.toLowerCase().startsWith(commandPrefix.toLowerCase())
        ? option.command.slice(commandPrefix.length)
        : option.command;

      return matchesComposerCommand(optionQuery, [optionCommand, option.label, option.description]);
    }),
    parent,
  };
}
