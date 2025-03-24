export enum ResponseDisplayType {
  TABLE = "table",
  JSON = "json",
  TEXT = "text",
  TEMPLATE = "template",
  // Custom is just a JSON response for the user to make what they want
  CUSTOM = "custom",
}

export interface ResponseField {
  key: string;
  label: string;
  format?: string;
}

export type ResponseDisplay = {
  fields?: ResponseField[];
  template?: string;
};
