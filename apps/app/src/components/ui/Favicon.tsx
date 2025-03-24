interface FaviconProps {
  url: string;
  className?: string;
}

const getHost = (url: string) => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    try {
      const urlObj = new URL(`https://${url}`);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }
};

export function Favicon({
  url,
  className = "w-6 h-6 rounded-full mr-2 bg-white object-contain p-[2px]",
}: FaviconProps) {
  return (
    <img
      src={`https://icons.duckduckgo.com/ip3/${getHost(url)}.ico`}
      alt=""
      aria-hidden="true"
      className={className}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.style.display = "none";
      }}
    />
  );
}
