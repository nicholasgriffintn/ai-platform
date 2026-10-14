import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const devicesTagDescription = md`
# Devices

Register iOS push tokens so notifications reach the app. Registering the same token again refreshes it, and the push token doubles as the device id.
`;
