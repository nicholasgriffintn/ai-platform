import type {
  SiteCollection,
  SiteDataAction,
  SiteRuntimeActor,
} from "@ngriffin_uk/polychat-schemas";
import { DurableObject } from "cloudflare:workers";

import type { IEnv } from "~/types";

import { SiteCollectionStore } from "./collection-store";

export class SiteRuntime extends DurableObject<IEnv> {
  private readonly store = new SiteCollectionStore(this.ctx.storage.sql);

  status() {
    return this.store.status();
  }

  activate(revision: number, collections: Record<string, SiteCollection>) {
    return this.ctx.storage.transactionSync(() => this.store.activate(revision, collections));
  }

  read(revision: number, collectionId: string) {
    return this.store.read(revision, collectionId);
  }

  operate(revision: number, action: SiteDataAction, actor: SiteRuntimeActor) {
    return this.ctx.storage.transactionSync(() => this.store.operate(revision, action, actor));
  }

  disable() {
    this.store.disable();
  }

  deleteData() {
    this.ctx.storage.transactionSync(() => this.store.deleteData());
  }
}
