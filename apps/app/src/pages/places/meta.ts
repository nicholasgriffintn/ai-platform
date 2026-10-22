import type { MetaFunction } from "react-router";

export function placeMeta(titles: {
  personal: string;
  project?: string;
  description?: string;
}): MetaFunction {
  return ({ params }) => {
    const inProject = typeof params.projectId === "string";
    const title = inProject ? (titles.project ?? titles.personal) : titles.personal;

    return [
      { title: `${title} - Polychat` },
      ...(titles.description && !inProject
        ? [{ name: "description", content: titles.description }]
        : []),
    ];
  };
}
