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
        className="rounded-md border border-attention/45 bg-attention/12 p-4 text-attention"
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
