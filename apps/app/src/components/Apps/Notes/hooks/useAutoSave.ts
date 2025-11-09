import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type MutableRefObject,
} from "react";
import { toast } from "sonner";

import { splitTitleAndContent } from "~/lib/text-utils";

interface SaveOptions {
	refreshMetadata?: boolean;
}

interface UseAutoSaveOptions {
	text: string;
	onSave: (
		title: string,
		content: string,
		metadata?: Record<string, any>,
		options?: SaveOptions,
	) => Promise<string>;
	tabInfo?: any;
	metadata: Record<string, any>;
	delay?: number;
	saveOptionsRef?: MutableRefObject<SaveOptions | null>;
}

export function useAutoSave({
	text,
	onSave,
	tabInfo,
	metadata,
	delay = 1000,
	saveOptionsRef,
}: UseAutoSaveOptions) {
	const [lastSavedText, setLastSavedText] = useState<string>(text);
	const [isSaving, setIsSaving] = useState<boolean>(false);
	const textRef = useRef(text);
	const lastSavedRef = useRef(lastSavedText);
	const isSavingRef = useRef(false);

	useEffect(() => {
		textRef.current = text;
	}, [text]);

	useEffect(() => {
		lastSavedRef.current = lastSavedText;
	}, [lastSavedText]);

	useEffect(() => {
		isSavingRef.current = isSaving;
	}, [isSaving]);

	const saveNote = useCallback(
		async (textToSave: string) => {
			if (isSavingRef.current) return;

			setIsSaving(true);
			try {
				const [title, content] = splitTitleAndContent(textToSave);
				const tabMetadata = tabInfo ? { tabSource: tabInfo } : {};
				const finalMetadata = { ...metadata, ...tabMetadata };
				const pendingOptions = saveOptionsRef?.current || undefined;
				await onSave(title, content, finalMetadata, pendingOptions);
				if (saveOptionsRef) {
					saveOptionsRef.current = null;
				}
				setLastSavedText(textToSave);
			} catch {
				toast.error("Failed to save note");
			} finally {
				setIsSaving(false);
			}
		},
		[onSave, tabInfo, metadata, saveOptionsRef],
	);

	const forceSave = useCallback(
		(options?: { bypassDirtyCheck?: boolean }) => {
			const hasChanges = textRef.current !== lastSavedRef.current;
			if ((hasChanges || options?.bypassDirtyCheck) && !isSavingRef.current) {
				return saveNote(textRef.current);
			}
		},
		[saveNote],
	);

	useEffect(() => {
		if (text === lastSavedText) return;

		const timeout = setTimeout(() => {
			if (!isSavingRef.current) {
				saveNote(text);
			}
		}, delay);

		return () => clearTimeout(timeout);
	}, [text, lastSavedText, delay]);

	return {
		isSaving,
		lastSavedText,
		forceSave,
	};
}
