declare module "*.css";

declare module "*.css?raw" {
  const content: string;

  export default content;
}

declare module "*.png" {
  const source: string;

  export default source;
}
