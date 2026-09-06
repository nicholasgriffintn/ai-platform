import type {
  RealtimeGoAwayNotice,
  RealtimeSessionResumptionUpdate,
} from "@ngriffin_uk/polychat-library-realtime/messages";

export interface RealtimeWebSocketReconnectRequest {
  handle: string;
  timeLeft?: string;
}

export interface RealtimeWebSocketResumptionController {
  completeReconnect(): void;
  observeUpdate(
    update: RealtimeSessionResumptionUpdate | undefined,
  ): RealtimeWebSocketReconnectRequest | undefined;
  requestReconnect(notice: RealtimeGoAwayNotice): RealtimeWebSocketReconnectRequest | undefined;
}

export function createRealtimeWebSocketResumptionController(): RealtimeWebSocketResumptionController {
  let handle: string | undefined;
  let pendingNotice: RealtimeGoAwayNotice | undefined;
  let reconnecting = false;

  const takeReconnectRequest = (): RealtimeWebSocketReconnectRequest | undefined => {
    if (!handle || !pendingNotice || reconnecting) {
      return undefined;
    }

    const request = { handle, ...pendingNotice };

    pendingNotice = undefined;
    reconnecting = true;

    return request;
  };

  return {
    completeReconnect() {
      pendingNotice = undefined;
      reconnecting = false;
    },
    observeUpdate(update) {
      if (!update) {
        return undefined;
      }

      handle = update.resumable ? update.handle : undefined;

      return takeReconnectRequest();
    },
    requestReconnect(notice) {
      pendingNotice = notice;

      return takeReconnectRequest();
    },
  };
}
