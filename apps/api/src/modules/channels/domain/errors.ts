import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

export class ChannelDeliveryChangedError extends AssistantError {
  constructor() {
    super("Channel delivery authority changed before use", ErrorType.FORBIDDEN, 403);
  }
}
