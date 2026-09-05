import { BoundedMarkdown } from "./BoundedMarkdown";

interface TextViewProps {
  data: {
    content: string;
  };
}

export const TextView = ({ data }: TextViewProps) => {
  const { content } = data;

  if (!content || !content.trim()) {
    return (
      <div
        data-responsetype="text"
        className="rounded-md border border-amber-200 bg-amber-100 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
      >
        No content available.
      </div>
    );
  }

  return (
    <div data-responsetype="text">
      <BoundedMarkdown content={content} />
    </div>
  );
};
