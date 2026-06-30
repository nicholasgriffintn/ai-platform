export type AttachmentData =
	| {
			type: "image";
			data: string;
			name?: string;
	  }
	| {
			type: "document";
			data: string;
			name?: string;
	  }
	| {
			type: "audio";
			data: string;
			name?: string;
	  }
	| {
			type: "markdown_document";
			data: string;
			name?: string;
			markdown: string;
	  }
	| {
			type: "artifact_selection";
			name: string;
			artifact: {
				identifier: string;
				type: string;
				title?: string;
			};
			selectedText: string;
			selectionStart: number;
			selectionEnd: number;
	  };
