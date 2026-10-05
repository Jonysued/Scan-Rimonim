// Applies EXIF orientation (phone photos) and downsizes, so the AI sees the same image the user sees.
export default async function normalizeImage(file, maxSize = 2000) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return new File([blob], (file.name || "foto").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}