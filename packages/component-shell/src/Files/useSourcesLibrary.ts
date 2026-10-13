import {
  useSourceCollections,
  useSourceMutations,
  useSources,
} from "@ngriffin_uk/polychat-library-react";
import type { SourceKind } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export function useSourcesLibrary(projectId?: string, createRequestKey?: number) {
  const [kind, setKind] = useState<"" | SourceKind>("");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [isCreateSourceOpen, setIsCreateSourceOpen] = useState(false);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [sourceIdToDelete, setSourceIdToDelete] = useState<string | null>(null);
  const [collectionIdToDelete, setCollectionIdToDelete] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [collectionTitle, setCollectionTitle] = useState("");
  const {
    data: sources,
    isLoading,
    error,
  } = useSources({
    projectId,
    kind: collectionId ? undefined : kind || undefined,
    collectionId,
  });
  const { data: sourceCollections } = useSourceCollections(projectId);
  const collections = sourceCollections?.filter((collection) => collection.kind !== "context");
  const mutations = useSourceMutations();
  const selectedCollection = collections?.find((collection) => collection.id === collectionId);
  const [prevCreateRequestKey, setPrevCreateRequestKey] = useState(createRequestKey);

  if (prevCreateRequestKey !== createRequestKey) {
    setPrevCreateRequestKey(createRequestKey);

    if (createRequestKey) {
      setIsCreateSourceOpen(true);
    }
  }

  return {
    kind,
    setKind,
    collectionId,
    setCollectionId,
    isCreateSourceOpen,
    setIsCreateSourceOpen,
    isCreateCollectionOpen,
    setIsCreateCollectionOpen,
    sourceIdToDelete,
    setSourceIdToDelete,
    collectionIdToDelete,
    setCollectionIdToDelete,
    sourceTitle,
    setSourceTitle,
    sourceContent,
    setSourceContent,
    collectionTitle,
    setCollectionTitle,
    sources,
    isLoading,
    error,
    collections,
    mutations,
    selectedCollection,
  };
}
