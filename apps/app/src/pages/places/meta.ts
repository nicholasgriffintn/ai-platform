import type { MetaDescriptor } from "react-router";

interface PlaceMetaArgs {
  params: { projectId?: string };
}

export function placeMeta(titles: {
  personal: string;
  project?: string;
  description?: string;
}): (args: PlaceMetaArgs) => MetaDescriptor[] {
  return ({ params }) => {
    const title = params.projectId ? (titles.project ?? titles.personal) : titles.personal;

    return [
      { title: `${title} - Polychat` },
      ...(titles.description && !params.projectId
        ? [{ name: "description", content: titles.description }]
        : []),
    ];
  };
}
