declare module "json2csv" {
  export class Parser<T = any> {
    constructor(opts?: any);
    parse(data: T[] | Record<string, any>[]): string;
  }
}