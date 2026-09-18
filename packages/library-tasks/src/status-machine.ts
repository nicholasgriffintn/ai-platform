import { TaskError } from "./errors.js";

export interface StatusMachineDefinition<TStatus extends string, TActor extends string> {
  terminal: readonly TStatus[];
  allowed: Record<TActor, readonly TStatus[]>;
  reopenBy?: readonly TActor[];
  describeRefusal?: (params: { actor: TActor; from: TStatus; to: TStatus }) => string | undefined;
}

export interface StatusMachine<TStatus extends string, TActor extends string> {
  isTerminal(status: TStatus): boolean;
  canSet(actor: TActor, status: TStatus): boolean;
  canTransition(params: { actor: TActor; from: TStatus; to: TStatus }): boolean;
  assertTransition(params: { actor: TActor; from: TStatus; to: TStatus }): void;
}

export function defineStatusMachine<TStatus extends string, TActor extends string>(
  definition: StatusMachineDefinition<TStatus, TActor>,
): StatusMachine<TStatus, TActor> {
  const isTerminal = (status: TStatus) => definition.terminal.includes(status);
  const canSet = (actor: TActor, status: TStatus) => definition.allowed[actor].includes(status);
  const canReopen = (actor: TActor) => (definition.reopenBy ?? []).includes(actor);
  const canTransition = ({ actor, from, to }: { actor: TActor; from: TStatus; to: TStatus }) =>
    from === to || (canSet(actor, to) && (!isTerminal(from) || canReopen(actor)));

  return {
    isTerminal,
    canSet,
    canTransition,
    assertTransition: (params) => {
      if (canTransition(params)) {
        return;
      }

      const message =
        definition.describeRefusal?.(params) ??
        (isTerminal(params.from) && !canReopen(params.actor)
          ? `A ${params.actor} cannot reopen a task that is ${params.from}`
          : `A ${params.actor} cannot move a task to ${params.to}`);

      throw new TaskError("forbidden_transition", message, params);
    },
  };
}
