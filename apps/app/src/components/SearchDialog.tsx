import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { Button, FormInput } from "~/components/ui";
import { Dialog, DialogContent } from "~/components/ui/Dialog";
import { useChats } from "~/hooks/useChat";
import { useChatStore } from "~/state/stores/chatStore";

type SearchDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const SearchDialog = ({ isOpen, onClose }: SearchDialogProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const { data: chats } = useChats();
  const { setCurrentConversationId } = useChatStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery("");
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  const filteredChats =
    chats?.filter((chat) =>
      chat.title?.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  useEffect(() => {
    setFocusedIndex(-1);
  }, []);

  const totalItems = searchQuery
    ? filteredChats.length + 1
    : filteredChats.length;

  const handleSelectChat = (chatId: string) => {
    setCurrentConversationId(chatId);
    navigate("/");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    if (
      e.target === inputRef.current &&
      e.key !== "Enter" &&
      e.key !== "ArrowDown"
    ) {
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (focusedIndex >= 0) {
          const chatIndex = searchQuery ? focusedIndex - 1 : focusedIndex;
          if (filteredChats[chatIndex]) {
            handleSelectChat(filteredChats[chatIndex].id || "");
          }
        }
        break;
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      width="max-w-md"
    >
      <DialogContent className="p-2">
        <div className="p-2" onKeyDown={handleKeyDown}>
          <div className="relative mb-4">
            <FormInput
              id="search-input"
              ref={inputRef}
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
              fullWidth
              autoFocus
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search size={16} className="text-zinc-500" />
            </div>
            {searchQuery && (
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3"
                onClick={() => setSearchQuery("")}
              >
                <X size={16} className="text-zinc-500" />
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto">
            {filteredChats.length > 0 ? (
              <div className="space-y-1">
                {filteredChats.map((chat, index) => {
                  const itemIndex = searchQuery ? index + 1 : index;

                  return (
                    <Button
                      key={chat.id}
                      type="button"
                      variant="ghost"
                      className={`w-full justify-start truncate ${focusedIndex === itemIndex ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" : ""}`}
                      onClick={() => handleSelectChat(chat.id || "")}
                      onMouseEnter={() => setFocusedIndex(itemIndex)}
                    >
                      <span className="truncate">
                        {chat.title || "Untitled chat"}
                      </span>
                    </Button>
                  );
                })}
              </div>
            ) : searchQuery ? (
              <p className="text-center text-zinc-500 py-4">No results found</p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
