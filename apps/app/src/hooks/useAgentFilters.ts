import { useEffect, useState } from "react";

/**
 * Hook for managing agent filtering and search state
 */
export function useAgentFilters() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.length >= 3 ? searchTerm : "");
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const resetFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setSelectedCategory("");
    setSelectedTag("");
  };

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedTag,
    setSelectedTag,
    resetFilters,
  };
}
