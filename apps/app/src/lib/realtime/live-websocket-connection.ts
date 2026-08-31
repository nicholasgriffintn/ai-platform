import {
  connectRealtimeWebSocket,
  type RealtimeSession,
  type RealtimeWebSocketConnection,
} from "@ngriffin_uk/polychat-library-realtime";
import { parseRealtimeMessageData } from "@ngriffin_uk/polychat-library-realtime/messages";
import type { RealtimeLiveWebSocketConfig } from "@ngriffin_uk/polychat-library-realtime/websocket-protocols";

import { createRealtimeWebSocketResumptionController } from "./live-websocket-resumption";

interface RealtimeLiveWebSocketConnectionOptions {
  config: RealtimeLiveWebSocketConfig;
  isSessionCurrent: () => boolean;
  onBeforeReconnect: () => void;
  onClose: (connection: RealtimeWebSocketConnection, event: CloseEvent) => void;
  onConnected: (connection: RealtimeWebSocketConnection) => void;
  onError: (connection: RealtimeWebSocketConnection) => void;
  onEventLabel: (label: string) => void;
  onPayload: (connection: RealtimeWebSocketConnection, payload: unknown) => void;
  onReady: (connection: RealtimeWebSocketConnection) => void;
  session: RealtimeSession;
}

export function connectRealtimeLiveWebSocket({
  config,
  isSessionCurrent,
  onBeforeReconnect,
  onClose,
  onConnected,
  onError,
  onEventLabel,
  onPayload,
  onReady,
  session,
}: RealtimeLiveWebSocketConnectionOptions): RealtimeWebSocketConnection {
  const resumptionController = createRealtimeWebSocketResumptionController();
  let activeConnection: RealtimeWebSocketConnection | undefined;

  const connect = (resumptionHandle?: string): RealtimeWebSocketConnection => {
    const reconnect = (connection: RealtimeWebSocketConnection, handle: string) => {
      onEventLabel(config.resumption?.reconnectingEventLabel ?? "Reconnecting");
      onBeforeReconnect();

      try {
        connect(handle);
        connection.close();
      } catch {
        onError(connection);
      }
    };

    const connection = connectRealtimeWebSocket({
      session,
      onClose: (event) => {
        if (activeConnection === connection && isSessionCurrent()) {
          onClose(connection, event);
        }
      },
      onError: () => {
        if (activeConnection === connection && isSessionCurrent()) {
          onError(connection);
        }
      },
      onMessage: (event) => {
        void (async () => {
          const payload = await parseRealtimeMessageData(event.data);

          if (activeConnection !== connection || !isSessionCurrent()) {
            return;
          }

          const updateRequest = resumptionController.observeUpdate(
            config.resumption?.extractUpdate(payload),
          );

          if (updateRequest) {
            reconnect(connection, updateRequest.handle);

            return;
          }

          const reconnectNotice = config.resumption?.extractReconnectNotice(payload);

          if (reconnectNotice) {
            const noticeRequest = resumptionController.requestReconnect(reconnectNotice);

            if (noticeRequest) {
              reconnect(connection, noticeRequest.handle);

              return;
            }
          }

          if (config.setup?.isCompleteMessage(payload)) {
            resumptionController.completeReconnect();
            onReady(connection);
          }

          onPayload(connection, payload);
        })();
      },
      onOpen: () => {
        if (activeConnection !== connection || !isSessionCurrent()) {
          connection.close();

          return;
        }

        if (config.setup) {
          try {
            connection.sendJson(config.setup.buildMessage(session, resumptionHandle));
            onEventLabel(config.setup.waitingEventLabel);
          } catch {
            onError(connection);
          }

          return;
        }

        onReady(connection);
      },
    });

    if (!isSessionCurrent()) {
      connection.close();

      return connection;
    }

    activeConnection = connection;
    onConnected(connection);

    return connection;
  };

  return connect();
}
