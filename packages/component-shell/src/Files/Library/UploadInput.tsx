import { UPLOAD_ACCEPT, type FileCreation } from "./useFileCreation.js";

export function UploadInput({
  creation: { setUploadInput, uploadFiles },
}: {
  creation: FileCreation;
}) {
  return (
    <input
      ref={setUploadInput}
      type="file"
      aria-label="Upload files"
      multiple
      accept={UPLOAD_ACCEPT}
      className="sr-only"
      tabIndex={-1}
      onChange={(event) => {
        void uploadFiles(Array.from(event.currentTarget.files ?? []));
        event.currentTarget.value = "";
      }}
    />
  );
}
