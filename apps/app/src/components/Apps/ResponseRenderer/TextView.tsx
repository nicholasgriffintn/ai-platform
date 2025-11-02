interface TextViewProps {
  data: {
    content: string;
  };
}

export const TextView = ({ data }: TextViewProps) => {
  const { content } = data;

  if (!content) {
    return (
      <div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
        No content available.
      </div>
    );
  }

  const lines = content.split("\n");

  return (
    <div className="prose dark:prose-invert max-w-none">
      {lines.map((line, index) => (
        <p key={index} className={line.trim() === "" ? "h-4" : ""}>
          {line}
        </p>
      ))}
    </div>
  );
};
